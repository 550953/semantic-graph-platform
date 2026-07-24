import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { queryAll, queryOne, queryRun, jparse, jstr, wsId, validateWorkspaceAccess, tokenize, chunkText } from '../utils/helper.js';

const router = Router();

router.get('/rag/documents', async (req, res) => {
  try {
    const wid = wsId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
    const rows = await queryAll('SELECT id, title, length, created_at, node_ids_json FROM documents WHERE workspace_id = ?', [wid]);
    res.json(rows.map(d => ({ ...d, nodeIds: jparse(d.node_ids_json, []) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/rag/ingest', authRequired, async (req, res) => {
  try {
    const wid = wsId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
    const { title, content, projectId, nodeIds } = req.body || {};
    if (!content) return res.status(400).json({ error: 'content required' });
    const id = randomUUID();
    const nodes = nodeIds || [];
    await queryRun(
      'INSERT INTO documents (id, workspace_id, project_id, title, length, node_ids_json) VALUES (?, ?, ?, ?, ?, ?)',
      [id, wid, projectId || null, title || 'Untitled', content.length, jstr(nodes)]
    );
    const parts = chunkText(content);
    for (let i = 0; i < parts.length; i++) {
      const text = parts[i];
      await queryRun(
        'INSERT INTO chunks (id, document_id, workspace_id, idx, text, tokens_json, node_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [randomUUID(), id, wid, i, text, jstr(tokenize(text)), jstr(nodes)]
      );
    }
    res.status(201).json({ document: { id, title: title || 'Untitled' }, chunks: parts.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/rag/search', async (req, res) => {
  try {
    const wid = wsId(req);
    if (!await validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
    const q = (req.query.q || '').toLowerCase();
    const qTokens = tokenize(q);
    const chunks = await queryAll('SELECT * FROM chunks WHERE workspace_id = ?', [wid]);
    const scored = chunks.map(c => {
      let score = 0;
      const tokens = jparse(c.tokens_json, []);
      for (const t of qTokens) {
        if (tokens.includes(t)) score += 1;
        if ((c.text || '').toLowerCase().includes(t)) score += 0.5;
      }
      return { chunkId: c.id, documentId: c.document_id, text: c.text, score, nodeIds: jparse(c.node_ids_json, []) };
    }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, Number(req.query.limit) || 6);
    res.json(scored);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
