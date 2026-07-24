import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { getDb, wsId, graphId, validateWorkspaceAccess, validateGraphAccess, jparse } from '../utils/helper.js';

const router = Router();

router.get('/graph/nodes', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  const gid = graphId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  
  let sql = 'SELECT * FROM nodes WHERE workspace_id = ?';
  const params = [wid];
  if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }
  if (req.query.tab) { sql += ' AND tab = ?'; params.push(req.query.tab); }
  if (req.query.layer) { sql += ' AND layer = ?'; params.push(req.query.layer); }
  
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(n => ({
    id: n.id, tab: n.tab, label: n.label, kind: n.kind, layer: n.layer,
    nodeKind: n.node_kind, description: n.description, badge: n.badge,
    workspaceId: n.workspace_id, projectId: n.project_id, graphId: n.graph_id
  })));
});

router.get('/graph/edges', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  const gid = graphId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  
  let sql = 'SELECT * FROM edges WHERE workspace_id = ?';
  const params = [wid];
  if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }
  if (req.query.tab) { sql += ' AND tab = ?'; params.push(req.query.tab); }
  res.json(db.prepare(sql).all(...params));
});

router.get('/graph/neighbors/:id', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  const gid = graphId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  
  let sql = 'SELECT * FROM edges WHERE workspace_id = ?';
  const params = [wid];
  if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }
  
  const id = req.params.id;
  const related = new Set([id]);
  const edges = db.prepare(sql).all(...params);
  for (const e of edges) {
    if (e.source === id) related.add(e.target);
    if (e.target === id) related.add(e.source);
  }
  res.json({ nodeId: id, neighbors: [...related] });
});

router.get('/actors', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  const gid = graphId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  
  let sql = 'SELECT * FROM actors WHERE workspace_id = ?';
  const params = [wid];
  if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(a => ({ id: a.id, type: a.type, name: a.name, roles: jparse(a.roles_json, []), graphId: a.graph_id })));
});

router.get('/interest-scope/:actorId', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  const gid = graphId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  
  const actor = db.prepare('SELECT * FROM actors WHERE id = ? AND workspace_id = ?').get(req.params.actorId, wid);
  if (!actor) return res.status(404).json({ error: 'not found' });
  
  let wiSql = 'SELECT * FROM work_items WHERE workspace_id = ?';
  const wiParams = [wid];
  if (gid) { wiSql += ' AND graph_id = ?'; wiParams.push(gid); }
  
  const wis = db.prepare(wiSql).all(...wiParams).filter(w => jparse(w.actor_ids_json, []).includes(actor.id));
  const nodeIds = new Set();
  wis.forEach(w => jparse(w.related_node_ids_json, []).forEach(id => nodeIds.add(id)));
  
  let edgeSql = 'SELECT * FROM edges WHERE workspace_id = ?';
  const edgeParams = [wid];
  if (gid) { edgeSql += ' AND graph_id = ?'; edgeParams.push(gid); }
  
  const edges = db.prepare(edgeSql).all(...edgeParams);
  [...nodeIds].forEach(id => {
    for (const e of edges) {
      if (e.source === id) nodeIds.add(e.target);
      if (e.target === id) nodeIds.add(e.source);
    }
  });
  res.json({ actorId: actor.id, roles: jparse(actor.roles_json, []), nodeIds: [...nodeIds], workItemIds: wis.map(w => w.id) });
});

router.get('/work-items', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  const gid = graphId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  
  let sql = 'SELECT * FROM work_items WHERE workspace_id = ?';
  const params = [wid];
  if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }
  let rows = db.prepare(sql).all(...params);
  if (req.query.layer) rows = rows.filter(w => w.layer === req.query.layer);
  res.json(rows.map(w => ({
    id: w.id, type: w.type, title: w.title, status: w.status, layer: w.layer,
    actorIds: jparse(w.actor_ids_json, []), relatedNodeIds: jparse(w.related_node_ids_json, []), graphId: w.graph_id
  })));
});

router.get('/portfolios', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  res.json(db.prepare('SELECT * FROM portfolios WHERE workspace_id = ?').all(wid));
});

router.post('/portfolios', authRequired, (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  const id = randomUUID();
  db.prepare('INSERT INTO portfolios (id, workspace_id, name) VALUES (?, ?, ?)').run(id, wid, req.body?.name || 'Portfolio');
  res.status(201).json({ id, workspace_id: wid, name: req.body?.name || 'Portfolio' });
});

router.get('/projects', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  res.json(db.prepare('SELECT * FROM projects WHERE workspace_id = ?').all(wid));
});

export default router;