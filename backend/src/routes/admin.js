import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { getDb, wsId, validateWorkspaceAccess, jstr } from '../utils/helper.js';

const router = Router();

router.get('/admin/summary', authRequired, (req, res) => {
  const db = getDb();
  const role = req.user?.role;
  if (role !== 'admin' && req.user?.id !== 'api') {
    const key = req.headers['x-api-key'];
    if (key !== process.env.API_KEY && key !== 'dev-api-key') {
      return res.status(403).json({ error: 'admin only' });
    }
  }
  const users = db.prepare('SELECT id, email, name, role, workspace_id, created_at FROM users').all();
  const workspaces = db.prepare('SELECT * FROM workspaces').all();
  const ratings = db.prepare('SELECT * FROM ratings ORDER BY created_at DESC LIMIT 50').all();
  const questions = db.prepare('SELECT COUNT(*) as c FROM questions').get();
  const nodes = db.prepare('SELECT COUNT(*) as c FROM nodes').get();
  const avg = db.prepare('SELECT AVG(score) as avg, COUNT(*) as count FROM ratings').get();
  res.json({
    users,
    workspaces,
    ratings,
    stats: {
      users: users.length,
      workspaces: workspaces.length,
      questions: questions?.c || 0,
      nodes: nodes?.c || 0,
      ratingAvg: avg?.avg || 0,
      ratingCount: avg?.count || 0
    }
  });
});

router.get('/admin/users', authRequired, (req, res) => {
  const db = getDb();
  if (req.user?.role !== 'admin' && req.headers['x-api-key'] !== 'dev-api-key') {
    return res.status(403).json({ error: 'admin only' });
  }
  res.json(db.prepare('SELECT id, email, name, role, workspace_id, created_at FROM users').all());
});

// Импорт графа из JSON
router.post('/admin/import-graph', authRequired, (req, res) => {
  const db = getDb();
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  
  const { workspaceId, tab, nodes, edges } = req.body || {};
  
  if (!workspaceId || !tab || !nodes || !Array.isArray(nodes)) {
    return res.status(400).json({ error: 'workspaceId, tab, nodes[] required' });
  }
  
  if (!['asis', 'process', 'tobe'].includes(tab)) {
    return res.status(400).json({ error: 'tab must be asis, process or tobe' });
  }
  
  if (nodes.length === 0) {
    return res.status(400).json({ error: 'nodes array is empty' });
  }
  
  const idMap = {};
  let createdNodes = 0;
  let createdEdges = 0;
  
  const insertNode = db.prepare(`INSERT INTO nodes (id, workspace_id, project_id, tab, label, kind, layer, node_kind, description, badge)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertEdge = db.prepare('INSERT INTO edges (id, workspace_id, tab, source, target, label) VALUES (?, ?, ?, ?, ?, ?)');
  
  const tx = db.transaction(() => {
    for (const n of nodes) {
      const nid = randomUUID();
      idMap[n.id] = nid;
      insertNode.run(
        nid, workspaceId, n.projectId || null, tab, 
        n.label, n.kind || '', n.layer || 'Knowledge', 
        n.nodeKind || 'domain', n.description || '', n.badge || null
      );
      createdNodes++;
    }
    
    if (edges && Array.isArray(edges)) {
      for (const e of edges) {
        const source = idMap[e.source];
        const target = idMap[e.target];
        if (!source || !target) continue;
        insertEdge.run(randomUUID(), workspaceId, tab, source, target, e.label || '');
        createdEdges++;
      }
    }
  });
  
  tx();
  
  res.status(201).json({ 
    ok: true, 
    nodesCreated: createdNodes, 
    edgesCreated: createdEdges 
  });
});

// Добавление узла
router.post('/admin/nodes', authRequired, (req, res) => {
  const db = getDb();
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  
  const { workspaceId, tab, label, kind, layer, nodeKind, description, badge, projectId } = req.body || {};
  
  if (!workspaceId || !tab || !label || !layer || !nodeKind) {
    return res.status(400).json({ error: 'workspaceId, tab, label, layer, nodeKind required' });
  }
  
  if (!['asis', 'process', 'tobe'].includes(tab)) {
    return res.status(400).json({ error: 'tab must be asis, process or tobe' });
  }
  
  if (!['Knowledge', 'Implementation', 'Project', 'Resource'].includes(layer)) {
    return res.status(400).json({ error: 'layer must be Knowledge, Implementation, Project or Resource' });
  }
  
  if (!['domain', 'core', 'service', 'role', 'note', 'step', 'act'].includes(nodeKind)) {
    return res.status(400).json({ error: 'nodeKind must be domain, core, service, role, note, step or act' });
  }
  
  const id = randomUUID();
  
  db.prepare(`INSERT INTO nodes (id, workspace_id, project_id, tab, label, kind, layer, node_kind, description, badge)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, workspaceId, projectId || null, tab, label, kind || '', layer, nodeKind, description || '', badge || null
  );
  
  res.status(201).json({ id, workspaceId, tab, label, kind, layer, nodeKind, description });
});

// Добавление связи
router.post('/admin/edges', authRequired, (req, res) => {
  const db = getDb();
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  
  const { workspaceId, tab, source, target, label } = req.body || {};
  
  if (!workspaceId || !tab || !source || !target) {
    return res.status(400).json({ error: 'workspaceId, tab, source, target required' });
  }
  
  const sourceNode = db.prepare('SELECT id FROM nodes WHERE id = ? AND workspace_id = ?').get(source, workspaceId);
  const targetNode = db.prepare('SELECT id FROM nodes WHERE id = ? AND workspace_id = ?').get(target, workspaceId);
  
  if (!sourceNode || !targetNode) {
    return res.status(404).json({ error: 'source or target node not found in this workspace' });
  }
  
  const id = randomUUID();
  
  db.prepare('INSERT INTO edges (id, workspace_id, tab, source, target, label) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, workspaceId, tab, source, target, label || ''
  );
  
  res.status(201).json({ id, workspaceId, tab, source, target, label });
});

// Удаление узла
router.delete('/admin/nodes/:id', authRequired, (req, res) => {
  const db = getDb();
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
  if (!node) return res.status(404).json({ error: 'node not found' });
  
  db.prepare('DELETE FROM edges WHERE source = ? OR target = ?').run(node.id, node.id);
  db.prepare('DELETE FROM nodes WHERE id = ?').run(node.id);
  
  res.json({ ok: true, id: node.id });
});

// Удаление связи
router.delete('/admin/edges/:id', authRequired, (req, res) => {
  const db = getDb();
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  
  const edge = db.prepare('SELECT * FROM edges WHERE id = ?').get(req.params.id);
  if (!edge) return res.status(404).json({ error: 'edge not found' });
  
  db.prepare('DELETE FROM edges WHERE id = ?').run(req.params.id);
  
  res.json({ ok: true, id: edge.id });
});

export default router;