import { useState } from 'react';
import { formatDate, money, nextMonthlyDate, ordinal, relativeDay } from '../dates.js';
import { utilizationLevel } from './Summary.jsx';

const EMPTY = { name: '', last4: '', balance: '', limit: '', minPayment: '', statementDay: '', dueDay: '', notes: '' };

function CardForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() =>
    initial ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, initial[k] ?? ''])) : EMPTY,
  );
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const ok = await onSave({
      ...form,
      balance: Number(form.balance) || 0,
      limit: Number(form.limit) || 0,
      minPayment: Number(form.minPayment) || 0,
      statementDay: Number(form.statementDay),
      dueDay: Number(form.dueDay),
    });
    if (ok) onCancel();
  };

  return (
    <form className="form" onSubmit={submit}>
      <label className="span-2">
        Card name
        <input required value={form.name} onChange={set('name')} placeholder="e.g. Chase Sapphire" autoFocus />
      </label>
      <label>
        Last 4 digits <span className="muted">(optional)</span>
        <input value={form.last4} onChange={set('last4')} inputMode="numeric" maxLength={4} pattern="\d{4}" />
      </label>
      <label>
        Current balance ($)
        <input type="number" step="0.01" min="0" value={form.balance} onChange={set('balance')} />
      </label>
      <label>
        Credit limit ($)
        <input type="number" step="0.01" min="0" value={form.limit} onChange={set('limit')} />
      </label>
      <label>
        Minimum payment ($)
        <input type="number" step="0.01" min="0" value={form.minPayment} onChange={set('minPayment')} />
      </label>
      <label>
        Statement closes on day
        <input required type="number" min="1" max="31" value={form.statementDay} onChange={set('statementDay')} placeholder="1–31" />
      </label>
      <label>
        Payment due on day
        <input required type="number" min="1" max="31" value={form.dueDay} onChange={set('dueDay')} placeholder="1–31" />
      </label>
      <label className="span-2">
        Notes
        <input value={form.notes} onChange={set('notes')} placeholder="Autopay on, rewards category, etc." />
      </label>
      <div className="form-actions span-2">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit">{initial ? 'Save changes' : 'Add card'}</button>
      </div>
    </form>
  );
}

export default function CardsPanel({ items, loaded, add, update, remove }) {
  const [editing, setEditing] = useState(null); // null | 'new' | card id

  const sorted = [...items].sort((a, b) => nextMonthlyDate(a.dueDay) - nextMonthlyDate(b.dueDay));

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Credit cards</h2>
        {editing !== 'new' && <button onClick={() => setEditing('new')}>+ Add card</button>}
      </div>

      {editing === 'new' && <CardForm onSave={add} onCancel={() => setEditing(null)} />}

      {loaded && items.length === 0 && editing !== 'new' && (
        <p className="empty">No cards yet. Add one to start tracking balances and due dates.</p>
      )}

      <ul className="card-list">
        {sorted.map((c) => {
          if (editing === c.id) {
            return (
              <li key={c.id}>
                <CardForm initial={c} onSave={(data) => update(c.id, data)} onCancel={() => setEditing(null)} />
              </li>
            );
          }
          const util = c.limit > 0 ? (c.balance / c.limit) * 100 : 0;
          const due = nextMonthlyDate(c.dueDay);
          const stmt = nextMonthlyDate(c.statementDay);
          return (
            <li key={c.id} className="card-row">
              <div className="card-main">
                <div className="card-title">
                  <strong>{c.name}</strong>
                  {c.last4 && <span className="muted"> •••• {c.last4}</span>}
                </div>
                <div className="card-balance">
                  {money(c.balance)}
                  {c.limit > 0 && <span className="muted small"> of {money(c.limit)}</span>}
                </div>
                {c.limit > 0 && (
                  <div className="meter" title={`${util.toFixed(1)}% utilization`}>
                    <div className={`meter-fill ${utilizationLevel(util)}`} style={{ width: `${Math.min(100, util)}%` }} />
                  </div>
                )}
                {c.notes && <div className="muted small">{c.notes}</div>}
              </div>
              <dl className="card-dates">
                <div>
                  <dt>Statement closes</dt>
                  <dd>
                    {formatDate(stmt)} <span className="muted small">({relativeDay(stmt)})</span>
                  </dd>
                  <dd className="muted small">every {ordinal(c.statementDay)}</dd>
                </div>
                <div>
                  <dt>Payment due</dt>
                  <dd>
                    {formatDate(due)} <span className="muted small">({relativeDay(due)})</span>
                  </dd>
                  <dd className="muted small">
                    every {ordinal(c.dueDay)}
                    {c.minPayment > 0 && ` · min ${money(c.minPayment)}`}
                  </dd>
                </div>
              </dl>
              <div className="row-actions">
                <button className="link" onClick={() => setEditing(c.id)}>
                  Edit
                </button>
                <button
                  className="link danger"
                  onClick={() => window.confirm(`Delete ${c.name}?`) && remove(c.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
