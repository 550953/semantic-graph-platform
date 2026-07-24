import { getDb, jstr } from './database.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DEFAULT_PROFILE } from '../engines/ontology.js';

function tokenize(text) {
  return (text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

function chunkText(text, size = 80) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    const t = words.slice(i, i + size).join(' ');
    if (t.trim().length > 15) chunks.push(t);
  }
  return chunks;
}

export function seedIfEmpty() {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS c FROM workspaces').get();
  if (row.c > 0) return false;

  const insertWs = db.prepare('INSERT INTO workspaces (id, name, type) VALUES (?, ?, ?)');
  const insertPf = db.prepare('INSERT INTO portfolios (id, workspace_id, name) VALUES (?, ?, ?)');
  const insertPr = db.prepare('INSERT INTO projects (id, workspace_id, portfolio_id, name) VALUES (?, ?, ?, ?)');
  const insertUser = db.prepare('INSERT INTO users (id, email, password_hash, name, role, workspace_id) VALUES (?, ?, ?, ?, ?, ?)');
  const insertMem = db.prepare('INSERT INTO memberships (user_id, workspace_id, role) VALUES (?, ?, ?)');
  const insertActor = db.prepare('INSERT INTO actors (id, workspace_id, type, name, roles_json) VALUES (?, ?, ?, ?, ?)');
  const insertNode = db.prepare(`INSERT INTO nodes (id, workspace_id, project_id, tab, label, kind, layer, node_kind, description, badge)
    VALUES (@id, @workspace_id, @project_id, @tab, @label, @kind, @layer, @node_kind, @description, @badge)`);
  const insertEdge = db.prepare(`INSERT INTO edges (id, workspace_id, tab, source, target, label) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertWI = db.prepare(`INSERT INTO work_items (id, workspace_id, project_id, type, title, status, layer, actor_ids_json, related_node_ids_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertRev = db.prepare(`INSERT INTO reviews (id, workspace_id, n, scope_json, author_id, status, text, answer, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertOnt = db.prepare('INSERT INTO ontology (workspace_id, profile_json) VALUES (?, ?)');
  const insertDoc = db.prepare(`INSERT INTO documents (id, workspace_id, project_id, title, length, node_ids_json) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertChunk = db.prepare(`INSERT INTO chunks (id, document_id, workspace_id, idx, text, tokens_json, node_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?)`);

  const tx = db.transaction(() => {
    insertWs.run('ws-default', 'Bank Knowledge Workspace', 'company');
    insertWs.run('ws-demo', 'Demo Studio', 'studio');
    insertPf.run('pf-main', 'ws-default', 'Reporting Portfolio');
    insertPr.run('prj-bank', 'ws-default', 'pf-main', 'Regulatory Reporting');
    insertPr.run('prj-demo', 'ws-demo', null, 'Demo Project');

    const adminId = 'user-admin';
    insertUser.run(adminId, 'admin@graph.local', bcrypt.hashSync('admin123', 8), 'Admin', 'admin', 'ws-default');
    insertMem.run(adminId, 'ws-default', 'admin');
    insertMem.run(adminId, 'ws-demo', 'admin');

    const actors = [
      ['act-val', 'ws-default', 'Human', 'Валерий (практик)', ['Заказчик', 'Эксперт']],
      ['act-econ', 'ws-default', 'Human', 'Экономист', ['Owner']],
      ['act-aian', 'ws-default', 'Human', 'Инженер ИИ', ['Owner']],
      ['act-ai', 'ws-default', 'AIAgent', 'Graph Copilot', ['Ассистент']],
      ['act-dev', 'ws-default', 'Human', 'Разработчик', ['Исполнитель']],
      ['act-cb-sys', 'ws-default', 'ExternalSystem', 'KLIKO / ЦБ канал', ['External']],
      ['act-owner', 'ws-default', 'Human', 'Owner платформы', ['Owner']]
    ];
    actors.forEach(a => insertActor.run(a[0], a[1], a[2], a[3], jstr(a[4])));

    const nodes = [
      // asis
      { id: 'a-auditor', tab: 'asis', label: 'Аудитор ЦБ', kind: 'Внешняя', layer: 'Resource', node_kind: 'role', description: 'Проверка цифр вручную', badge: null },
      { id: 'a-tech', tab: 'asis', label: 'Технолог', kind: 'Банк', layer: 'Resource', node_kind: 'role', description: 'ТЗ по нормативке', badge: null },
      { id: 'a-dev', tab: 'asis', label: 'Разработчик', kind: 'Банк', layer: 'Resource', node_kind: 'role', description: 'SQL расчёт', badge: null },
      { id: 'a-econ', tab: 'asis', label: 'Экономист', kind: 'Банк', layer: 'Resource', node_kind: 'role', description: 'Сдача формы', badge: null },
      { id: 'a-cb', tab: 'asis', label: 'ЦБ РФ', kind: 'Внешняя', layer: 'Knowledge', node_kind: 'role', description: 'Регулятор', badge: null },
      { id: 'a-abs', tab: 'asis', label: 'АБС', kind: 'Источник', layer: 'Implementation', node_kind: 'domain', description: 'Счета и проводки', badge: null },
      { id: 'a-ods', tab: 'asis', label: 'ODS', kind: 'Данные', layer: 'Implementation', node_kind: 'domain', description: 'ETL слой', badge: null },
      { id: 'a-frw', tab: 'asis', label: 'Расчётный фреймворк', kind: 'Расчёт', layer: 'Implementation', node_kind: 'domain', description: 'Настройки + SQL', badge: null },
      { id: 'a-f101', tab: 'asis', label: 'Форма 0409101', kind: 'Результат', layer: 'Knowledge', node_kind: 'domain', description: 'КС и ФЛК', badge: null },
      { id: 'a-heads', tab: 'asis', label: 'Знания в головах', kind: 'Люди', layer: 'Resource', node_kind: 'note', description: 'Носители опыта', badge: null },
      // process
      { id: 's1', tab: 'process', label: 'Срез 101 синтетика', kind: 'Шаг', layer: 'Project', node_kind: 'step', description: 'Стенд и КС', badge: 'done' },
      { id: 's2', tab: 'process', label: 'Вторая форма', kind: 'Шаг', layer: 'Project', node_kind: 'step', description: 'Не похожа на 101', badge: 'next' },
      { id: 's3', tab: 'process', label: 'ODS Knowledge Model', kind: 'Шаг', layer: 'Project', node_kind: 'step', description: 'Внутри контура', badge: 'inside' },
      { id: 's4', tab: 'process', label: 'Конвертация SQL', kind: 'Шаг', layer: 'Project', node_kind: 'step', description: 'Внутренний диалект', badge: 'inside' },
      { id: 's5', tab: 'process', label: 'Боевая сверка', kind: 'Шаг', layer: 'Project', node_kind: 'step', description: 'Реальные данные', badge: 'inside' },
      { id: 's6', tab: 'process', label: 'Программа', kind: 'Шаг', layer: 'Project', node_kind: 'step', description: 'Масштаб', badge: 'inside' },
      { id: 'p-aian', tab: 'process', label: 'Инженер ИИ', kind: 'Центр', layer: 'Resource', node_kind: 'role', description: 'Ведёт переход', badge: null },
      // tobe
      { id: 'core', tab: 'tobe', label: 'Граф знаний', kind: 'Ядро', layer: 'Knowledge', node_kind: 'core', description: 'Знание один раз', badge: null },
      { id: 'reg', tab: 'tobe', label: 'Regulatory Knowledge', kind: 'Нормативка', layer: 'Knowledge', node_kind: 'domain', description: '809-П, 6406-У, ФЛК', badge: null },
      { id: 'ods', tab: 'tobe', label: 'ODS Knowledge', kind: 'Модель', layer: 'Knowledge', node_kind: 'domain', description: 'Lineage', badge: null },
      { id: 'rep', tab: 'tobe', label: 'Reporting Knowledge', kind: 'Формы', layer: 'Knowledge', node_kind: 'domain', description: '0409101', badge: null },
      { id: 'ctrl', tab: 'tobe', label: 'Control Knowledge', kind: 'Контроль', layer: 'Knowledge', node_kind: 'domain', description: 'КС, DELTA', badge: null },
      { id: 'dom', tab: 'tobe', label: 'Banking Domain', kind: 'Понятия', layer: 'Knowledge', node_kind: 'domain', description: 'Счета, СПОД', badge: null },
      { id: 'proc', tab: 'tobe', label: 'Process Knowledge', kind: 'Регламенты', layer: 'Knowledge', node_kind: 'domain', description: 'ETL, расчёт', badge: null },
      { id: 'ai', tab: 'tobe', label: 'AI Knowledge', kind: 'ИИ', layer: 'Knowledge', node_kind: 'domain', description: 'Промты, eval', badge: null },
      { id: 'stand', tab: 'tobe', label: 'Synthetic Stand', kind: 'Сервис', layer: 'Implementation', node_kind: 'service', description: 'Синтетика', badge: null },
      { id: 'valid', tab: 'tobe', label: 'Validation', kind: 'Сервис', layer: 'Implementation', node_kind: 'service', description: 'Эталоны', badge: null },
      { id: 'migr', tab: 'tobe', label: 'Migration', kind: 'Сервис', layer: 'Implementation', node_kind: 'service', description: 'В контур', badge: null },
      { id: 'econ', tab: 'tobe', label: 'Экономист', kind: 'Роль', layer: 'Resource', node_kind: 'role', description: 'Сдаёт форму', badge: null },
      { id: 'aian', tab: 'tobe', label: 'Инженер ИИ', kind: 'Роль', layer: 'Resource', node_kind: 'role', description: 'Модель знаний', badge: null },
      { id: 'cb', tab: 'tobe', label: 'ЦБ РФ', kind: 'Внешняя', layer: 'Knowledge', node_kind: 'role', description: 'Регулятор', badge: null },
      { id: 'self-graph', tab: 'tobe', label: 'Graph Engine', kind: 'Platform', layer: 'Implementation', node_kind: 'service', description: 'Self-host', badge: null },
      { id: 'self-copilot', tab: 'tobe', label: 'Graph Copilot', kind: 'Platform', layer: 'Implementation', node_kind: 'service', description: 'Self-host chat', badge: null }
    ];

    for (const n of nodes) {
      insertNode.run({
        id: n.id,
        workspace_id: 'ws-default',
        project_id: 'prj-bank',
        tab: n.tab,
        label: n.label,
        kind: n.kind,
        layer: n.layer,
        node_kind: n.node_kind,
        description: n.description,
        badge: n.badge
      });
    }

    const edges = [
      ['ae1', 'asis', 'a-abs', 'a-ods', 'ETL'],
      ['ae2', 'asis', 'a-ods', 'a-frw', 'данные'],
      ['ae3', 'asis', 'a-frw', 'a-f101', 'расчёт'],
      ['ae4', 'asis', 'a-econ', 'a-f101', 'сдача'],
      ['ae5', 'asis', 'a-f101', 'a-cb', 'KLIKO'],
      ['ae6', 'asis', 'a-tech', 'a-dev', 'ТЗ'],
      ['pe1', 'process', 's1', 's2', 'ядро'],
      ['pe2', 'process', 's2', 's3', 'контур'],
      ['pe3', 'process', 's3', 's4', 'SQL'],
      ['pe4', 'process', 's4', 's5', 'сверка'],
      ['pe5', 'process', 's5', 's6', 'программа'],
      ['pe6', 'process', 'p-aian', 's1', 'ведёт'],
      ['te1', 'tobe', 'reg', 'core', 'объекты'],
      ['te2', 'tobe', 'ods', 'core', 'объекты'],
      ['te3', 'tobe', 'rep', 'core', 'проекции'],
      ['te4', 'tobe', 'ctrl', 'core', 'объекты'],
      ['te5', 'tobe', 'dom', 'core', 'объекты'],
      ['te6', 'tobe', 'proc', 'core', 'объекты'],
      ['te7', 'tobe', 'ai', 'core', 'обход'],
      ['te8', 'tobe', 'stand', 'core', 'проверка'],
      ['te9', 'tobe', 'valid', 'core', 'эталоны'],
      ['te10', 'tobe', 'migr', 'core', 'перенос'],
      ['te11', 'tobe', 'econ', 'ctrl', 'инструмент'],
      ['te12', 'tobe', 'econ', 'cb', 'сдача'],
      ['te13', 'tobe', 'aian', 'ai', 'модель'],
      ['te14', 'tobe', 'aian', 'core', 'наполнение'],
      ['te15', 'tobe', 'self-graph', 'core', 'self-host'],
      ['te16', 'tobe', 'self-copilot', 'ai', 'self-host']
    ];
    edges.forEach(e => insertEdge.run(e[0], 'ws-default', e[1], e[2], e[3], e[4]));

    insertWI.run('wi-1', 'ws-default', 'prj-bank', 'ChangeRequest', 'Выделить Control Knowledge', 'done', 'Knowledge', jstr(['act-val']), jstr(['ctrl', 'core']));
    insertWI.run('wi-2', 'ws-default', 'prj-bank', 'KnowledgeDefect', 'Разрыв Process ↔ ETL', 'open', 'Knowledge', jstr(['act-aian']), jstr(['proc']));
    insertWI.run('wi-3', 'ws-default', 'prj-bank', 'Task', 'Interest Scope auto', 'open', 'Implementation', jstr(['act-ai']), jstr(['core']));
    insertWI.run('wi-4', 'ws-default', 'prj-bank', 'Risk', 'Знания в головах', 'open', 'Resource', jstr(['act-val']), jstr(['a-heads']));

    insertRev.run('r1', 'ws-default', 1, jstr({ projectId: 'prj-bank', artifactId: 'stand', version: 'v1' }), 'act-val', 'accepted', 'Центр — платформа знаний', 'Схема перестроена', '16.07');
    insertRev.run('r2', 'ws-default', 2, jstr({ projectId: 'prj-bank', artifactId: 'core', version: 'v5' }), 'act-val', 'accepted', 'Проекции по ролям', 'Role switcher', '17.07');

    insertOnt.run('ws-default', jstr(DEFAULT_PROFILE));
    insertOnt.run('ws-demo', jstr(DEFAULT_PROFILE));

    // Role on relation Actor↔Object (Заказчик ≠ Owner)
    try {
      const insRB = db.prepare('INSERT OR IGNORE INTO role_bindings (id, workspace_id, actor_id, object_id, role) VALUES (?, ?, ?, ?, ?)');
      insRB.run('rb1', 'ws-default', 'act-val', 'prj-bank', 'Заказчик');
      insRB.run('rb2', 'ws-default', 'act-owner', 'prj-bank', 'Owner');
      insRB.run('rb3', 'ws-default', 'act-econ', 'a-f101', 'Owner');
      insRB.run('rb4', 'ws-default', 'act-val', 'core', 'Заказчик');
    } catch (e) { /* table may be new */ }


    const docs = [
      {
        title: 'Архитектура Graph Platform',
        content: 'Graph Platform: Graph Engine, FSM Engine, Review Engine, Ontology Engine, RAG Engine, Visualization Engine, LLM Gateway. PI выше React Flow. Default First, Configure Second, Extend Third. Transformation Graph: Knowledge, Implementation, Project, Resource. Interest Scope вычисляется. Actor = Human | AIAgent | Service. Pipe не формализована жёстко. DeepSeek и OpenAI через единый LLM Gateway.',
        nodes: ['core', 'self-graph', 'self-copilot']
      },
      {
        title: 'Форма 0409101 и контроль',
        content: 'Форма 0409101 — оборотная ведомость. КС — контрольные соотношения. ФЛК — форматно-логический контроль ЦБ. Control Knowledge — контрольные отчёты, КС, DELTA. Экономист отвечает за сдачу. ODS — единый слой. Lineage — путь цифры до операции.',
        nodes: ['rep', 'ctrl', 'ods', 'econ']
      },
      {
        title: 'Переход As-is to To-be',
        content: 'Шаги: синтетика 101, вторая форма, ODS Knowledge Model, конвертация SQL, боевая сверка, программа. Инженер ИИ ведёт синтетику, модель, eval и обучение. В as-is знания в ТЗ и головах.',
        nodes: ['s1', 's2', 'p-aian', 'a-heads']
      }
    ];
    for (const d of docs) {
      const id = randomUUID();
      insertDoc.run(id, 'ws-default', 'prj-bank', d.title, d.content.length, jstr(d.nodes));
      chunkText(d.content).forEach((text, i) => {
        insertChunk.run(randomUUID(), id, 'ws-default', i, text, jstr(tokenize(text)), jstr(d.nodes));
      });
    }
  });

  tx();
  return true;
}
