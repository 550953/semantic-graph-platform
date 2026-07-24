import { Router } from 'express';
import { randomUUID } from 'crypto';
import { queryAll, queryOne, queryRun, wsId } from '../utils/helper.js';

const router = Router();

router.get('/ratings', async (req, res) => {
  try {
    const wid = wsId(req);
    const [rows, avg] = await Promise.all([
      queryAll('SELECT * FROM ratings WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100', [wid]),
      queryOne('SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE workspace_id = ?', [wid])
    ]);
    res.json({ items: rows, average: avg?.avg || 0, count: avg?.count || 0 });
  } catch {
    res.json({ items: [], average: 0, count: 0 });
  }
});

router.post('/ratings', async (req, res) => {
  try {
    const wid = wsId(req);
    const score = Number(req.body?.score);
    if (!score || score < 1 || score > 5) return res.status(400).json({ error: 'score 1..5 required' });
    const id = randomUUID();
    const uid = req.user?.sub || req.user?.id || null;
    const name = req.body?.userName || req.user?.email || 'anon';
    await queryRun(
      'INSERT INTO ratings (id, workspace_id, user_id, user_name, score, comment, page) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, wid, uid, name, score, (req.body?.comment || '').slice(0, 2000), req.body?.page || 'platform']
    );
    res.status(201).json({ id, score });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
