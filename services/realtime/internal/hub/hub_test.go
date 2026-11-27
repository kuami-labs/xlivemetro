package hub

import (
	"context"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"google.golang.org/protobuf/proto"

	pb "github.com/kuami-labs/xlivemetro/services/realtime/gen/xlivemetro/v1"
	"github.com/kuami-labs/xlivemetro/services/realtime/internal/position"
)

var (
	paris   = position.Vehicle{ID: "a", RouteID: "IDFM:C1", Lat: 48.86, Lon: 2.35, SpeedMps: 10.04}
	defense = position.Vehicle{ID: "b", RouteID: "IDFM:C2", Lat: 48.89, Lon: 2.24}
)

func setup(t *testing.T) (*Hub, string) {
	t.Helper()
	h := New("synthetic", nil)
	h.Update([]position.Vehicle{paris, defense}, time.Now(), time.Now())
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return h, "ws" + strings.TrimPrefix(srv.URL, "http")
}

func dial(t *testing.T, url string) *websocket.Conn {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { c.CloseNow() })
	return c
}

func read(t *testing.T, c *websocket.Conn) *pb.ServerMessage {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, b, err := c.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var m pb.ServerMessage
	if err := proto.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	return &m
}

func write(t *testing.T, c *websocket.Conn, m *pb.ClientMessage) {
	t.Helper()
	b, _ := proto.Marshal(m)
	if err := c.Write(context.Background(), websocket.MessageBinary, b); err != nil {
		t.Fatal(err)
	}
}

func subscribe(bbox *pb.BBox, routes ...string) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Subscribe{Subscribe: &pb.Subscribe{Bbox: bbox, RouteIds: routes}}}
}

func TestSnapshotSubscribeDelta(t *testing.T) {
	h, url := setup(t)
	c := dial(t, url)

	s := read(t, c).GetSnapshot()
	if s == nil || len(s.Vehicles) != 2 || s.Source != "synthetic" {
		t.Fatalf("instantané initial : %v", s)
	}
	if v := s.Vehicles[0]; v.Id == "a" && v.Speed != 10 {
		t.Errorf("vitesse arrondie : %v", v.Speed)
	}

	// Zone autour du centre de Paris : seul « a »
	write(t, c, subscribe(&pb.BBox{West: 2.3, South: 48.84, East: 2.4, North: 48.88}))
	s = read(t, c).GetSnapshot()
	if len(s.GetVehicles()) != 1 || s.Vehicles[0].Id != "a" {
		t.Fatalf("instantané de la zone : %v", s)
	}

	// « a » avance, « c » apparaît dans la zone, « b » bouge hors zone (ignoré)
	moved := paris
	moved.Lon = 2.36
	c3 := position.Vehicle{ID: "c", RouteID: "IDFM:C1", Lat: 48.85, Lon: 2.31}
	far := defense
	far.Lon = 2.25
	h.Update([]position.Vehicle{moved, c3, far}, time.Now(), time.Now())
	d := read(t, c).GetDelta()
	if len(d.GetUpserts()) != 2 || len(d.GetRemoved()) != 0 {
		t.Fatalf("delta : %v", d)
	}
	// « a » disparaît (terminus), rien d'autre ne change
	h.Update([]position.Vehicle{c3, far}, time.Now(), time.Now())
	d = read(t, c).GetDelta()
	if len(d.GetUpserts()) != 0 || len(d.GetRemoved()) != 1 || d.Removed[0] != "a" {
		t.Fatalf("delta de retrait : %v", d)
	}

	// Filtre par ligne
	write(t, c, subscribe(nil, "IDFM:C2"))
	if s = read(t, c).GetSnapshot(); len(s.GetVehicles()) != 1 || s.Vehicles[0].Id != "b" {
		t.Fatalf("filtre par ligne : %v", s)
	}
	if v, ok := h.Vehicle("c"); !ok || v.RouteId != "IDFM:C1" {
		t.Errorf("Vehicle(c) = %v", v)
	}
	if clients, vehicles := h.Stats(); clients != 1 || vehicles != 2 {
		t.Errorf("stats : %d clients, %d véhicules", clients, vehicles)
	}
}

func TestInvalidSubscribeCloses(t *testing.T) {
	_, url := setup(t)
	for name, m := range map[string]*pb.ClientMessage{
		"bbox inversée":  subscribe(&pb.BBox{West: 3, East: 2, South: 48, North: 49}),
		"bbox NaN":       subscribe(&pb.BBox{West: float32(math.NaN()), East: 2, South: 48, North: 49}),
		"trop de lignes": subscribe(nil, make([]string, 65)...),
	} {
		c := dial(t, url)
		read(t, c) // instantané
		write(t, c, m)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_, _, err := c.Read(ctx)
		cancel()
		if err == nil {
			t.Errorf("%s : la connexion devrait être fermée", name)
		}
	}
}

func TestLimits(t *testing.T) {
	h, url := setup(t)
	h.MaxPerIP = 1
	c := dial(t, url)
	read(t, c)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, resp, err := websocket.Dial(ctx, url, nil)
	if err == nil || resp == nil || resp.StatusCode != http.StatusTooManyRequests {
		t.Errorf("2e connexion depuis la même IP : %v", err)
	}

	// Origine non autorisée
	h2 := New("synthetic", []string{"localhost:3000"})
	srv := httptest.NewServer(h2)
	defer srv.Close()
	_, resp, err = websocket.Dial(ctx, "ws"+strings.TrimPrefix(srv.URL, "http"), &websocket.DialOptions{
		HTTPHeader: http.Header{"Origin": []string{"https://malveillant.example"}},
	})
	if err == nil || resp == nil || resp.StatusCode != http.StatusForbidden {
		t.Errorf("origine refusée attendue : %v", err)
	}
}

func TestSlowClientDropped(t *testing.T) {
	// File pleine : le message suivant annule la connexion au lieu d'attendre
	h := New("synthetic", nil)
	cancelled := false
	c := &client{send: make(chan []byte, 1), cancel: func() { cancelled = true }, sent: map[string]*pb.Vehicle{}}
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
	h.Update([]position.Vehicle{paris}, time.Now(), time.Now())
	if cancelled {
		t.Fatal("annulé alors que la file avait de la place")
	}
	h.Update([]position.Vehicle{defense}, time.Now(), time.Now())
	if !cancelled {
		t.Error("le client lent aurait dû être déconnecté")
	}
}
