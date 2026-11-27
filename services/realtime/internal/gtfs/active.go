package gtfs

import "time"

// ActiveServices renvoie les services qui circulent à la date donnée (calendrier + exceptions).
func (f *Feed) ActiveServices(day time.Time) map[string]bool {
	date := day.Format("20060102")
	weekday := (int(day.Weekday()) + 6) % 7 // lundi = 0
	active := map[string]bool{}
	for _, c := range f.Calendars {
		if c.Days[weekday] && c.StartDate <= date && date <= c.EndDate {
			active[c.ServiceID] = true
		}
	}
	for _, d := range f.CalendarDates {
		if d.Date != date {
			continue
		}
		switch d.ExceptionType {
		case 1:
			active[d.ServiceID] = true
		case 2:
			delete(active, d.ServiceID)
		}
	}
	return active
}
