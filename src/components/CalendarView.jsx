import { useState } from 'react';
import { addDays, isSameDay, relativeDay, startOfDay } from '../dates.js';
import { KIND_LABELS, buildSchedule } from '../schedule.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function CalendarView({ cards, events }) {
  const today = startOfDay();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);

  // Show whole weeks: start on the Sunday on/before the 1st, end on the Saturday on/after the last day.
  const gridStart = addDays(month, -month.getDay());
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const gridEnd = addDays(lastOfMonth, 6 - lastOfMonth.getDay());
  const days = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const byDay = new Map();
  for (const item of buildSchedule({ cards, events, from: gridStart, to: gridEnd })) {
    const key = dayKey(item.date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(item);
  }

  const goToMonth = (offset) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + offset, 1));
  const goToToday = () => {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };
  const selectDay = (d) => {
    setSelected(d);
    // Clicking a greyed-out day from the previous/next month jumps to that month.
    if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  // Looked up separately so it still works when the selected day is outside the month on screen.
  const selectedItems = buildSchedule({ cards, events, from: selected, to: selected });

  return (
    <div className="calendar-layout">
      <section className="panel calendar">
        <div className="panel-header">
          <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <div className="header-actions">
            <button className="secondary" onClick={() => goToMonth(-1)} aria-label="Previous month">
              ‹
            </button>
            <button className="secondary" onClick={goToToday}>
              Today
            </button>
            <button className="secondary" onClick={() => goToMonth(1)} aria-label="Next month">
              ›
            </button>
          </div>
        </div>

        <div className="legend small">
          <span><i className="dot dot-due" /> Payment due</span>
          <span><i className="dot dot-statement" /> Statement closes</span>
          <span><i className="dot dot-event" /> Important date</span>
        </div>

        <div className="cal-grid" role="grid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday" role="columnheader">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const items = byDay.get(dayKey(d)) ?? [];
            const classes = [
              'cal-day',
              d.getMonth() !== month.getMonth() && 'outside',
              isSameDay(d, today) && 'today',
              isSameDay(d, selected) && 'selected',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={dayKey(d)}
                className={classes}
                onClick={() => selectDay(d)}
                aria-label={`${d.toDateString()}, ${items.length} item${items.length === 1 ? '' : 's'}`}
                aria-pressed={isSameDay(d, selected)}
              >
                <span className="cal-date">{d.getDate()}</span>
                <span className="cal-chips">
                  {items.slice(0, MAX_CHIPS).map((x) => (
                    <span key={x.key} className={`chip chip-${x.kind}`} title={x.title}>
                      {x.short}
                    </span>
                  ))}
                  {items.length > MAX_CHIPS && <span className="chip-more">+{items.length - MAX_CHIPS} more</span>}
                </span>
                {/* On narrow screens chips are hidden and these dots show instead. */}
                <span className="cal-dots" aria-hidden="true">
                  {items.map((x) => (
                    <i key={x.key} className={`dot dot-${x.kind}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="panel day-detail">
        <div className="panel-header">
          <div>
            <h2>{selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
            <span className="muted small">{relativeDay(selected)}</span>
          </div>
        </div>
        {selectedItems.length === 0 ? (
          <p className="empty">Nothing scheduled.</p>
        ) : (
          <ul className="timeline">
            {selectedItems.map((x) => (
              <li key={x.key} className="timeline-item no-when">
                <div className="timeline-what">
                  <span className={`badge badge-${x.kind}`}>{KIND_LABELS[x.kind]}</span>
                  <span>{x.title}</span>
                  {x.detail && <span className="muted small">{x.detail}</span>}
                  {x.kind === 'event' && x.allDay && <span className="muted small">All day</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
