const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** The date `day` falls on in the given month; clamps e.g. 31 -> 30 in short months. */
export function monthlyDateIn(day, year, month) {
  return new Date(year, month, Math.min(day, daysInMonth(year, month)));
}

/** Next date (today or later) that falls on `day` of the month. */
export function nextMonthlyDate(day, from = new Date()) {
  const today = startOfDay(from);
  for (let offset = 0; offset < 2; offset++) {
    const month = new Date(today.getFullYear(), today.getMonth() + offset, 1); // handles Dec -> Jan
    const date = monthlyDateIn(day, month.getFullYear(), month.getMonth());
    if (date >= today) return date;
  }
  return null;
}

/** Combines an event's "YYYY-MM-DD" date and optional "HH:MM" time into a local Date. */
export function eventDate(event) {
  return new Date(`${event.date}T${event.time || '00:00'}`);
}

export function daysUntil(date, from = new Date()) {
  return Math.round((startOfDay(date) - startOfDay(from)) / DAY_MS);
}

export function relativeDay(date) {
  const n = daysUntil(date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function formatDate(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const money = (n) =>
  Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

/** "just now", "5 min ago", "3 hr ago", "2 days ago" */
export function timeAgo(iso) {
  if (!iso) return 'never';
  const minutes = Math.round((Date.now() - new Date(iso)) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
