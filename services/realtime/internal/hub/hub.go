// Package hub diffuse les positions aux navigateurs par WebSocket : un instantané à la
// connexion (et à chaque abonnement), puis seulement les différences (ADR 0013).
package hub

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
	"google.golang.org/protobuf/proto"

	pb "github.com/kuami-labs/xlivemetro/services/realtime/gen/xlivemetro/v1"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/position"
)

// Limites de protection (docs/08-SECURITE.md).
const (
	sendQueue      = 16      // messages en attente par client ; au-delà, le client est déconnecté
	maxClientMsg   = 4 << 10 // taille maximale d'un message client
	maxRouteFilter = 64      // lignes par abonnement
	writeTimeout   = 10 * time.Second
)

// Hub garde le dernier état et les clients connectés.
type Hub struct {
	// OriginPatterns : origines autorisées (ex. « localhost:3000 »). Vide = même origine seulement.
	OriginPatterns []string
	// MaxPerIP : connexions simultanées par adresse IP.
	MaxPerIP int
	Source   string

	mu       sync.Mutex
	clients  map[*client]struct{}
	perIP    map[string]int
	state    map[string]*pb.Vehicle
	dataTime time.Time
}

type client struct {
	send   chan []byte
	cancel context.CancelFunc
	filter filter
	sent   map[string]*pb.Vehicle
}

type filter struct {
	bbox   *pb.BBox
	routes map[string]bool
}

func (f filter) match(v *pb.Vehicle) bool {
	if len(f.routes) > 0 && !f.routes[v.RouteId] {
		return false
	}
	b := f.bbox
	return b == nil || (v.Lon >= b.West && v.Lon <= b.East && v.Lat >= b.South && v.Lat <= b.North)
}

// New crée un hub.
func New(source string, origins []string) *Hub {
	return &Hub{
		Source: source, OriginPatterns: origins, MaxPerIP: 8,
		clients: map[*client]struct{}{}, perIP: map[string]int{}, state: map[string]*pb.Vehicle{},
	}
}

// Stats renvoie le nombre de clients et de véhicules.
func (h *Hub) Stats() (clients, vehicles int) {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.clients), len(h.state)
}

// Vehicle renvoie l'état courant d'un train.
func (h *Hub) Vehicle(id string) (*pb.Vehicle, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	v, ok := h.state[id]
	return v, ok
}

// Update remplace l'état et envoie à chaque client les différences de sa zone.
func (h *Hub) Update(vs []position.Vehicle, now, dataTime time.Time) {
	state := make(map[string]*pb.Vehicle, len(vs))
	for _, v := range vs {
		state[v.ID] = toPB(v)
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	h.state, h.dataTime = state, dataTime
	for c := range h.clients {
		d := &pb.Delta{TimeMs: now.UnixMilli(), DataTimeMs: millis(dataTime)}
		for id, v := range state {
			if !c.filter.match(v) {
				continue
			}
			if old, ok := c.sent[id]; !ok || !proto.Equal(old, v) {
				d.Upserts = append(d.Upserts, v)
				c.sent[id] = v
			}
		}
		for id := range c.sent {
			if v, ok := state[id]; !ok || !c.filter.match(v) {
				d.Removed = append(d.Removed, id)
				delete(c.sent, id)
			}
		}
		h.enqueue(c, &pb.ServerMessage{Msg: &pb.ServerMessage_Delta{Delta: d}})
	}
}

// snapshot (re)calcule l'état complet de la zone d'un client. h.mu doit être tenu.
func (h *Hub) snapshot(c *client) {
	s := &pb.Snapshot{TimeMs: time.Now().UnixMilli(), Source: h.Source, DataTimeMs: millis(h.dataTime)}
	c.sent = map[string]*pb.Vehicle{}
	for id, v := range h.state {
		if c.filter.match(v) {
			s.Vehicles = append(s.Vehicles, v)
			c.sent[id] = v
		}
	}
	h.enqueue(c, &pb.ServerMessage{Msg: &pb.ServerMessage_Snapshot{Snapshot: s}})
}

// enqueue n'attend jamais : un client trop lent est déconnecté. h.mu doit être tenu.
func (h *Hub) enqueue(c *client, m *pb.ServerMessage) {
	b, err := proto.Marshal(m)
	if err != nil {
		slog.Error("encodage protobuf", "err", err)
		return
	}
	select {
	case c.send <- b:
	default:
		c.cancel()
	}
}

// ServeHTTP accepte une connexion WebSocket.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r)
	h.mu.Lock()
	if h.perIP[ip] >= h.MaxPerIP {
		h.mu.Unlock()
		http.Error(w, "trop de connexions", http.StatusTooManyRequests)
		return
	}
	h.perIP[ip]++
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		if h.perIP[ip]--; h.perIP[ip] <= 0 {
			delete(h.perIP, ip)
		}
		h.mu.Unlock()
	}()

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: h.OriginPatterns})
	if err != nil {
		return // Accept a déjà répondu (origine refusée, requête invalide)
	}
	conn.SetReadLimit(maxClientMsg)
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	c := &client{send: make(chan []byte, sendQueue), cancel: cancel}
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.snapshot(c)
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.clients, c)
		h.mu.Unlock()
	}()

	go h.readLoop(ctx, conn, c)
	for {
		select {
		case <-ctx.Done():
			conn.Close(websocket.StatusPolicyViolation, "fermeture")
			return
		case b := <-c.send:
			wctx, wcancel := context.WithTimeout(ctx, writeTimeout)
			err := conn.Write(wctx, websocket.MessageBinary, b)
			wcancel()
			if err != nil {
				return
			}
		}
	}
}

func (h *Hub) readLoop(ctx context.Context, conn *websocket.Conn, c *client) {
	defer c.cancel()
	for {
		typ, b, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var m pb.ClientMessage
		if typ != websocket.MessageBinary || proto.Unmarshal(b, &m) != nil {
			return
		}
		sub := m.GetSubscribe()
		if sub == nil {
			continue
		}
		f, err := toFilter(sub)
		if err != nil {
			return
		}
		h.mu.Lock()
		c.filter = f
		h.snapshot(c)
		h.mu.Unlock()
	}
}

func toFilter(s *pb.Subscribe) (filter, error) {
	f := filter{}
	if b := s.GetBbox(); b != nil {
		for _, x := range []float32{b.West, b.South, b.East, b.North} {
			if math.IsNaN(float64(x)) || math.IsInf(float64(x), 0) {
				return f, errors.New("bbox invalide")
			}
		}
		if b.West > b.East || b.South > b.North || b.South < -90 || b.North > 90 {
			return f, errors.New("bbox invalide")
		}
		f.bbox = b
	}
	if len(s.RouteIds) > maxRouteFilter {
		return f, errors.New("trop de lignes")
	}
	if len(s.RouteIds) > 0 {
		f.routes = map[string]bool{}
		for _, id := range s.RouteIds {
			f.routes[id] = true
		}
	}
	return f, nil
}

func toPB(v position.Vehicle) *pb.Vehicle {
	return &pb.Vehicle{
		Id: v.ID, RouteId: v.RouteID, Lat: float32(v.Lat), Lon: float32(v.Lon),
		Bearing: float32(math.Round(v.Bearing)), Speed: float32(math.Round(v.SpeedMps*10) / 10),
		Delay: v.DelayS, AtStop: v.AtStop, Theoretical: v.Theoretical,
		NextStopId: v.NextStopID, Headsign: v.Headsign,
	}
}

func millis(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.UnixMilli()
}

// clientIP : adresse de la connexion. Derrière un proxy, à adapter au déploiement (ADR à venir).
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
