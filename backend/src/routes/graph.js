import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { queryAll, queryOne, queryRun, wsId, graphId, validateWorkspaceAccess, jparse } from '../utils/helper.js';

const router = Router();

router.get('/graph/nodes', async (req, res) => {
  try {
    const wid = wsId(req);
    const gid = graphId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });

    let sql = 'SELECT * FROM nodes WHERE workspace_id = ?';
    const params = [wid];
    if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }
    if (req.query.tab) { sql += ' AND tab = ?'; params.push(req.query.tab); }
    if (req.query.layer) { sql += ' AND layer = ?'; params.push(req.query.layer); }

    const rows = await queryAll(sql, params);
    res.json(rows.map(n => ({
      id: n.id, tab: n.tab, label: n.label, kind: n.kind, layer: n.layer,
      nodeKind: n.node_kind, description: n.description, badge: n.badge,
      workspaceId: n.workspace_id, projectId: n.project_id, graphId: n.graph_id
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/graph/edges', async (req, res) => {
  try {
    const wid = wsId(req);
    const gid = graphId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });

    let sql = 'SELECT * FROM edges WHERE workspace_id = ?';
    const params = [wid];
    if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }
    if (req.query.tab) { sql += ' AND tab = ?'; params.push(req.query.tab); }
    res.json(await queryAll(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/graph/neighbors/:id', async (req, res) => {
  try {
    const wid = wsId(req);
    const gid = graphId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });

    let sql = 'SELECT * FROM edges WHERE workspace_id = ?';
    const params = [wid];
    if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }

    const id = req.params.id;
    const related = new Set([id]);
    const edges = await queryAll(sql, params);
    for (const e of edges) {
      if (e.source === id) related.add(e.target);
      if (e.target === id) related.add(e.source);
    }
    res.json({ nodeId: id, neighbors: [...related] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/actors', async (req, res) => {
  try {
    const wid = wsId(req);
    const gid = graphId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });

    let sql = 'SELECT * FROM actors WHERE workspace_id = ?';
    const params = [wid];
    if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }
    const rows = await queryAll(sql, params);
    res.json(rows.map(a => ({ id: a.id, type: a.type, name: a.name, roles: jparse(a.roles_json, []), graphId: a.graph_id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/interest-scope/:actorId', async (req, res) => {
  try {
    const wid = wsId(req);
    const gid = graphId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });

    const actor = await queryOne('SELECT * FROM actors WHERE id = ? AND workspace_id = ?', [req.params.actorId, wid]);
    if (!actor) return res.status(404).json({ error: 'not found' });

    let wiSql = 'SELECT * FROM work_items WHERE workspace_id = ?';
    const wiParams = [wid];
    if (gid) { wiSql += ' AND graph_id = ?'; wiParams.push(gid); }

    const wis = (await queryAll(wiSql, wiParams)).filter(w => jparse(w.actor_ids_json, []).includes(actor.id));
    const nodeIds = new Set();
    wis.forEach(w => jparse(w.related_node_ids_json, []).forEach(id => nodeIds.add(id)));

    let edgeSql = 'SELECT * FROM edges WHERE workspace_id = ?';
    const edgeParams = [wid];
    if (gid) { edgeSql += ' AND graph_id = ?'; edgeParams.push(gid); }
    const edges = await queryAll(edgeSql, edgeParams);
    [...nodeIds].forEach(id => {
      for (const e of edges) {
        if (e.source === id) nodeIds.add(e.target);
        if (e.target === id) nodeIds.add(e.source);
      }
    });
    res.json({ actorId: actor.id, roles: jparse(actor.roles_json, []), nodeIds: [...nodeIds], workItemIds: wis.map(w => w.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/work-items', async (req, res) => {
  try {
    const wid = wsId(req);
    const gid = graphId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });

    let sql = 'SELECT * FROM work_items WHERE workspace_id = ?';
    const params = [wid];
    if (gid) { sql += ' AND graph_id = ?'; params.push(gid); }
    let rows = await queryAll(sql, params);
    if (req.query.layer) rows = rows.filter(w => w.layer === req.query.layer);
    res.json(rows.map(w => ({
      id: w.id, type: w.type, title: w.title, status: w.status, layer: w.layer,
      actorIds: jparse(w.actor_ids_json, []), relatedNodeIds: jparse(w.related_node_ids_json, []), graphId: w.graph_id
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/portfolios', async (req, res) => {
  try {
    const wid = wsId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
    res.json(await queryAll('SELECT * FROM portfolios WHERE workspace_id = ?', [wid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/portfolios', authRequired, async (req, res) => {
  try {
    const wid = wsId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
    const id = randomUUID();
    const name = req.body?.name || 'Portfolio';
    await queryRun('INSERT INTO portfolios (id, workspace_id, name) VALUES (?, ?, ?)', [id, wid, name]);
    res.status(201).json({ id, workspace_id: wid, name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/projects', async (req, res) => {
  try {
    const wid = wsId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
    res.json(await queryAll('SELECT * FROM projects WHERE workspace_id = ?', [wid]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
