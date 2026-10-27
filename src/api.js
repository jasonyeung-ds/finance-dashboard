async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  } catch {
    throw new Error('Could not reach the server. Start it with `npm run dev`.');
  }
  if (res.status >= 500 && !res.headers.get('content-type')?.includes('json')) {
    throw new Error('The API server is not responding. Start it with `npm run dev`.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

function resource(name) {
  const base = `/api/${name}`;
  return {
    list: () => request(base),
    create: (data) => request(base, { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`${base}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`${base}/${id}`, { method: 'DELETE' }),
  };
}

export const cardsApi = resource('cards');
export const eventsApi = resource('events');

const post = (url, data = {}) => request(url, { method: 'POST', body: JSON.stringify(data) });

export const plaidApi = {
  status: () => request('/api/plaid/status'),
  linkToken: () => post('/api/plaid/link-token'),
  exchange: (publicToken, institution) => post('/api/plaid/exchange', { publicToken, institution }),
  sync: () => post('/api/plaid/sync'),
  disconnect: (itemId) => request(`/api/plaid/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
};
