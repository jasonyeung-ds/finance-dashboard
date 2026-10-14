import { addDays, daysUntil, formatDate, relativeDay } from '../dates.js';
import { KIND_LABELS, buildSchedule } from '../schedule.js';

export default function Upcoming({ cards, events = [], days = 30, kinds, title }) {
  const now = new Date();
  const items = buildSchedule({ cards, events, from: now, to: addDays(now, days) })
    .filter((x) => !kinds || kinds.includes(x.kind))
    // Drop timed events that already happened earlier today.
    .filter((x) => x.allDay || x.date >= now);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title ?? `Next ${days} days`}</h2>
      </div>
      {items.length === 0 ? (
        <p className="empty">Nothing coming up in the next {days} days.</p>
      ) : (
        <ul className="timeline">
          {items.map((x) => (
            <li key={x.key} className={`timeline-item ${daysUntil(x.date) <= 3 ? 'soon' : ''}`}>
              <div className="timeline-when">
                <strong>{relativeDay(x.date)}</strong>
                <span className="muted">{formatDate(x.date)}</span>
              </div>
              <div className="timeline-what">
                <span className={`badge badge-${x.kind}`}>{KIND_LABELS[x.kind]}</span>
                <span>{x.title}</span>
                {x.detail && <span className="muted small">{x.detail}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
