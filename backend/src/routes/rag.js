import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { getDb, jparse, jstr, wsId, validateWorkspaceAccess, tokenize, chunkText } from '../utils/helper.js';

const router = Router();

router.get('/rag/documents', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  
  res.json(db.prepare('SELECT id, title, length, created_at, node_ids_json FROM documents WHERE workspace_id = ?').all(wid)
    .map(d => ({ ...d, nodeIds: jparse(d.node_ids_json, []) })));
});

router.post('/rag/ingest', authRequired, (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  
  const { title, content, projectId, nodeIds } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content required' });
  const id = randomUUID();
  const nodes = nodeIds || [];
  db.prepare('INSERT INTO documents (id, workspace_id, project_id, title, length, node_ids_json) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, wid, projectId || null, title || 'Untitled', content.length, jstr(nodes));
  const parts = chunkText(content);
  const ins = db.prepare('INSERT INTO chunks (id, document_id, workspace_id, idx, text, tokens_json, node_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?)');
  parts.forEach((text, i) => {
    ins.run(randomUUID(), id, wid, i, text, jstr(tokenize(text)), jstr(nodes));
  });
  res.status(201).json({ document: { id, title: title || 'Untitled' }, chunks: parts.length });
});

router.get('/rag/search', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  if (!validateWorkspaceAccess(req, wid)) return res.status(403).json({ error: 'Access denied' });
  
  const q = (req.query.q || '').toLowerCase();
  const qTokens = tokenize(q);
  const chunks = db.prepare('SELECT * FROM chunks WHERE workspace_id = ?').all(wid);
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
});

export default router;