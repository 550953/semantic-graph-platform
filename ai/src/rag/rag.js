/**
 * RAG Engine — document chunks + simple lexical retrieval
 * Feeds Graph Context Builder / LLM Gateway
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../../data/docs');

function tokenize(text) {
  return (text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

export function ensureDocsDir() {
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
}

export function chunkText(text, size = 400) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(' '));
  }
  return chunks.filter(c => c.trim().length > 20);
}

export function ingestDocument(db, { title, content, workspaceId, projectId, nodeIds = [] }) {
  ensureDocsDir();
  const id = randomUUID();
  const doc = {
    id,
    title,
    workspaceId: workspaceId || 'ws-default',
    projectId: projectId || null,
    nodeIds,
    createdAt: new Date().toISOString(),
    length: content.length
  };
  db.documents.push(doc);
  const parts = chunkText(content);
  parts.forEach((text, i) => {
    db.chunks.push({
      id: randomUUID(),
      documentId: id,
      index: i,
      text,
      tokens: tokenize(text),
      nodeIds,
      workspaceId: doc.workspaceId
    });
  });
  // save raw file
  fs.writeFileSync(path.join(DOCS_DIR, `${id}.txt`), content, 'utf8');
  return { document: doc, chunks: parts.length };
}

export function retrieve(db, query, { workspaceId, limit = 5 } = {}) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  let chunks = db.chunks || [];
  if (workspaceId) chunks = chunks.filter(c => c.workspaceId === workspaceId);
  const scored = chunks.map(c => {
    let score = 0;
    for (const t of qTokens) {
      if (c.tokens.includes(t)) score += 1;
      if (c.text.toLowerCase().includes(t)) score += 0.5;
    }
    return { ...c, score };
  }).filter(c => c.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(c => ({
    chunkId: c.id,
    documentId: c.documentId,
    text: c.text,
    score: c.score,
    nodeIds: c.nodeIds
  }));
}

export function seedDefaultDocs(db) {
  if (db.documents?.length) return;
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
    ingestDocument(db, { ...d, workspaceId: 'ws-default', projectId: 'prj-bank' });
  }
}
