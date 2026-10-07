import { useState } from 'react';
import { daysUntil, eventDate, formatDate, formatTime, relativeDay } from '../dates.js';

const EMPTY = { title: '', date: '', time: '', notes: '' };

function EventForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => (initial ? { ...EMPTY, ...initial } : EMPTY));
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const { title, date, time, notes } = form;
    if (await onSave({ title, date, time, notes })) onCancel();
  };

  return (
    <form className="form" onSubmit={submit}>
      <label className="span-2">
        What's happening?
        <input required value={form.title} onChange={set('title')} placeholder="e.g. Rent due, Dentist appointment" autoFocus />
      </label>
      <label>
        Date
        <input required type="date" value={form.date} onChange={set('date')} />
      </label>
      <label>
        Time <span className="muted">(optional)</span>
        <input type="time" value={form.time} onChange={set('time')} />
      </label>
      <label className="span-2">
        Notes
        <input value={form.notes} onChange={set('notes')} />
      </label>
      <div className="form-actions span-2">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit">{initial ? 'Save changes' : 'Add date'}</button>
      </div>
    </form>
  );
}

export default function EventsPanel({ items, loaded, add, update, remove }) {
  const [editing, setEditing] = useState(null); // null | 'new' | event id
  const [showPast, setShowPast] = useState(false);

  const now = new Date();
  // An event with no time counts as upcoming for the whole day.
  const isPast = (e) => (e.time ? eventDate(e) < now : daysUntil(eventDate(e)) < 0);
  const sorted = [...items].sort((a, b) => eventDate(a) - eventDate(b));
  const upcoming = sorted.filter((e) => !isPast(e));
  const past = sorted.filter(isPast).reverse();
  const visible = showPast ? past : upcoming;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Important dates</h2>
        <div className="header-actions">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={!showPast} className={!showPast ? 'active' : ''} onClick={() => setShowPast(false)}>
              Upcoming ({upcoming.length})
            </button>
            <button role="tab" aria-selected={showPast} className={showPast ? 'active' : ''} onClick={() => setShowPast(true)}>
              Past ({past.length})
            </button>
          </div>
          {editing !== 'new' && <button onClick={() => setEditing('new')}>+ Add date</button>}
        </div>
      </div>

      {editing === 'new' && <EventForm onSave={add} onCancel={() => setEditing(null)} />}

      {loaded && visible.length === 0 && editing !== 'new' && (
        <p className="empty">{showPast ? 'No past dates.' : 'No upcoming dates. Add bills, appointments, or deadlines.'}</p>
      )}

      <ul className="event-list">
        {visible.map((e) =>
          editing === e.id ? (
            <li key={e.id}>
              <EventForm initial={e} onSave={(data) => update(e.id, data)} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={e.id} className={`event-row ${!showPast && daysUntil(eventDate(e)) <= 3 ? 'soon' : ''}`}>
              <div className="event-date">
                <span className="event-month">{eventDate(e).toLocaleDateString(undefined, { month: 'short' })}</span>
                <span className="event-day">{eventDate(e).getDate()}</span>
              </div>
              <div className="event-main">
                <strong>{e.title}</strong>
                <span className="muted small">
                  {formatDate(eventDate(e))}
                  {e.time && ` at ${formatTime(e.time)}`} · {relativeDay(eventDate(e))}
                </span>
                {e.notes && <span className="muted small">{e.notes}</span>}
              </div>
              <div className="row-actions">
                <button className="link" onClick={() => setEditing(e.id)}>
                  Edit
                </button>
                <button className="link danger" onClick={() => window.confirm(`Delete "${e.title}"?`) && remove(e.id)}>
                  Delete
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
