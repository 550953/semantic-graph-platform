/**
 * RAG engine — async PostgreSQL version.
 * Replaces the old synchronous better-sqlite3 implementation.
 */
import { randomUUID } from 'crypto';
import { queryAll, queryOne, queryRun, withTransaction } from '../db/pool.js';
import { jparse, jstr, tokenize, chunkText } from '../utils/helper.js';

export async function ingestDocument({ title, content, workspaceId, projectId, nodeIds = [] }) {
  const wid = workspaceId || 'ws-default';
  const id = randomUUID();
  await queryRun(
    'INSERT INTO documents (id, workspace_id, project_id, title, length, node_ids_json) VALUES (?, ?, ?, ?, ?, ?)',
    [id, wid, projectId || null, title || 'Untitled', (content || '').length, jstr(nodeIds)]
  );
  const parts = chunkText(content || '');
  for (let i = 0; i < parts.length; i++) {
    await queryRun(
      'INSERT INTO chunks (id, document_id, workspace_id, idx, text, tokens_json, node_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), id, wid, i, parts[i], jstr(tokenize(parts[i])), jstr(nodeIds)]
    );
  }
  return { document: { id, title: title || 'Untitled', workspaceId: wid }, chunks: parts.length };
}

export async function retrieve(query, { workspaceId, limit = 5 } = {}) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  const chunks = workspaceId
    ? await queryAll('SELECT * FROM chunks WHERE workspace_id = ?', [workspaceId])
    : await queryAll('SELECT * FROM chunks', []);
  return chunks.map(c => {
    let score = 0;
    const tokens = jparse(c.tokens_json, []);
    for (const t of qTokens) {
      if (tokens.includes(t)) score += 1;
      if ((c.text || '').toLowerCase().includes(t)) score += 0.5;
    }
    return { id: c.id, documentId: c.document_id, text: c.text, index: c.idx, score, nodeIds: jparse(c.node_ids_json, []) };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function getDocument(id) {
  const doc = await queryOne('SELECT * FROM documents WHERE id = ?', [id]);
  if (!doc) return null;
  const chunks = await queryAll('SELECT * FROM chunks WHERE document_id = ? ORDER BY idx', [id]);
  return {
    id: doc.id, title: doc.title, workspaceId: doc.workspace_id, projectId: doc.project_id,
    length: doc.length, nodeIds: jparse(doc.node_ids_json, []), createdAt: doc.created_at,
    chunks: chunks.map(c => ({ id: c.id, index: c.idx, text: c.text, nodeIds: jparse(c.node_ids_json, []) }))
  };
}

export async function deleteDocument(id) {
  const doc = await queryOne('SELECT * FROM documents WHERE id = ?', [id]);
  if (!doc) return false;
  await withTransaction(async (tx) => {
    await tx.queryRun('DELETE FROM chunks WHERE document_id = ?', [id]);
    await tx.queryRun('DELETE FROM documents WHERE id = ?', [id]);
  });
  return true;
}

export async function listDocuments(workspaceId) {
  const docs = workspaceId
    ? await queryAll('SELECT * FROM documents WHERE workspace_id = ? ORDER BY created_at DESC', [workspaceId])
    : await queryAll('SELECT * FROM documents ORDER BY created_at DESC', []);
  return docs.map(d => ({
    id: d.id, title: d.title, workspaceId: d.workspace_id, projectId: d.project_id,
    length: d.length, nodeIds: jparse(d.node_ids_json, []), createdAt: d.created_at
  }));
}
