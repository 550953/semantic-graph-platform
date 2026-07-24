import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authRequired, signToken, checkPassword, hashPassword } from '../middleware/auth.js';
import { getDb } from '../utils/helper.js';

const router = Router();

router.get('/auth/me', authRequired, (req, res) => {
  const db = getDb();
  const id = req.user?.sub || req.user?.id;
  if (!id || id === 'api' || id === 'anon') {
    return res.json({ user: { id: 'api', role: req.user?.role || 'service', email: null } });
  }
  const user = db.prepare('SELECT id, email, name, role, workspace_id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'user not found' });
  
  const memberships = db.prepare('SELECT workspace_id, role FROM memberships WHERE user_id = ?').all(id);
  
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspaceId: user.workspace_id,
      memberships: memberships
    }
  });
});

router.post('/auth/login', (req, res) => {
  const db = getDb();
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !checkPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken({
    id: user.id,
    email: user.email,
    workspaceId: user.workspace_id,
    role: user.role
  });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, workspaceId: user.workspace_id }
  });
});

router.post('/auth/register', (req, res) => {
  const db = getDb();
  const { email, password, name, workspaceId } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email/password required' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'exists' });
  }
  const id = randomUUID();
  const ws = workspaceId || 'ws-default';
  db.prepare('INSERT INTO users (id, email, password_hash, name, role, workspace_id) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, email, hashPassword(password), name || email, 'member', ws
  );
  db.prepare('INSERT OR IGNORE INTO memberships (user_id, workspace_id, role) VALUES (?, ?, ?)').run(id, ws, 'member');
  const token = signToken({ id, email, workspaceId: ws, role: 'member' });
  res.status(201).json({ token, user: { id, email, name: name || email, role: 'member', workspaceId: ws } });
});

export default router;