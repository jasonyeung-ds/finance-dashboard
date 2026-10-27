import { useCallback, useEffect, useRef, useState } from 'react';
import { plaidApi } from './api.js';
import { openPlaidLink } from './plaidLink.js';

const AUTO_SYNC_AFTER_MS = 60 * 60 * 1000; // refresh on open if the last sync is over an hour old

/** Bank connections: status, connect, sync, disconnect. `onCardsChanged` reloads the card list. */
export function usePlaid(setError, onCardsChanged) {
  const [status, setStatus] = useState(null); // { configured, env, items }
  const [busy, setBusy] = useState(null); // 'connect' | 'sync' | an itemId being disconnected
  const autoSynced = useRef(false);

  const run = useCallback(
    async (label, fn) => {
      setBusy(label);
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(null);
      }
    },
    [setError],
  );

  const sync = useCallback(
    () =>
      run('sync', async () => {
        const { items } = await plaidApi.sync();
        setStatus((s) => ({ ...s, items }));
        onCardsChanged();
        const failed = items.filter((i) => i.lastError);
        if (failed.length) throw new Error(failed.map((i) => `${i.institution}: ${i.lastError}`).join(' · '));
      }),
    [run, onCardsChanged],
  );

  useEffect(() => {
    plaidApi
      .status()
      .then((s) => {
        setStatus(s);
        const stale = s.items.some((i) => !i.lastSynced || Date.now() - new Date(i.lastSynced) > AUTO_SYNC_AFTER_MS);
        if (s.configured && stale && !autoSynced.current) {
          autoSynced.current = true;
          sync();
        }
      })
      .catch((e) => setError(e.message));
  }, [setError, sync]);

  const connect = () =>
    run('connect', async () => {
      const { linkToken } = await plaidApi.linkToken();
      const result = await openPlaidLink(linkToken);
      if (!result) return; // closed the window
      const item = await plaidApi.exchange(result.publicToken, result.institution);
      setStatus((s) => ({ ...s, items: [...s.items.filter((i) => i.itemId !== item.itemId), item] }));
      onCardsChanged();
      if (item.lastError) throw new Error(`${item.institution} connected, but syncing failed: ${item.lastError}`);
    });

  const disconnect = (itemId) =>
    run(itemId, async () => {
      await plaidApi.disconnect(itemId);
      setStatus((s) => ({ ...s, items: s.items.filter((i) => i.itemId !== itemId) }));
      onCardsChanged();
    });

  return { status, busy, connect, sync, disconnect };
}
