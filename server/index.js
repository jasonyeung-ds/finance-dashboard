import express from 'express';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 3001;

// ---- JSON file storage -------------------------------------------------

async function load() {
  try {
    const db = JSON.parse(await readFile(DB_PATH, 'utf8'));
    return { cards: [], events: [], ...db };
  } catch (err) {
    if (err.code === 'ENOENT') return { cards: [], events: [] };
    throw err;
  }
}

async function save(db) {
  await mkdir(DATA_DIR, { recursive: true });
  // Write to a temp file then rename, so a crash mid-write can't corrupt the data.
  const tmp = `${DB_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, DB_PATH);
}

// Serialize writes so two quick requests can't overwrite each other.
let queue = Promise.resolve();
function mutate(fn) {
  const run = queue.then(async () => {
    const db = await load();
    const result = fn(db);
    await save(db);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

// ---- Validation --------------------------------------------------------

const text = (v) => (v == null ? '' : String(v).trim());
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const day = (v) => Math.min(31, Math.max(1, Math.round(num(v)) || 1));

const schemas = {
  cards: {
    name: text,
    last4: (v) => text(v).replace(/\D/g, '').slice(-4),
    balance: num,
    limit: num,
    minPayment: num,
    statementDay: day,
    dueDay: day,
    notes: text,
  },
  events: {
    title: text,
    date: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(text(v)) ? text(v) : ''),
    time: (v) => (/^\d{2}:\d{2}$/.test(text(v)) ? text(v) : ''),
    notes: text,
  },
};
const required = { cards: 'name', events: 'date' };

function clean(name, body, partial) {
  const out = {};
  for (const [key, parse] of Object.entries(schemas[name])) {
    if (partial && !(key in body)) continue;
    out[key] = parse(body[key]);
  }
  return out;
}

// ---- Routes ------------------------------------------------------------

function collection(name) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    res.json((await load())[name]);
  });

  router.post('/', async (req, res) => {
    const item = { id: randomUUID(), ...clean(name, req.body ?? {}, false) };
    if (!item[required[name]]) {
      return res.status(400).json({ error: `${required[name]} is required` });
    }
    await mutate((db) => db[name].push(item));
    res.status(201).json(item);
  });

  router.put('/:id', async (req, res) => {
    const changes = clean(name, req.body ?? {}, true);
    const updated = await mutate((db) => {
      const i = db[name].findIndex((x) => x.id === req.params.id);
      if (i === -1) return null;
      db[name][i] = { ...db[name][i], ...changes };
      return db[name][i];
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  });

  router.delete('/:id', async (req, res) => {
    const removed = await mutate((db) => {
      const before = db[name].length;
      db[name] = db[name].filter((x) => x.id !== req.params.id);
      return db[name].length < before;
    });
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  });

  return router;
}

const app = express();
app.use(express.json());
app.use('/api/cards', collection('cards'));
app.use('/api/events', collection('events'));

// After `npm run build`, serve the built app too, so `npm start` is a single process.
app.use(express.static(DIST_DIR));

// Only listen on localhost so nothing else on your network can reach your data.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`API running at http://127.0.0.1:${PORT} (data: ${DB_PATH})`);
});
