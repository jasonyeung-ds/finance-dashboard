import { useCallback, useEffect, useState } from 'react';
import { cardsApi, eventsApi } from './api.js';
import Summary from './components/Summary.jsx';
import Upcoming from './components/Upcoming.jsx';
import CardsPanel from './components/CardsPanel.jsx';
import EventsPanel from './components/EventsPanel.jsx';
import CalendarView from './components/CalendarView.jsx';
import BankConnections, { SyncStatus } from './components/BankConnections.jsx';
import { usePlaid } from './usePlaid.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'manage', label: 'Manage' },
];

// The current tab lives in the URL (#calendar etc.), so refreshing keeps you on the same tab.
function useHashTab() {
  const read = () => {
    const hash = window.location.hash.slice(1);
    return TABS.some((t) => t.id === hash) ? hash : TABS[0].id;
  };
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const onChange = () => setTab(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return [tab, (id) => (window.location.hash = id)];
}

function useCollection(api, setError) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(
    () => api.list().then(setItems).catch((e) => setError(e.message)).finally(() => setLoaded(true)),
    [api, setError],
  );
  useEffect(() => {
    reload();
  }, [reload]);

  const wrap = useCallback(
    (fn) => async (...args) => {
      try {
        setError(null);
        await fn(...args);
        return true;
      } catch (e) {
        setError(e.message);
        return false;
      }
    },
    [setError],
  );

  return {
    items,
    loaded,
    reload,
    add: wrap(async (data) => {
      const item = await api.create(data);
      setItems((xs) => [...xs, item]);
    }),
    update: wrap(async (id, data) => {
      const item = await api.update(id, data);
      setItems((xs) => xs.map((x) => (x.id === id ? item : x)));
    }),
    remove: wrap(async (id) => {
      await api.remove(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
    }),
  };
}

export default function App() {
  const [error, setError] = useState(null);
  const cards = useCollection(cardsApi, setError);
  const events = useCollection(eventsApi, setError);
  const [tab, setTab] = useHashTab();
  const plaid = usePlaid(setError, cards.reload);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Finance Dashboard</h1>
        <p className="muted">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
          {error.includes('Failed to fetch') || error.includes('500')
            ? ' — is the API server running? Start everything with `npm run dev`.'
            : ''}
          <button className="link" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <nav className="main-tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <Summary cards={cards.items} />
          <div className="grid">
            <div className="col-main">
              <CardsPanel
                {...cards}
                readOnly
                headerExtra={<SyncStatus plaid={plaid} />}
                emptyAction={<button onClick={() => setTab('manage')}>Add your first card</button>}
              />
            </div>
            <aside className="col-side">
              <Upcoming cards={cards.items} kinds={['due', 'statement']} title="Upcoming card dates" />
            </aside>
          </div>
        </>
      )}

      {tab === 'calendar' && <CalendarView cards={cards.items} events={events.items} />}

      {tab === 'manage' && (
        <div className="manage">
          <BankConnections plaid={plaid} />
          <CardsPanel {...cards} />
          <EventsPanel {...events} />
        </div>
      )}
    </div>
  );
}
