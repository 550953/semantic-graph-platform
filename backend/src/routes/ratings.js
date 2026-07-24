import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getDb, wsId } from '../utils/helper.js';

const router = Router();

router.get('/ratings', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  
  try {
    const rows = db.prepare('SELECT * FROM ratings WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100').all(wid);
    const avg = db.prepare('SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE workspace_id = ?').get(wid);
    res.json({ items: rows, average: avg?.avg || 0, count: avg?.count || 0 });
  } catch {
    res.json({ items: [], average: 0, count: 0 });
  }
});

router.post('/ratings', (req, res) => {
  const db = getDb();
  const wid = wsId(req);
  
  const score = Number(req.body?.score);
  if (!score || score < 1 || score > 5) {
    return res.status(400).json({ error: 'score 1..5 required' });
  }
  
  const id = randomUUID();
  const uid = req.user?.sub || req.user?.id || null;
  const name = req.body?.userName || req.user?.email || 'anon';
  
  db.prepare(`INSERT INTO ratings (id, workspace_id, user_id, user_name, score, comment, page)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id, wid, uid, name, score, (req.body?.comment || '').slice(0, 2000), req.body?.page || 'platform'
  );
  
  res.status(201).json({ id, score });
});

export default router;