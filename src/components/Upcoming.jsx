import { daysUntil, eventDate, formatDate, formatTime, money, nextMonthlyDate, relativeDay } from '../dates.js';

const WINDOW_DAYS = 30;

export default function Upcoming({ cards, events }) {
  const now = new Date();
  const items = [
    ...cards.flatMap((c) => [
      {
        key: `${c.id}-due`,
        kind: 'due',
        date: nextMonthlyDate(c.dueDay),
        title: `${c.name} payment due`,
        detail: c.minPayment ? `Min ${money(c.minPayment)} · Balance ${money(c.balance)}` : `Balance ${money(c.balance)}`,
      },
      {
        key: `${c.id}-stmt`,
        kind: 'statement',
        date: nextMonthlyDate(c.statementDay),
        title: `${c.name} statement closes`,
      },
    ]),
    ...events
      .map((e) => ({
        key: e.id,
        kind: 'event',
        date: eventDate(e),
        allDay: !e.time,
        title: e.title || 'Untitled',
        detail: [formatTime(e.time), e.notes].filter(Boolean).join(' · '),
      }))
      .filter((e) => (e.allDay ? daysUntil(e.date) >= 0 : e.date >= now)),
  ]
    .filter((x) => daysUntil(x.date) <= WINDOW_DAYS)
    .sort((a, b) => a.date - b.date);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Next {WINDOW_DAYS} days</h2>
      </div>
      {items.length === 0 ? (
        <p className="empty">Nothing coming up. Add a card or an important date to see it here.</p>
      ) : (
        <ul className="timeline">
          {items.map((x) => {
            const days = daysUntil(x.date);
            return (
              <li key={x.key} className={`timeline-item kind-${x.kind} ${days <= 3 ? 'soon' : ''}`}>
                <div className="timeline-when">
                  <strong>{relativeDay(x.date)}</strong>
                  <span className="muted">{formatDate(x.date)}</span>
                </div>
                <div className="timeline-what">
                  <span className={`badge badge-${x.kind}`}>
                    {x.kind === 'due' ? 'Payment' : x.kind === 'statement' ? 'Statement' : 'Event'}
                  </span>
                  <span>{x.title}</span>
                  {x.detail && <span className="muted small">{x.detail}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
