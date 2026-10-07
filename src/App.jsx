import { useCallback, useEffect, useState } from 'react';
import { cardsApi, eventsApi } from './api.js';
import Summary from './components/Summary.jsx';
import Upcoming from './components/Upcoming.jsx';
import CardsPanel from './components/CardsPanel.jsx';
import EventsPanel from './components/EventsPanel.jsx';

function useCollection(api, setError) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.list().then(setItems).catch((e) => setError(e.message)).finally(() => setLoaded(true));
  }, [api, setError]);

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

      <Summary cards={cards.items} />

      <div className="grid">
        <div className="col-main">
          <CardsPanel {...cards} />
          <EventsPanel {...events} />
        </div>
        <aside className="col-side">
          <Upcoming cards={cards.items} events={events.items} />
        </aside>
      </div>
    </div>
  );
}
