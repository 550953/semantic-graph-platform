import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { queryAll, queryOne, queryRun, jparse, jstr, wsId, validateWorkspaceAccess } from '../utils/helper.js';
import { DEFAULT_PROFILE } from '../engines/ontology.js';

const router = Router();

router.get('/workspaces', async (req, res) => {
  try {
    if (req.user?.id && req.user.id !== 'anon' && req.user.id !== 'api') {
      const rows = await queryAll(
        `SELECT w.*, m.role as membership_role FROM workspaces w
         JOIN memberships m ON m.workspace_id = w.id WHERE m.user_id = ?`,
        [req.user.sub || req.user.id]
      );
      return res.json(rows);
    }
    res.json(await queryAll('SELECT * FROM workspaces', []));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/workspaces', authRequired, async (req, res) => {
  try {
    const id = randomUUID();
    const name = req.body?.name || 'New Workspace';
    const type = req.body?.type || 'studio';
    await queryRun('INSERT INTO workspaces (id, name, type) VALUES (?, ?, ?)', [id, name, type]);
    const uid = req.user.sub || req.user.id;
    if (uid && uid !== 'api') {
      await queryRun('INSERT INTO memberships (user_id, workspace_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [uid, id, 'admin']);
    }
    await queryRun('INSERT INTO ontology (workspace_id, profile_json) VALUES (?, ?)', [id, jstr(DEFAULT_PROFILE)]);
    res.status(201).json({ id, name, type });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/workspaces/:wsId/actors', async (req, res) => {
  try {
    const ws = req.params.wsId;
    if (!await validateWorkspaceAccess(req, ws)) return res.status(403).json({ error: 'Access denied' });
    const unassignedTo = req.query.unassigned_to;
    let actors = (await queryAll('SELECT * FROM actors WHERE workspace_id = ?', [ws]))
      .map(a => ({ id: a.id, type: a.type, name: a.name, roles: jparse(a.roles_json, []) }));
    if (unassignedTo) {
      const bound = new Set(
        (await queryAll('SELECT actor_id FROM role_bindings WHERE workspace_id = ? AND object_id = ?', [ws, unassignedTo]))
          .map(r => r.actor_id)
      );
      actors = actors.filter(a => !bound.has(a.id));
    }
    res.json(actors);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/workspaces/:wsId/templates', async (req, res) => {
  try {
    if (!await validateWorkspaceAccess(req, req.params.wsId)) return res.status(403).json({ error: 'Access denied' });
    const rows = await queryAll(
      'SELECT id, workspace_id, name, description, source_project_id, version, created_at, updated_at FROM templates WHERE workspace_id = ? ORDER BY updated_at DESC',
      [req.params.wsId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/workspaces/:wsId/templates', authRequired, async (req, res) => {
  try {
    const ws = req.params.wsId;
    if (!await validateWorkspaceAccess(req, ws)) return res.status(403).json({ error: 'Access denied' });
    const { name, description, sourceProjectId } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });

    let nodes, edges, workItems;
    if (sourceProjectId) {
      nodes = await queryAll('SELECT * FROM nodes WHERE workspace_id = ? AND (project_id = ? OR project_id IS NULL)', [ws, sourceProjectId]);
      edges = await queryAll('SELECT * FROM edges WHERE workspace_id = ?', [ws]);
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
      workItems = await queryAll('SELECT * FROM work_items WHERE workspace_id = ? AND (project_id = ? OR project_id IS NULL)', [ws, sourceProjectId]);
    } else {
      [nodes, edges, workItems] = await Promise.all([
        queryAll('SELECT * FROM nodes WHERE workspace_id = ?', [ws]),
        queryAll('SELECT * FROM edges WHERE workspace_id = ?', [ws]),
        queryAll('SELECT * FROM work_items WHERE workspace_id = ?', [ws])
      ]);
    }
    const ont = await queryOne('SELECT profile_json FROM ontology WHERE workspace_id = ?', [ws]);
    const ontology = ont ? jparse(ont.profile_json) : null;

    const snapshot = {
      nodes: nodes.map(n => ({ id: n.id, tab: n.tab, label: n.label, kind: n.kind, layer: n.layer, nodeKind: n.node_kind, description: n.description, badge: n.badge })),
      edges: edges.map(e => ({ id: e.id, tab: e.tab, source: e.source, target: e.target, label: e.label })),
      workItems: workItems.map(w => ({ type: w.type, title: w.title, status: w.status, layer: w.layer, relatedNodeIds: jparse(w.related_node_ids_json, []) })),
      ontology,
      roleTypes: ['Заказчик', 'Owner', 'Исполнитель', 'Эксперт', 'Ассистент'],
      frozenAt: new Date().toISOString()
    };

    const id = randomUUID();
    await queryRun(
      'INSERT INTO templates (id, workspace_id, name, description, source_project_id, snapshot_json, version) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [id, ws, name, description || '', sourceProjectId || null, jstr(snapshot)]
    );
    res.status(201).json({ id, name, version: 1, nodes: snapshot.nodes.length, edges: snapshot.edges.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
