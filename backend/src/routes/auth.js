import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired, signToken, checkPassword, hashPassword } from '../middleware/auth.js';
import { queryAll, queryOne, queryRun } from '../utils/helper.js';

const router = Router();

router.get('/auth/me', authRequired, async (req, res) => {
  try {
    const id = req.user?.sub || req.user?.id;
    if (!id || id === 'api' || id === 'anon') {
      return res.json({ user: { id: 'api', role: req.user?.role || 'service', email: null } });
    }
    const user = await queryOne('SELECT id, email, name, role, workspace_id FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'user not found' });
    const memberships = await queryAll('SELECT workspace_id, role FROM memberships WHERE user_id = ?', [id]);
    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, workspaceId: user.workspace_id, memberships }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !checkPassword(password || '', user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ id: user.id, email: user.email, workspaceId: user.workspace_id, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, workspaceId: user.workspace_id } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, workspaceId } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email/password required' });
    if (await queryOne('SELECT id FROM users WHERE email = ?', [email])) {
      return res.status(409).json({ error: 'exists' });
    }
    const id = randomUUID();
    const ws = workspaceId || 'ws-default';
    await queryRun(
      'INSERT INTO users (id, email, password_hash, name, role, workspace_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, hashPassword(password), name || email, 'member', ws]
    );
    await queryRun(
      'INSERT INTO memberships (user_id, workspace_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      [id, ws, 'member']
    );
    const token = signToken({ id, email, workspaceId: ws, role: 'member' });
    res.status(201).json({ token, user: { id, email, name: name || email, role: 'member', workspaceId: ws } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
