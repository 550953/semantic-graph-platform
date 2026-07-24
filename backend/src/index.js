import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

import { initPool, queryAll, queryOne, queryRun, withTransaction } from './db/pool.js';
import { validateSecrets, wsId, graphId, validateWorkspaceAccess, jparse, jstr } from './utils/helper.js';
import { seedIfEmpty } from './db/seed.js';
import { authOptional, authRequired } from './middleware/auth.js';
import { securityHeaders, rateLimit } from './middleware/security.js';
import { listMachines, getAllowedTransitions, transition } from './engines/fsm.js';
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
const PORT = process.env.PORT || 3001;

async function main() {
  // Load DATABASE_URL from Infisical if needed, then connect
  await initPool();

  validateSecrets();

  const app = express();

  app.use(cors({ origin: process.env.NODE_ENV === 'production' ? false : true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(securityHeaders);
  app.use(rateLimit({ windowMs: 60000, max: 180 }));
  app.use(authOptional);

  // ── API routes ────────────────────────────────────────────────────────────
  app.use('/api', graphsRoutes);
  app.use('/api', authRoutes);
  app.use('/api', adminRoutes);
  app.use('/api', workspacesRoutes);
  app.use('/api', graphRoutes);
  app.use('/api', copilotRoutes);
  app.use('/api', ragRoutes);
  app.use('/api', ratingsRoutes);

  // Health
  app.get('/api/health', (_, res) => {
    const key = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
    res.json({
      ok: true, version: '2.4.0', db: 'postgresql',
      llmConfigured: !!key,
      llmProvider: process.env.OPENAI_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      engines: ['Graph', 'FSM', 'Review', 'Ontology', 'RAG', 'LLM-Gateway', 'Auth', 'Workspace', 'Templates'],
      tenantIsolation: 'strict'
    });
  });

  // FSM
  app.get('/api/fsm/machines', async (req, res) => {
    try { res.json(listMachines(wsId(req))); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/fsm/:id/transitions', async (req, res) => {
    try {
      const allowed = getAllowedTransitions(req.params.id, req.query.status || 'open', wsId(req));
      res.json({ type: req.params.id, allowed });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/fsm/:id/transition', authRequired, async (req, res) => {
    try { res.json(transition(req.params.id, req.body.from, req.body.event, wsId(req))); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Ontology
  app.get('/api/ontology', async (req, res) => {
    try {
      const wid = wsId(req);
      const gid = graphId(req);
      const row = gid
        ? await queryOne('SELECT * FROM ontology WHERE workspace_id = ? AND graph_id = ?', [wid, gid])
        : await queryOne('SELECT * FROM ontology WHERE workspace_id = ?', [wid]);
      res.json(row ? loadProfile(jparse(row.profile_json, null)) : DEFAULT_PROFILE);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/ontology/extend', authRequired, async (req, res) => {
    try {
      const wid = wsId(req);
      const gid = graphId(req);
      const row = await queryOne('SELECT * FROM ontology WHERE workspace_id = ? AND graph_id = ?', [wid, gid]);
      const current = row ? jparse(row.profile_json, null) : null;
      const updated = extendProfile(current, req.body);
      if (row) {
        await queryRun('UPDATE ontology SET profile_json = ? WHERE workspace_id = ? AND graph_id = ?', [jstr(updated), wid, gid]);
      } else {
        await queryRun('INSERT INTO ontology (workspace_id, graph_id, profile_json) VALUES (?, ?, ?)', [wid, gid, jstr(updated)]);
      }
      res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Actors (CREATE)
  app.post('/api/actors', authRequired, async (req, res) => {
    try {
      const wid = wsId(req);
      if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
      const { type, name, roles } = req.body || {};
      const id = randomUUID();
      await queryRun('INSERT INTO actors (id, workspace_id, type, name, roles_json) VALUES (?, ?, ?, ?, ?)',
        [id, wid, type || 'Human', name || 'Actor', jstr(roles || [])]);
      res.status(201).json({ id, type, name, roles });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Nodes CREATE/UPDATE/DELETE
  app.post('/api/graph/nodes', authRequired, async (req, res) => {
    try {
      const wid = wsId(req);
      const gid = graphId(req);
      if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
      const { tab, label, kind, layer, nodeKind, description, badge, projectId } = req.body || {};
      if (!label) return res.status(400).json({ error: 'label required' });
      const id = randomUUID();
      await queryRun(
        'INSERT INTO nodes (id, workspace_id, project_id, graph_id, tab, label, kind, layer, node_kind, description, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, wid, projectId || null, gid || null, tab || null, label, kind || '', layer || 'Knowledge', nodeKind || 'domain', description || '', badge || null]
      );
      res.status(201).json({ id, tab, label, kind, layer, nodeKind, description, badge, workspaceId: wid, graphId: gid });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/graph/nodes/:id', authRequired, async (req, res) => {
    try {
      const wid = wsId(req);
      const node = await queryOne('SELECT * FROM nodes WHERE id = ?', [req.params.id]);
      if (!node) return res.status(404).json({ error: 'not found' });
      if (!await validateWorkspaceAccess(req, node.workspace_id)) return res.status(403).json({ error: 'Access denied' });
      const { label, kind, layer, nodeKind, description, badge, tab } = req.body || {};
      await queryRun(
        'UPDATE nodes SET label=?, kind=?, layer=?, node_kind=?, description=?, badge=?, tab=? WHERE id=?',
        [label ?? node.label, kind ?? node.kind, layer ?? node.layer, nodeKind ?? node.node_kind, description ?? node.description, badge ?? node.badge, tab ?? node.tab, node.id]
      );
      res.json({ id: node.id, ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/graph/nodes/:id', authRequired, async (req, res) => {
    try {
      const node = await queryOne('SELECT * FROM nodes WHERE id = ?', [req.params.id]);
      if (!node) return res.status(404).json({ error: 'not found' });
      if (!await validateWorkspaceAccess(req, node.workspace_id)) return res.status(403).json({ error: 'Access denied' });
      await queryRun('DELETE FROM edges WHERE source = ? OR target = ?', [node.id, node.id]);
      await queryRun('DELETE FROM nodes WHERE id = ?', [node.id]);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Edges CREATE/DELETE
  app.post('/api/graph/edges', authRequired, async (req, res) => {
    try {
      const wid = wsId(req);
      const gid = graphId(req);
      if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
      const { source, target, label, tab } = req.body || {};
      if (!source || !target) return res.status(400).json({ error: 'source and target required' });
      const id = randomUUID();
      await queryRun('INSERT INTO edges (id, workspace_id, graph_id, tab, source, target, label) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, wid, gid || null, tab || null, source, target, label || '']);
      res.status(201).json({ id, workspaceId: wid, graphId: gid, tab, source, target, label });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/graph/edges/:id', authRequired, async (req, res) => {
    try {
      const edge = await queryOne('SELECT * FROM edges WHERE id = ?', [req.params.id]);
      if (!edge) return res.status(404).json({ error: 'not found' });
      if (!await validateWorkspaceAccess(req, edge.workspace_id)) return res.status(403).json({ error: 'Access denied' });
      await queryRun('DELETE FROM edges WHERE id = ?', [edge.id]);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Work items
  app.post('/api/work-items', authRequired, async (req, res) => {
    try {
      const wid = wsId(req);
      const gid = graphId(req);
      if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
      const { type, title, status, layer, actorIds, relatedNodeIds, projectId } = req.body || {};
      const id = randomUUID();
      await queryRun(
        'INSERT INTO work_items (id, workspace_id, project_id, graph_id, type, title, status, layer, actor_ids_json, related_node_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, wid, projectId || null, gid || null, type || 'Task', title || '', status || 'open', layer || '', jstr(actorIds || []), jstr(relatedNodeIds || [])]
      );
      res.status(201).json({ id, type, title, status, layer, actorIds, relatedNodeIds });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Reviews
  app.get('/api/reviews', async (req, res) => {
    try {
      const wid = wsId(req);
      if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
      const rows = await queryAll('SELECT * FROM reviews WHERE workspace_id = ? ORDER BY n ASC', [wid]);
      res.json(rows.map(r => ({ ...r, scope: jparse(r.scope_json, {}) })));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/reviews', authRequired, async (req, res) => {
    try {
      const wid = wsId(req);
      if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
      const { scope, text, answer, status, authorId } = req.body || {};
      const id = randomUUID();
      const nRow = await queryOne('SELECT COALESCE(MAX(n), 0) + 1 as next_n FROM reviews WHERE workspace_id = ?', [wid]);
      const n = nRow?.next_n || 1;
      await queryRun('INSERT INTO reviews (id, workspace_id, n, scope_json, author_id, status, text, answer, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, wid, n, jstr(scope || {}), authorId || null, status || 'draft', text || '', answer || '', new Date().toISOString().slice(0, 10)]);
      res.status(201).json({ id, n, ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Role bindings
  app.get('/api/role-bindings', async (req, res) => {
    try {
      const wid = wsId(req);
      if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
      res.json(await queryAll('SELECT * FROM role_bindings WHERE workspace_id = ?', [wid]));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/role-bindings', authRequired, async (req, res) => {
    try {
      const wid = wsId(req);
      if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
      const id = randomUUID();
      const gid = graphId(req);
      await queryRun('INSERT INTO role_bindings (id, workspace_id, graph_id, actor_id, edge_id, role) VALUES (?, ?, ?, ?, ?, ?)',
        [id, wid, gid || null, req.body?.actorId, req.body?.edgeId, req.body?.role]);
      res.status(201).json({ id, ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/role-bindings/:id', authRequired, async (req, res) => {
    try {
      await queryRun('DELETE FROM role_bindings WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Static frontend (production) ──────────────────────────────────────────
  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => res.sendFile(join(frontendDist, 'index.html')));
    console.log(`Serving frontend from ${frontendDist}`);
  } else {
    console.log('No frontend/dist found — API-only mode');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Graph Platform v2.4 (PostgreSQL) http://localhost:${PORT}`);
  });

  // Seed after listen to not block startup
  try {
    const seeded = await seedIfEmpty();
    if (seeded) console.log('PostgreSQL seeded with default data');
  } catch (e) {
    console.error('Seed error (non-fatal):', e.message);
  }
}

main().catch(e => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});

export default {};
