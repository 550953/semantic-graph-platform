import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { getDb, jstr, wsId, validateWorkspaceAccess } from '../utils/helper.js';
import { DEFAULT_PROFILE } from '../engines/ontology.js';

const router = Router();

router.get('/workspaces', (req, res) => {
  const db = getDb();
  if (req.user?.id && req.user.id !== 'anon' && req.user.id !== 'api') {
    const rows = db.prepare(`
      SELECT w.*, m.role as membership_role 
      FROM workspaces w
      JOIN memberships m ON m.workspace_id = w.id
      WHERE m.user_id = ?
    `).all(req.user.sub || req.user.id);
    return res.json(rows);
  }
  res.json(db.prepare('SELECT * FROM workspaces').all());
});

router.post('/workspaces', authRequired, (req, res) => {
  const db = getDb();
  const id = randomUUID();
  const name = req.body?.name || 'New Workspace';
  const type = req.body?.type || 'studio';
  db.prepare('INSERT INTO workspaces (id, name, type) VALUES (?, ?, ?)').run(id, name, type);
  const uid = req.user.sub || req.user.id;
  if (uid && uid !== 'api') {
    db.prepare('INSERT INTO memberships (user_id, workspace_id, role) VALUES (?, ?, ?)').run(uid, id, 'admin');
  }
  db.prepare('INSERT INTO ontology (workspace_id, profile_json) VALUES (?, ?)').run(id, jstr(DEFAULT_PROFILE));
  res.status(201).json({ id, name, type });
});

// Actors reuse
router.get('/workspaces/:wsId/actors', (req, res) => {
  const db = getDb();
  const ws = req.params.wsId;
  if (!validateWorkspaceAccess(req, ws)) return res.status(403).json({ error: 'Access denied' });
  
  const unassignedTo = req.query.unassigned_to;
  let actors = db.prepare('SELECT * FROM actors WHERE workspace_id = ?').all(ws)
    .map(a => ({ id: a.id, type: a.type, name: a.name, roles: jparse(a.roles_json, []) }));
  if (unassignedTo) {
    const bound = new Set(
      db.prepare('SELECT actor_id FROM role_bindings WHERE workspace_id = ? AND object_id = ?')
        .all(ws, unassignedTo)
        .map(r => r.actor_id)
    );
    actors = actors.filter(a => !bound.has(a.id));
  }
  res.json(actors);
});

// Templates
router.get('/workspaces/:wsId/templates', (req, res) => {
  const db = getDb();
  if (!validateWorkspaceAccess(req, req.params.wsId)) return res.status(403).json({ error: 'Access denied' });
  
  const rows = db.prepare('SELECT id, workspace_id, name, description, source_project_id, version, created_at, updated_at FROM templates WHERE workspace_id = ? ORDER BY updated_at DESC').all(req.params.wsId);
  res.json(rows);
});

router.post('/workspaces/:wsId/templates', authRequired, (req, res) => {
  const db = getDb();
  const ws = req.params.wsId;
  if (!validateWorkspaceAccess(req, ws)) return res.status(403).json({ error: 'Access denied' });
  
  const { name, description, sourceProjectId } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });

  let nodes, edges, workItems, ontology;
  if (sourceProjectId) {
    nodes = db.prepare('SELECT * FROM nodes WHERE workspace_id = ? AND (project_id = ? OR project_id IS NULL)').all(ws, sourceProjectId);
    edges = db.prepare('SELECT * FROM edges WHERE workspace_id = ?').all(ws);
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    workItems = db.prepare('SELECT * FROM work_items WHERE workspace_id = ? AND (project_id = ? OR project_id IS NULL)').all(ws, sourceProjectId);
  } else {
    nodes = db.prepare('SELECT * FROM nodes WHERE workspace_id = ?').all(ws);
    edges = db.prepare('SELECT * FROM edges WHERE workspace_id = ?').all(ws);
    workItems = db.prepare('SELECT * FROM work_items WHERE workspace_id = ?').all(ws);
  }
  const ont = db.prepare('SELECT profile_json FROM ontology WHERE workspace_id = ?').get(ws);
  ontology = ont ? jparse(ont.profile_json) : null;

  const snapshot = {
    nodes: nodes.map(n => ({
      id: n.id, tab: n.tab, label: n.label, kind: n.kind, layer: n.layer,
      nodeKind: n.node_kind, description: n.description, badge: n.badge
    })),
    edges: edges.map(e => ({ id: e.id, tab: e.tab, source: e.source, target: e.target, label: e.label })),
    workItems: workItems.map(w => ({
      type: w.type, title: w.title, status: w.status, layer: w.layer,
      relatedNodeIds: jparse(w.related_node_ids_json, [])
    })),
    ontology,
    roleTypes: ['Заказчик', 'Owner', 'Исполнитель', 'Эксперт', 'Ассистент'],
    frozenAt: new Date().toISOString()
  };

  const id = randomUUID();
  db.prepare(`INSERT INTO templates (id, workspace_id, name, description, source_project_id, snapshot_json, version)
    VALUES (?, ?, ?, ?, ?, ?, 1)`).run(id, ws, name, description || '', sourceProjectId || null, jstr(snapshot));
  res.status(201).json({ id, name, version: 1, nodes: snapshot.nodes.length, edges: snapshot.edges.length });
});

export default router;