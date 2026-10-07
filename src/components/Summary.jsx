import { formatDate, money, nextMonthlyDate, relativeDay } from '../dates.js';

export function utilizationLevel(pct) {
  if (pct >= 50) return 'bad';
  if (pct >= 30) return 'warn';
  return 'good';
}

export default function Summary({ cards }) {
  const balance = cards.reduce((sum, c) => sum + c.balance, 0);
  const limit = cards.reduce((sum, c) => sum + c.limit, 0);
  const utilization = limit > 0 ? (balance / limit) * 100 : 0;

  const nextDue = cards
    .map((c) => ({ card: c, date: nextMonthlyDate(c.dueDay) }))
    .sort((a, b) => a.date - b.date)[0];

  return (
    <section className="summary">
      <div className="tile">
        <span className="tile-label">Total balance</span>
        <span className="tile-value">{money(balance)}</span>
        <span className="muted">across {cards.length} card{cards.length === 1 ? '' : 's'}</span>
      </div>
      <div className="tile">
        <span className="tile-label">Total credit limit</span>
        <span className="tile-value">{money(limit)}</span>
        <span className="muted">{money(Math.max(0, limit - balance))} available</span>
      </div>
      <div className="tile">
        <span className="tile-label">Overall utilization</span>
        <span className={`tile-value ${utilizationLevel(utilization)}`}>{utilization.toFixed(1)}%</span>
        <span className="muted">under 30% is ideal</span>
      </div>
      <div className="tile">
        <span className="tile-label">Next payment due</span>
        {nextDue ? (
          <>
            <span className="tile-value">{relativeDay(nextDue.date)}</span>
            <span className="muted">
              {nextDue.card.name} · {formatDate(nextDue.date)}
            </span>
          </>
        ) : (
          <span className="tile-value muted">—</span>
        )}
      </div>
    </section>
  );
}
