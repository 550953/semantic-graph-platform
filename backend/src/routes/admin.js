import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { queryAll, queryOne, queryRun, withTransaction, wsId, validateWorkspaceAccess, jstr } from '../utils/helper.js';

const router = Router();

function isAdmin(req) {
  return req.user?.role === 'admin' || req.user?.id === 'api' ||
    req.headers['x-api-key'] === process.env.API_KEY || req.headers['x-api-key'] === 'dev-api-key';
}

router.get('/admin/summary', authRequired, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'admin only' });
    const [users, workspaces, ratings, questions, nodes, avg] = await Promise.all([
      queryAll('SELECT id, email, name, role, workspace_id, created_at FROM users', []),
      queryAll('SELECT * FROM workspaces', []),
      queryAll('SELECT * FROM ratings ORDER BY created_at DESC LIMIT 50', []),
      queryOne('SELECT COUNT(*) as c FROM questions', []),
      queryOne('SELECT COUNT(*) as c FROM nodes', []),
      queryOne('SELECT AVG(score) as avg, COUNT(*) as count FROM ratings', [])
    ]);
    res.json({
      users, workspaces, ratings,
      stats: {
        users: users.length, workspaces: workspaces.length,
        questions: questions?.c || 0, nodes: nodes?.c || 0,
        ratingAvg: avg?.avg || 0, ratingCount: avg?.count || 0
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/admin/users', authRequired, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'admin only' });
    res.json(await queryAll('SELECT id, email, name, role, workspace_id, created_at FROM users', []));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/import-graph', authRequired, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
    const { workspaceId, tab, nodes, edges } = req.body || {};
    if (!workspaceId || !tab || !nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'workspaceId, tab, nodes[] required' });
    }
    if (!['asis', 'process', 'tobe'].includes(tab)) {
      return res.status(400).json({ error: 'tab must be asis, process or tobe' });
    }
    if (nodes.length === 0) return res.status(400).json({ error: 'nodes array is empty' });

    let createdNodes = 0, createdEdges = 0;
    await withTransaction(async (tx) => {
      const idMap = {};
      for (const n of nodes) {
        const nid = randomUUID();
        idMap[n.id] = nid;
        await tx.queryRun(
          'INSERT INTO nodes (id, workspace_id, project_id, tab, label, kind, layer, node_kind, description, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [nid, workspaceId, n.projectId || null, tab, n.label, n.kind || '', n.layer || 'Knowledge', n.nodeKind || 'domain', n.description || '', n.badge || null]
        );
        createdNodes++;
      }
      if (edges && Array.isArray(edges)) {
        for (const e of edges) {
          const source = idMap[e.source];
          const target = idMap[e.target];
          if (!source || !target) continue;
          await tx.queryRun('INSERT INTO edges (id, workspace_id, tab, source, target, label) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), workspaceId, tab, source, target, e.label || '']);
          createdEdges++;
        }
      }
    });
    res.status(201).json({ ok: true, nodesCreated: createdNodes, edgesCreated: createdEdges });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/nodes', authRequired, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
    const { workspaceId, tab, label, kind, layer, nodeKind, description, badge, projectId } = req.body || {};
    if (!workspaceId || !label) return res.status(400).json({ error: 'workspaceId and label required' });
    const id = randomUUID();
    await queryRun(
      'INSERT INTO nodes (id, workspace_id, project_id, tab, label, kind, layer, node_kind, description, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, workspaceId, projectId || null, tab || null, label, kind || '', layer || 'Knowledge', nodeKind || 'domain', description || '', badge || null]
    );
    res.status(201).json({ id, workspaceId, tab, label, kind, layer, nodeKind, description, badge });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/edges', authRequired, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
    const { workspaceId, tab, source, target, label } = req.body || {};
    if (!workspaceId || !source || !target) return res.status(400).json({ error: 'workspaceId, source, target required' });
    const [sourceNode, targetNode] = await Promise.all([
      queryOne('SELECT id FROM nodes WHERE id = ? AND workspace_id = ?', [source, workspaceId]),
      queryOne('SELECT id FROM nodes WHERE id = ? AND workspace_id = ?', [target, workspaceId])
    ]);
    if (!sourceNode || !targetNode) return res.status(404).json({ error: 'source or target node not found in this workspace' });
    const id = randomUUID();
    await queryRun('INSERT INTO edges (id, workspace_id, tab, source, target, label) VALUES (?, ?, ?, ?, ?, ?)', [id, workspaceId, tab, source, target, label || '']);
    res.status(201).json({ id, workspaceId, tab, source, target, label });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/admin/nodes/:id', authRequired, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
    const node = await queryOne('SELECT * FROM nodes WHERE id = ?', [req.params.id]);
    if (!node) return res.status(404).json({ error: 'node not found' });
    await queryRun('DELETE FROM edges WHERE source = ? OR target = ?', [node.id, node.id]);
    await queryRun('DELETE FROM nodes WHERE id = ?', [node.id]);
    res.json({ ok: true, id: node.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/admin/edges/:id', authRequired, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
    const edge = await queryOne('SELECT * FROM edges WHERE id = ?', [req.params.id]);
    if (!edge) return res.status(404).json({ error: 'edge not found' });
    await queryRun('DELETE FROM edges WHERE id = ?', [req.params.id]);
    res.json({ ok: true, id: edge.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
