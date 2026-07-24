import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { 
  getDb, setDb, validateSecrets, wsId, graphId, 
  validateWorkspaceAccess, jparse, jstr 
} from './utils/helper.js';
import { seedIfEmpty } from './db/seed.js';
import { authOptional, authRequired } from './middleware/auth.js';
import { securityHeaders, rateLimit } from './middleware/security.js';
import { listMachines, getMachine, getAllowedTransitions, transition, clearMachinesCache } from './engines/fsm.js';
import { DEFAULT_PROFILE, loadProfile, extendProfile } from './engines/ontology.js';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import workspacesRoutes from './routes/workspaces.js';
import graphRoutes from './routes/graph.js';
import copilotRoutes from './routes/copilot.js';
import ragRoutes from './routes/rag.js';
import ratingsRoutes from './routes/ratings.js';
import graphsRoutes from './routes/graphs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

validateSecrets();

// В production CORS не нужен — фронт раздаётся тем же сервером
// В dev оставляем open для Vite dev-server
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? false : true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(securityHeaders);
app.use(rateLimit({ windowMs: 60000, max: 180 }));
app.use(authOptional);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', graphsRoutes);

const db = getDb();
setDb(db);

const seeded = seedIfEmpty();
if (seeded) console.log('SQLite seeded');

app.get('/api/health', (_, res) => {
  const key = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  res.json({
    ok: true,
    version: '2.4.0',
    db: 'sqlite',
    llmConfigured: !!key,
    llmProvider: process.env.OPENAI_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    engines: ['Graph', 'FSM', 'Review', 'Ontology', 'RAG', 'LLM-Gateway', 'Auth', 'Workspace', 'Templates'],
    tenantIsolation: 'strict'
  });
});

// FSM
app.get('/api/fsm/machines', (req, res) => {
  try {
    const wid = wsId(req);
    res.json(listMachines(wid));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/fsm/:id/transitions', (req, res) => {
  try {
    const wid = wsId(req);
    const allowed = getAllowedTransitions(req.params.id, req.query.status || 'open', wid);
    res.json({ type: req.params.id, allowed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/fsm/:id/transition', authRequired, (req, res) => {
  try {
    const wid = wsId(req);
    res.json(transition(req.params.id, req.body.from, req.body.event, wid));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ontology
app.get('/api/ontology', (req, res) => {
  try {
    const db = getDb();
    const wid = wsId(req);
    const gid = graphId(req);
    const row = gid 
      ? db.prepare('SELECT * FROM ontology WHERE workspace_id = ? AND graph_id = ?').get(wid, gid)
      : db.prepare('SELECT * FROM ontology WHERE workspace_id = ?').get(wid);
    
    res.json(row ? loadProfile(jparse(row.profile_json, null)) : DEFAULT_PROFILE);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ontology/extend', authRequired, (req, res) => {
  try {
    const db = getDb();
    const wid = wsId(req);
    const gid = graphId(req);
    const row = db.prepare('SELECT * FROM ontology WHERE workspace_id = ? AND graph_id = ?').get(wid, gid);
    const current = row ? jparse(row.profile_json, null) : null;
    const extended = extendProfile(current, req.body);
    
    db.prepare('INSERT OR REPLACE INTO ontology (workspace_id, graph_id, profile_json) VALUES (?, ?, ?)')
      .run(wid, gid, jstr(extended));
    
    clearMachinesCache(wid);
    res.json(extended);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reviews
app.get('/api/reviews', (req, res) => {
  try {
    const db = getDb();
    const wid = wsId(req);
    const gid = graphId(req);
    let sql = 'SELECT * FROM reviews WHERE workspace_id = ?';
    const params = [wid];
    if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }
    res.json(db.prepare(sql).all(...params) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/reviews', authRequired, (req, res) => {
  try {
    const db = getDb();
    const wid = wsId(req);
    const gid = graphId(req);
    const id = randomUUID();
    db.prepare('INSERT INTO reviews (id, workspace_id, graph_id, author_id, text, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, wid, gid, req.user?.id, req.body?.text, 'open');
    res.status(201).json({ id, ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Role Bindings
app.get('/api/role-bindings', (req, res) => {
  try {
    const db = getDb();
    const wid = wsId(req);
    const gid = graphId(req);
    let sql = 'SELECT * FROM role_bindings WHERE workspace_id = ?';
    const params = [wid];
    if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }
    res.json(db.prepare(sql).all(...params) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/role-bindings', authRequired, (req, res) => {
  try {
    const db = getDb();
    const wid = wsId(req);
    const gid = graphId(req);
    const id = randomUUID();
    db.prepare('INSERT INTO role_bindings (id, workspace_id, graph_id, actor_id, edge_id, role) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, wid, gid, req.body?.actorId, req.body?.edgeId, req.body?.role);
    res.status(201).json({ id, ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/role-bindings/:id', authRequired, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM role_bindings WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Named API routes
app.use('/api', authRoutes);
app.use('/api', adminRoutes);
app.use('/api', workspacesRoutes);
app.use('/api', graphRoutes);
app.use('/api', copilotRoutes);
app.use('/api', ragRoutes);
app.use('/api', ratingsRoutes);

// ── Static frontend (production) ──────────────────────────────────────────────
// backend/ живёт в корне репо в backend/, фронт собирается в frontend/dist/
const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback — все не-API маршруты → index.html
  app.get('*', (req, res) => {
    res.sendFile(join(frontendDist, 'index.html'));
  });
  console.log(`Serving frontend from ${frontendDist}`);
} else {
  console.log('No frontend/dist found — API-only mode');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Graph Platform v2.4 http://localhost:${PORT}`);
});

export default app;
