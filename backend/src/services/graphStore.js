/**
 * Graph Engine — in-memory store
 * Implements: self-hosting (1.2), layers (2.2), actors (3.3),
 * Interest Scope computed (3.2), Review first-class (2.3),
 * WorkItem/Issue (2.5), Pipe not hard-coded (2.6)
 */
import { randomUUID } from 'crypto';

const nodes = new Map();
const edges = new Map();
const actors = new Map();
const workItems = new Map();
const reviews = new Map();
const sprints = new Map();
const pipes = new Map();
const questions = [];

function seed() {
  [
    { id: 'act-val', type: 'Human', name: 'Валерий (практик)', roles: ['Заказчик', 'Эксперт'] },
    { id: 'act-econ', type: 'Human', name: 'Экономист', roles: ['Owner формы'] },
    { id: 'act-tech', type: 'Human', name: 'Технолог', roles: ['Owner алгоритмов'] },
    { id: 'act-dev', type: 'Human', name: 'Разработчик', roles: ['Исполнитель'] },
    { id: 'act-aian', type: 'Human', name: 'Инженер ИИ', roles: ['Owner модели знаний'] },
    { id: 'act-ai', type: 'AIAgent', name: 'Graph Copilot', roles: ['Аналитик', 'Ассистент'] },
    { id: 'act-svc', type: 'Service', name: 'Synthetic Stand', roles: ['Верификатор'] }
  ].forEach(a => actors.set(a.id, a));

  [
    { id: 'core', label: 'Граф знаний', kind: 'Ядро', layer: 'Knowledge', nodeKind: 'core', description: 'Каждое знание один раз. Формы связывают объекты.' },
    { id: 'reg', label: 'Regulatory Knowledge', kind: 'Нормативка', layer: 'Knowledge', nodeKind: 'domain', description: '809-П, 6406-У, ФЛК' },
    { id: 'ods', label: 'ODS Knowledge', kind: 'Модель данных', layer: 'Knowledge', nodeKind: 'domain', description: 'Сущности, lineage, владельцы' },
    { id: 'rep', label: 'Reporting Knowledge', kind: 'Формы', layer: 'Knowledge', nodeKind: 'domain', description: '0409101 пилот' },
    { id: 'ctrl', label: 'Control Knowledge', kind: 'Контроль', layer: 'Knowledge', nodeKind: 'domain', description: 'КС, DELTA, контрольные отчёты' },
    { id: 'dom', label: 'Banking Domain', kind: 'Понятия', layer: 'Knowledge', nodeKind: 'domain', description: 'Счета, СПОД, переоценка' },
    { id: 'proc', label: 'Process Knowledge', kind: 'Регламенты', layer: 'Knowledge', nodeKind: 'domain', description: 'ETL, расчёт, настройки' },
    { id: 'ai', label: 'AI Knowledge', kind: 'ИИ', layer: 'Knowledge', nodeKind: 'domain', description: 'Промты, eval, правила' },
    { id: 'stand', label: 'Synthetic Stand', kind: 'Сервис', layer: 'Implementation', nodeKind: 'service', description: 'Синтетика + КС' },
    { id: 'valid', label: 'Validation', kind: 'Сервис', layer: 'Implementation', nodeKind: 'service', description: 'Эталоны' },
    { id: 'migr', label: 'Migration', kind: 'Сервис', layer: 'Implementation', nodeKind: 'service', description: 'Перенос в контур' },
    { id: 'econ', label: 'Экономист', kind: 'Роль', layer: 'Resource', nodeKind: 'role', description: 'Сдаёт форму, отвечает за результат' },
    { id: 'aian', label: 'Инженер ИИ', kind: 'Роль', layer: 'Resource', nodeKind: 'role', description: 'Модель знаний, обучение' },
    { id: 'cb', label: 'ЦБ РФ', kind: 'Внешняя', layer: 'Knowledge', nodeKind: 'role', description: 'Регулятор' },
    { id: 'self-graph', label: 'Graph Engine', kind: 'Platform', layer: 'Implementation', nodeKind: 'service', description: 'Self-host: движок графа' },
    { id: 'self-copilot', label: 'Graph Copilot', kind: 'Platform', layer: 'Implementation', nodeKind: 'service', description: 'Self-host: чат с графом' },
    { id: 'self-pi', label: 'Platform Interactive', kind: 'Platform', layer: 'Implementation', nodeKind: 'service', description: 'PI: панели, сценарии' }
  ].forEach(n => nodes.set(n.id, n));

  [
    { id: 'e1', source: 'reg', target: 'core', label: 'объекты' },
    { id: 'e2', source: 'ods', target: 'core', label: 'объекты' },
    { id: 'e3', source: 'rep', target: 'core', label: 'проекции' },
    { id: 'e4', source: 'ctrl', target: 'core', label: 'объекты' },
    { id: 'e5', source: 'dom', target: 'core', label: 'объекты' },
    { id: 'e6', source: 'proc', target: 'core', label: 'объекты' },
    { id: 'e7', source: 'ai', target: 'core', label: 'обход' },
    { id: 'e8', source: 'stand', target: 'core', label: 'проверка' },
    { id: 'e9', source: 'valid', target: 'core', label: 'эталоны' },
    { id: 'e10', source: 'migr', target: 'core', label: 'перенос' },
    { id: 'e11', source: 'econ', target: 'ctrl', label: 'инструмент' },
    { id: 'e12', source: 'econ', target: 'cb', label: 'сдача' },
    { id: 'e13', source: 'aian', target: 'ai', label: 'модель' },
    { id: 'e14', source: 'aian', target: 'core', label: 'наполнение' },
    { id: 'e15', source: 'self-graph', target: 'core', label: 'self-host' },
    { id: 'e16', source: 'self-copilot', target: 'ai', label: 'self-host' },
    { id: 'e17', source: 'self-pi', target: 'self-graph', label: 'uses' }
  ].forEach(e => edges.set(e.id, e));

  [
    { id: 'wi-1', type: 'ChangeRequest', title: 'Выделить Control Knowledge', status: 'done', actorIds: ['act-val'], relatedNodeIds: ['ctrl', 'core'], layer: 'Knowledge' },
    { id: 'wi-2', type: 'KnowledgeDefect', title: 'Разрыв Process ↔ ETL', status: 'open', actorIds: ['act-aian'], relatedNodeIds: ['proc'], layer: 'Knowledge' },
    { id: 'wi-3', type: 'Task', title: 'Interest Scope вычислять', status: 'open', actorIds: ['act-ai'], relatedNodeIds: ['core', 'aian'], layer: 'Implementation' },
    { id: 'wi-4', type: 'Risk', title: 'Знания в головах', status: 'open', actorIds: ['act-val'], relatedNodeIds: ['core'], layer: 'Resource' },
    { id: 'wi-5', type: 'ReviewComment', title: 'Вторая форма ≠ 101', status: 'in_progress', actorIds: ['act-val', 'act-aian'], relatedNodeIds: ['rep'], layer: 'Project' }
  ].forEach(w => workItems.set(w.id, w));

  [
    { id: 'r1', n: 1, scope: { artifactId: 'stand', version: 'v1' }, authorId: 'act-val', status: 'accepted', text: 'Центром — платформа знаний.', answer: 'Схема перестроена.', date: '16.07' },
    { id: 'r2', n: 2, scope: { artifactId: 'core', version: 'v5' }, authorId: 'act-val', status: 'accepted', text: 'Нужны проекции по ролям.', answer: 'Добавлен переключатель.', date: '17.07' },
    { id: 'r3', n: 3, scope: { artifactId: 'ctrl' }, authorId: 'act-val', status: 'accepted', text: 'Контрольные отчёты — домен.', answer: 'Control Knowledge добавлен.', date: '17.07' }
  ].forEach(r => reviews.set(r.id, r));

  sprints.set('sp1', { id: 'sp1', name: 'Sprint 1 — Модель', start: '2026-07-10', end: '2026-07-17', workItemIds: ['wi-1', 'wi-2'] });
  sprints.set('sp2', { id: 'sp2', name: 'Sprint 2 — Движки', start: '2026-07-18', end: '2026-07-25', workItemIds: ['wi-3', 'wi-5'] });
  pipes.set('pipe-1', { id: 'pipe-1', name: 'Поток Control Knowledge', stages: ['analysis', 'design', 'dev', 'review'], workItemIds: ['wi-1', 'wi-2'] });
}

seed();

export const store = {
  getNodes: () => [...nodes.values()],
  getEdges: () => [...edges.values()],
  getNode: (id) => nodes.get(id),
  getActors: () => [...actors.values()],
  getWorkItems: (layer) => {
    const all = [...workItems.values()];
    return layer ? all.filter(w => w.layer === layer) : all;
  },
  getReviews: () => [...reviews.values()],
  getSprints: () => [...sprints.values()],
  getPipes: () => [...pipes.values()],
  getNeighbors(nodeId) {
    const related = new Set([nodeId]);
    for (const e of edges.values()) {
      if (e.source === nodeId) related.add(e.target);
      if (e.target === nodeId) related.add(e.source);
    }
    return [...related];
  },
  computeInterestScope(actorId) {
    const actor = actors.get(actorId);
    if (!actor) return { actorId, nodeIds: [], workItemIds: [], roles: [] };
    const wis = [...workItems.values()].filter(w => w.actorIds.includes(actorId));
    const nodeIds = new Set();
    wis.forEach(w => w.relatedNodeIds.forEach(id => nodeIds.add(id)));
    [...nodeIds].forEach(id => this.getNeighbors(id).forEach(n => nodeIds.add(n)));
    return { actorId, nodeIds: [...nodeIds], workItemIds: wis.map(w => w.id), roles: actor.roles };
  },
  addReview(payload) {
    const id = randomUUID();
    const n = reviews.size + 1;
    const rev = { id, n, date: new Date().toLocaleDateString('ru-RU'), status: 'open', local: true, ...payload };
    reviews.set(id, rev);
    return rev;
  },
  addQuestion(q) {
    const item = { id: randomUUID(), ts: Date.now(), ...q };
    questions.push(item);
    return item;
  },
  getQuestions: () => questions,
  getSubgraph(nodeIds) {
    const set = new Set(nodeIds);
    return {
      nodes: [...nodes.values()].filter(n => set.has(n.id)),
      edges: [...edges.values()].filter(e => set.has(e.source) && set.has(e.target))
    };
  },
  search(query) {
    const q = (query || '').toLowerCase();
    if (!q) return { nodes: [], workItems: [] };
    return {
      nodes: [...nodes.values()].filter(n =>
        n.label.toLowerCase().includes(q) || (n.description || '').toLowerCase().includes(q)
      ),
      workItems: [...workItems.values()].filter(w => w.title.toLowerCase().includes(q))
    };
  }
};
