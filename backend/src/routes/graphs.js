import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { getDb, wsId, validateWorkspaceAccess } from '../utils/helper.js';

const router = Router();

router.get('/graphs', authRequired, (req, res) => {
  try {
    const db = getDb();
    const wid = wsId(req);
    
    if (!validateWorkspaceAccess(req, wid)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const graphs = db.prepare('SELECT * FROM graphs WHERE workspace_id = ? ORDER BY created_at DESC').all(wid);
    res.json(graphs || []);
  } catch (e) {
    console.error('GET /graphs error:', e.message);
    res.status(500).json({ error: 'Failed to fetch graphs' });
  }
});

router.post('/graphs', authRequired, (req, res) => {
  try {
    const db = getDb();
    const wid = wsId(req);
    
    if (!validateWorkspaceAccess(req, wid)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { name, description } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }
    
    const id = randomUUID();
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    
    db.prepare('INSERT INTO graphs (id, workspace_id, name, slug, description) VALUES (?, ?, ?, ?, ?)')
      .run(id, wid, name, slug, description || '');
    
    // Безопасная вставка онтологии
    try {
      const profileJson = JSON.stringify({
        principle: 'Default First',
        id: 'default-v1',
        name: 'Default Profile',
        version: '1.0.0',
        roles: ['Admin', 'User'],
        nodeTypes: [],
        edgeTypes: [],
        workItemTypes: ['Task'],
        actorTypes: ['Human'],
        layers: ['Default'],
        fsmMachines: {},
        extensions: []
      });
      db.prepare('INSERT OR IGNORE INTO ontology (workspace_id, graph_id, profile_json) VALUES (?, ?, ?)')
        .run(wid, id, profileJson);
    } catch (ontErr) {
      console.error('Ontology insert warning:', ontErr.message);
      // Не фатально — граф создан
    }
    
    res.status(201).json({ id, workspaceId: wid, name, slug });
  } catch (e) {
    console.error('POST /graphs error:', e.message);
    res.status(500).json({ error: 'Failed to create graph' });
  }
});

router.delete('/graphs/:id', authRequired, (req, res) => {
  try {
    const db = getDb();
    const graph = db.prepare('SELECT * FROM graphs WHERE id = ?').get(req.params.id);
    
    if (!graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    
    if (!validateWorkspaceAccess(req, graph.workspace_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const tx = db.transaction(() => {
      const tables = ['nodes', 'edges', 'actors', 'work_items', 'documents', 
                      'chunks', 'ontology', 'reviews', 'role_bindings'];
      
      for (const table of tables) {
        try {
          db.prepare(`DELETE FROM ${table} WHERE graph_id = ?`).run(graph.id);
        } catch (err) {
          console.error(`DELETE ${table} warning:`, err.message);
        }
      }
      
      db.prepare('DELETE FROM graphs WHERE id = ?').run(graph.id);
    });
    
    tx();
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /graphs/:id error:', e.message);
    res.status(500).json({ error: 'Failed to delete graph' });
  }
});

export default router;