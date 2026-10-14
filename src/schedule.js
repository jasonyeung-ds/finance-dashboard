import { eventDate, formatTime, money, monthlyDateIn, startOfDay } from './dates.js';

/**
 * Everything that happens between `from` and `to` (inclusive, by day):
 * each card's payment due date and statement closing date for every month in
 * the range, plus your important dates. Sorted by date.
 */
export function buildSchedule({ cards, events, from, to }) {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const items = [];

  // Card dates repeat monthly, so generate them for each month the range touches.
  for (
    let month = new Date(start.getFullYear(), start.getMonth(), 1);
    month <= end;
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  ) {
    const y = month.getFullYear();
    const m = month.getMonth();
    for (const c of cards) {
      const due = monthlyDateIn(c.dueDay, y, m);
      if (due >= start && due <= end) {
        items.push({
          key: `${c.id}-due-${y}-${m}`,
          kind: 'due',
          date: due,
          allDay: true,
          title: `${c.name} payment due`,
          short: `${c.name} due`,
          detail: c.minPayment
            ? `Min ${money(c.minPayment)} · Balance ${money(c.balance)}`
            : `Balance ${money(c.balance)}`,
        });
      }
      const stmt = monthlyDateIn(c.statementDay, y, m);
      if (stmt >= start && stmt <= end) {
        items.push({
          key: `${c.id}-stmt-${y}-${m}`,
          kind: 'statement',
          date: stmt,
          allDay: true,
          title: `${c.name} statement closes`,
          short: `${c.name} statement`,
        });
      }
    }
  }

  for (const e of events) {
    const date = eventDate(e);
    const day = startOfDay(date);
    if (day < start || day > end) continue;
    const title = e.title || 'Untitled';
    items.push({
      key: e.id,
      kind: 'event',
      date,
      allDay: !e.time,
      title,
      short: e.time ? `${formatTime(e.time)} ${title}` : title,
      detail: [formatTime(e.time), e.notes].filter(Boolean).join(' · '),
    });
  }

  return items.sort((a, b) => a.date - b.date);
}

export const KIND_LABELS = { due: 'Payment', statement: 'Statement', event: 'Event' };
