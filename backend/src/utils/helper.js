import { createRequire } from 'module';
import { randomUUID } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let _db = null;

export function getDb() {
  if (!_db) {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'graph.db');
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

export function setDb(db) { _db = db; }

export function wsId(req) {
  if (req.user?.workspaceId) return req.user.workspaceId;
  if (req.user?.id && req.user.id !== 'anon' && req.user.id !== 'api') {
    const db = getDb();
    const membership = db.prepare('SELECT workspace_id FROM memberships WHERE user_id = ? LIMIT 1').get(req.user.id);
    if (membership) return membership.workspace_id;
  }
  const headerWs = req.headers['x-workspace-id'];
  if (headerWs && (!req.user || req.user.id === 'anon')) return headerWs;
  return 'ws-default';
}

export function graphId(req) {
  return req.headers['x-graph-id'] || req.user?.activeGraphId || req.query.graph_id || null;
}

export function validateWorkspaceAccess(req, targetWsId) {
  if (!req.user || req.user.id === 'anon' || req.user.id === 'api') return true;
  if (req.user.role === 'admin') return true;
  const db = getDb();
  const membership = db.prepare('SELECT 1 FROM memberships WHERE user_id = ? AND workspace_id = ?').get(req.user.id, targetWsId);
  return !!membership;
}

export function validateGraphAccess(req, targetGraphId) {
  if (!targetGraphId) return true;
  const db = getDb();
  const graph = db.prepare('SELECT workspace_id FROM graphs WHERE id = ?').get(targetGraphId);
  if (!graph) return false;
  return validateWorkspaceAccess(req, graph.workspace_id);
}

export function getGraphFilter(req) {
  const gid = graphId(req);
  return gid ? { clause: 'AND graph_id = ?', param: gid } : { clause: '', param: null };
}

export function tokenize(text) {
  return (text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

export function chunkText(text, size = 80) {
  const words = text.split(/\s+/);
  const out = [];
  for (let i = 0; i < words.length; i += size) {
    const t = words.slice(i, i + size).join(' ');
    if (t.trim().length > 15) out.push(t);
  }
  return out;
}

export function jparse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export function jstr(obj) { return JSON.stringify(obj); }

export function validateSecrets() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'graph-platform-dev-secret-change-me') {
      console.error('JWT_SECRET not set in production!');
      process.exit(1);
    }
    if (!process.env.API_KEY || process.env.API_KEY === 'dev-api-key') {
      console.error('API_KEY not set in production!');
      process.exit(1);
    }
  }
  return true;
}