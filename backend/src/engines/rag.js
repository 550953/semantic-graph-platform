import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { getDb, jparse, jstr, tokenize, chunkText } from '../utils/helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../../data/docs');

export function ensureDocsDir() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
}

export function ingestDocument({ title, content, workspaceId, projectId, nodeIds = [] }) {
  ensureDocsDir();
  
  const db = getDb();
  const wid = workspaceId || 'ws-default';
  const id = randomUUID();
  
  db.prepare(`INSERT INTO documents (id, workspace_id, project_id, title, length, node_ids_json, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    id, wid, projectId || null, title || 'Untitled', (content || '').length, jstr(nodeIds)
  );
  
  const parts = chunkText(content || '');
  const insertChunk = db.prepare(`INSERT INTO chunks (id, document_id, workspace_id, idx, text, tokens_json, node_ids_json) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  
  const insertTransaction = db.transaction(() => {
    parts.forEach((text, i) => {
      insertChunk.run(randomUUID(), id, wid, i, text, jstr(tokenize(text)), jstr(nodeIds));
    });
  });
  
  insertTransaction();
  
  fs.writeFileSync(path.join(DOCS_DIR, `${id}.txt`), content || '', 'utf8');
  
  return { 
    document: { 
      id, 
      title: title || 'Untitled', 
      workspaceId: wid, 
      projectId: projectId || null,
      length: (content || '').length,
      createdAt: new Date().toISOString()
    }, 
    chunks: parts.length 
  };
}

export function retrieve(query, { workspaceId, limit = 5 } = {}) {
  const db = getDb();
  const qTokens = tokenize(query);
  
  if (!qTokens.length) return [];
  
  let chunks;
  if (workspaceId) {
    chunks = db.prepare('SELECT * FROM chunks WHERE workspace_id = ?').all(workspaceId);
  } else {
    chunks = db.prepare('SELECT * FROM chunks').all();
  }
  
  const scored = chunks.map(c => {
    let score = 0;
    const tokens = jparse(c.tokens_json, []);
    
    for (const t of qTokens) {
      if (tokens.includes(t)) score += 1;
      if ((c.text || '').toLowerCase().includes(t)) score += 0.5;
    }
    
    return { 
      id: c.id,
      documentId: c.document_id,
      text: c.text,
      index: c.idx,
      score,
      nodeIds: jparse(c.node_ids_json, [])
    };
  }).filter(c => c.score > 0);
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, limit);
}

export function getDocument(id) {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  
  if (!doc) return null;
  
  const chunks = db.prepare('SELECT * FROM chunks WHERE document_id = ? ORDER BY idx').all(id);
  
  return {
    id: doc.id,
    title: doc.title,
    workspaceId: doc.workspace_id,
    projectId: doc.project_id,
    length: doc.length,
    nodeIds: jparse(doc.node_ids_json, []),
    createdAt: doc.created_at,
    chunks: chunks.map(c => ({
      id: c.id,
      index: c.idx,
      text: c.text,
      nodeIds: jparse(c.node_ids_json, [])
    }))
  };
}

export function deleteDocument(id) {
  const db = getDb();
  
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) return false;
  
  const deleteChunks = db.prepare('DELETE FROM chunks WHERE document_id = ?');
  const deleteDoc = db.prepare('DELETE FROM documents WHERE id = ?');
  
  const deleteTransaction = db.transaction(() => {
    deleteChunks.run(id);
    deleteDoc.run(id);
  });
  
  deleteTransaction();
  
  const filePath = path.join(DOCS_DIR, `${id}.txt`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  return true;
}

export function listDocuments(workspaceId) {
  const db = getDb();
  
  const docs = workspaceId 
    ? db.prepare('SELECT * FROM documents WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId)
    : db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all();
  
  return docs.map(d => ({
    id: d.id,
    title: d.title,
    workspaceId: d.workspace_id,
    projectId: d.project_id,
    length: d.length,
    nodeIds: jparse(d.node_ids_json, []),
    createdAt: d.created_at
  }));
}

export function seedDefaultDocs(workspaceId = 'ws-default', projectId = 'prj-bank') {
  const db = getDb();
  
  const existing = db.prepare('SELECT COUNT(*) as count FROM documents WHERE workspace_id = ?').get(workspaceId);
  if (existing?.count > 0) return;
  
  const docs = [
    {
      title: 'Архитектура Graph Platform',
      content: `Graph Platform состоит из движков: Graph Engine, FSM Engine, Review Engine, Ontology Engine, RAG Engine, Visualization Engine. PI (Platform Interactive) — слой выше React Flow. Принцип Default First, Configure Second, Extend Third. Transformation Graph включает Knowledge, Implementation, Project, Resource. Interest Scope вычисляется из графа. Actor = Human | AIAgent | Service | External System. Pipe намеренно не формализована жёстко в онтологии.`,
      nodeIds: ['core', 'self-graph', 'self-copilot']
    },
    {
      title: 'Регуляторная отчётность 0409101',
      content: `Форма 0409101 — оборотная ведомость по счетам бухгалтерского учёта. Контрольные соотношения (КС) — арифметические равенства формы. ФЛК — форматно-логический контроль ЦБ. Control Knowledge — домен контрольных отчётов, КС и DELTA. Экономист персонально отвечает за сдачу формы в ЦБ через KLIKO. ODS — единый слой данных. Lineage — происхождение каждой цифры.`,
      nodeIds: ['rep', 'ctrl', 'ods', 'econ']
    },
    {
      title: 'Процесс перехода As-is → To-be',
      content: `Этапы: срез 101 на синтетике, вторая форма, ODS Knowledge Model внутри контура, конвертация SQL, боевая сверка, программа масштабирования. Инженер ИИ ведёт синтетику, модель знаний, перенос, eval-петлю и обучение команды. Знания в as-is живут в ТЗ и головах сотрудников.`,
      nodeIds: ['aian', 'stand', 'proc']
    }
  ];
  
  for (const d of docs) {
    ingestDocument({ ...d, workspaceId, projectId });
  }
}