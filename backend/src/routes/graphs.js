import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { queryAll, queryOne, queryRun, withTransaction, wsId, validateWorkspaceAccess } from '../utils/helper.js';

const router = Router();

router.get('/graphs', authRequired, async (req, res) => {
  try {
    const wid = wsId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
    const graphs = await queryAll('SELECT * FROM graphs WHERE workspace_id = ? ORDER BY created_at DESC', [wid]);
    res.json(graphs || []);
  } catch (e) {
    console.error('GET /graphs error:', e.message);
    res.status(500).json({ error: 'Failed to fetch graphs' });
  }
});

router.post('/graphs', authRequired, async (req, res) => {
  try {
    const wid = wsId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });

    const id = randomUUID();
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    await queryRun('INSERT INTO graphs (id, workspace_id, name, slug, description) VALUES (?, ?, ?, ?, ?)', [id, wid, name, slug, description || '']);

    try {
      const profileJson = JSON.stringify({
        principle: 'Default First', id: 'default-v1', name: 'Default Profile', version: '1.0.0',
        roles: ['Admin', 'User'], nodeTypes: [], edgeTypes: [], workItemTypes: ['Task'],
        actorTypes: ['Human'], layers: ['Default'], fsmMachines: {}, extensions: []
      });
      await queryRun('INSERT INTO ontology (workspace_id, graph_id, profile_json) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [wid, id, profileJson]);
    } catch (ontErr) {
      console.error('Ontology insert warning:', ontErr.message);
    }

    res.status(201).json({ id, workspaceId: wid, name, slug });
  } catch (e) {
    console.error('POST /graphs error:', e.message);
    res.status(500).json({ error: 'Failed to create graph' });
  }
});

router.delete('/graphs/:id', authRequired, async (req, res) => {
  try {
    const graph = await queryOne('SELECT * FROM graphs WHERE id = ?', [req.params.id]);
    if (!graph) return res.status(404).json({ error: 'Graph not found' });
    if (!await validateWorkspaceAccess(req, graph.workspace_id)) return res.status(403).json({ error: 'Access denied' });

    await withTransaction(async (tx) => {
      const tables = ['nodes', 'edges', 'actors', 'work_items', 'documents', 'chunks', 'ontology', 'reviews', 'role_bindings'];
      for (const table of tables) {
        try { await tx.queryRun(`DELETE FROM ${table} WHERE graph_id = ?`, [graph.id]); } catch {}
      }
      await tx.queryRun('DELETE FROM graphs WHERE id = ?', [graph.id]);
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /graphs/:id error:', e.message);
    res.status(500).json({ error: 'Failed to delete graph' });
  }
});

export default router;
