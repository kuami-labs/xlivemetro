package gtfs

import "math"

const earthRadiusM = 6371008.8

// Point est une coordonnée WGS 84.
type Point struct{ Lat, Lon float64 }

// Distance renvoie la distance orthodromique en mètres (formule de haversine).
func Distance(a, b Point) float64 {
	la1, la2 := a.Lat*math.Pi/180, b.Lat*math.Pi/180
	dLat := la2 - la1
	dLon := (b.Lon - a.Lon) * math.Pi / 180
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(la1)*math.Cos(la2)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return 2 * earthRadiusM * math.Asin(math.Min(1, math.Sqrt(h)))
}

// Polyline est un tracé avec ses distances cumulées (en mètres) à chaque sommet.
type Polyline struct {
	Points []Point
	Cum    []float64
}

// NewPolyline calcule les distances cumulées d'un tracé.
func NewPolyline(pts []Point) Polyline {
	cum := make([]float64, len(pts))
	for i := 1; i < len(pts); i++ {
		cum[i] = cum[i-1] + Distance(pts[i-1], pts[i])
	}
	return Polyline{Points: pts, Cum: cum}
}

// Length renvoie la longueur totale du tracé.
func (p Polyline) Length() float64 {
	if len(p.Cum) == 0 {
		return 0
	}
	return p.Cum[len(p.Cum)-1]
}

// Project renvoie la distance le long du tracé du point le plus proche de q,
// en ne cherchant qu'au-delà de minDist (les arrêts d'une course avancent le long du tracé).
// À l'échelle d'une ville, une projection plane locale (équirectangulaire) suffit.
func (p Polyline) Project(q Point, minDist float64) float64 {
	if len(p.Points) < 2 {
		return 0
	}
	cosLat := math.Cos(q.Lat * math.Pi / 180)
	toXY := func(a Point) (float64, float64) {
		return (a.Lon - q.Lon) * cosLat, a.Lat - q.Lat
	}
	best, bestD2 := minDist, math.Inf(1)
	for i := 0; i+1 < len(p.Points); i++ {
		if p.Cum[i+1] < minDist {
			continue
		}
		ax, ay := toXY(p.Points[i])
		bx, by := toXY(p.Points[i+1])
		dx, dy := bx-ax, by-ay
		t := 0.0
		if l2 := dx*dx + dy*dy; l2 > 0 {
			t = math.Max(0, math.Min(1, -(ax*dx+ay*dy)/l2))
		}
		px, py := ax+t*dx, ay+t*dy
		d2 := px*px + py*py
		along := p.Cum[i] + t*(p.Cum[i+1]-p.Cum[i])
		if along < minDist {
			along = minDist
		}
		if d2 < bestD2 {
			best, bestD2 = along, d2
		}
	}
	return best
}

// At renvoie le point situé à la distance d le long du tracé, et le cap (degrés, 0 = nord).
func (p Polyline) At(d float64) (Point, float64) {
	n := len(p.Points)
	if n == 0 {
		return Point{}, 0
	}
	if n == 1 || d <= 0 {
		return p.Points[0], p.bearing(0)
	}
	if d >= p.Length() {
		return p.Points[n-1], p.bearing(n - 2)
	}
	// Recherche dichotomique du segment
	lo, hi := 0, n-1
	for hi-lo > 1 {
		mid := (lo + hi) / 2
		if p.Cum[mid] <= d {
			lo = mid
		} else {
			hi = mid
		}
	}
	seg := p.Cum[hi] - p.Cum[lo]
	t := 0.0
	if seg > 0 {
		t = (d - p.Cum[lo]) / seg
	}
	a, b := p.Points[lo], p.Points[hi]
	return Point{Lat: a.Lat + t*(b.Lat-a.Lat), Lon: a.Lon + t*(b.Lon-a.Lon)}, p.bearing(lo)
}

func (p Polyline) bearing(i int) float64 {
	if i < 0 || i+1 >= len(p.Points) {
		return 0
	}
	a, b := p.Points[i], p.Points[i+1]
	la1, la2 := a.Lat*math.Pi/180, b.Lat*math.Pi/180
	dLon := (b.Lon - a.Lon) * math.Pi / 180
	y := math.Sin(dLon) * math.Cos(la2)
	x := math.Cos(la1)*math.Sin(la2) - math.Sin(la1)*math.Cos(la2)*math.Cos(dLon)
	return math.Mod(math.Atan2(y, x)*180/math.Pi+360, 360)
}
