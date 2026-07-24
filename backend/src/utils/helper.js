/**
 * Async helper utilities for PostgreSQL (pg).
 * Drop-in replacement for the old better-sqlite3 synchronous helper.
 */
export { queryAll, queryOne, queryRun, withTransaction, getPool } from '../db/pool.js';

export function jparse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}
export function jstr(obj) { return JSON.stringify(obj); }

export function wsId(req) {
  if (req.user?.workspaceId) return req.user.workspaceId;
  const headerWs = req.headers['x-workspace-id'];
  if (headerWs && (!req.user || req.user.id === 'anon')) return headerWs;
  return 'ws-default';
}

export function graphId(req) {
  return req.headers['x-graph-id'] || req.user?.activeGraphId || req.query.graph_id || null;
}

export async function validateWorkspaceAccess(req, targetWsId) {
  if (!req.user || req.user.id === 'anon' || req.user.id === 'api') return true;
  if (req.user.role === 'admin') return true;
  const { queryOne } = await import('../db/pool.js');
  const row = await queryOne('SELECT 1 FROM memberships WHERE user_id = ? AND workspace_id = ?', [req.user.sub || req.user.id, targetWsId]);
  return !!row;
}

export async function validateGraphAccess(req, targetGraphId) {
  if (!targetGraphId) return true;
  const { queryOne } = await import('../db/pool.js');
  const graph = await queryOne('SELECT workspace_id FROM graphs WHERE id = ?', [targetGraphId]);
  if (!graph) return false;
  return validateWorkspaceAccess(req, graph.workspace_id);
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
