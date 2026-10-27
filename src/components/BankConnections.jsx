import { timeAgo } from '../dates.js';

/** Small "Synced 5 min ago · Sync now" line, shown above the card list on the Overview. */
export function SyncStatus({ plaid }) {
  const items = plaid.status?.items ?? [];
  if (!plaid.status?.configured || items.length === 0) return null;
  const oldest = items.map((i) => i.lastSynced).sort()[0];
  return (
    <div className="sync-status small">
      <span className="muted">Bank data synced {timeAgo(oldest)}</span>
      <button className="secondary" onClick={plaid.sync} disabled={plaid.busy !== null}>
        {plaid.busy === 'sync' ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  );
}

export default function BankConnections({ plaid }) {
  const { status, busy } = plaid;
  if (!status) return null;

  if (!status.configured) {
    return (
      <section className="panel">
        <div className="panel-header">
          <h2>Bank connections</h2>
        </div>
        <div className="empty">
          <p>
            Connect a bank to pull balances, limits, and due dates automatically. To set it up, create a file named{' '}
            <code>.env</code> with your Plaid keys:
          </p>
          <pre className="code-block">{'PLAID_ENV=sandbox\nPLAID_CLIENT_ID=your_client_id\nPLAID_SECRET=your_sandbox_secret'}</pre>
          <p className="small">
            Put it in the project folder for <code>npm run dev</code>, or in <code>%APPDATA%\Finance Dashboard\</code>{' '}
            for the desktop app. Then restart. Manual cards keep working either way.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>
          Bank connections{' '}
          {status.env !== 'production' && <span className="badge badge-statement">{status.env}</span>}
        </h2>
        <div className="header-actions">
          {status.items.length > 0 && (
            <button className="secondary" onClick={plaid.sync} disabled={busy !== null}>
              {busy === 'sync' ? 'Syncing…' : 'Sync now'}
            </button>
          )}
          <button onClick={plaid.connect} disabled={busy !== null}>
            {busy === 'connect' ? 'Connecting…' : '+ Connect a bank'}
          </button>
        </div>
      </div>

      {status.env === 'sandbox' && (
        <p className="muted small">
          Sandbox uses fake banks. Pick any bank and log in with username <code>user_good</code> and password{' '}
          <code>pass_good</code>.
        </p>
      )}

      {status.items.length === 0 ? (
        <p className="empty">No banks connected yet.</p>
      ) : (
        <ul className="event-list">
          {status.items.map((item) => (
            <li key={item.itemId} className="event-row">
              <div className="event-main">
                <strong>{item.institution}</strong>
                {item.lastError ? (
                  <span className="bad small">{item.lastError}</span>
                ) : (
                  <span className="muted small">Synced {timeAgo(item.lastSynced)}</span>
                )}
              </div>
              <div className="row-actions">
                <button
                  className="link danger"
                  disabled={busy !== null}
                  onClick={() =>
                    window.confirm(
                      `Disconnect ${item.institution}? Its cards stay in your list as manual cards and stop updating.`,
                    ) && plaid.disconnect(item.itemId)
                  }
                >
                  {busy === item.itemId ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
