import { queryAll, queryOne, queryRun, withTransaction } from './pool.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DEFAULT_PROFILE } from '../engines/ontology.js';

function jstr(obj) { return JSON.stringify(obj); }

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

export async function seedIfEmpty() {
  const row = await queryOne('SELECT COUNT(*) AS c FROM workspaces', []);
  if (Number(row?.c) > 0) return false;

  await withTransaction(async (tx) => {
    // Workspaces
    await tx.queryRun('INSERT INTO workspaces (id, name, type) VALUES (?, ?, ?)', ['ws-default', 'Банк — Граф знаний', 'company']);
    await tx.queryRun('INSERT INTO workspaces (id, name, type) VALUES (?, ?, ?)', ['ws-demo', 'Demo Workspace', 'studio']);

    // Portfolios & projects
    await tx.queryRun('INSERT INTO portfolios (id, workspace_id, name) VALUES (?, ?, ?)', ['pf-bank', 'ws-default', 'Форма 0409101']);
    await tx.queryRun('INSERT INTO projects (id, workspace_id, portfolio_id, name) VALUES (?, ?, ?, ?)', ['prj-bank', 'ws-default', 'pf-bank', 'Миграция знаний 101']);

    // Users
    const pwHash = bcrypt.hashSync('admin123', 10);
    await tx.queryRun(
      'INSERT INTO users (id, email, password_hash, name, role, workspace_id) VALUES (?, ?, ?, ?, ?, ?)',
      ['u-admin', 'admin@example.com', pwHash, 'Admin', 'admin', 'ws-default']
    );
    await tx.queryRun(
      'INSERT INTO memberships (user_id, workspace_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      ['u-admin', 'ws-default', 'admin']
    );

    // Actors
    const actors = [
      ['act-val', 'ws-default', 'Human', 'Валерий (практик)', jstr(['Заказчик', 'Эксперт'])],
      ['act-econ', 'ws-default', 'Human', 'Экономист', jstr(['Owner формы'])],
      ['act-tech', 'ws-default', 'Human', 'Технолог', jstr(['Owner алгоритмов'])],
      ['act-dev', 'ws-default', 'Human', 'Разработчик', jstr(['Исполнитель'])],
      ['act-aian', 'ws-default', 'Human', 'Инженер ИИ', jstr(['Owner модели знаний'])],
      ['act-ai', 'ws-default', 'AIAgent', 'Graph Copilot', jstr(['Аналитик', 'Ассистент'])],
      ['act-svc', 'ws-default', 'Service', 'Synthetic Stand', jstr(['Верификатор'])],
      ['act-owner', 'ws-default', 'Human', 'Owner', jstr(['Owner'])],
    ];
    for (const [id, ws, type, name, roles] of actors) {
      await tx.queryRun('INSERT INTO actors (id, workspace_id, type, name, roles_json) VALUES (?, ?, ?, ?, ?)', [id, ws, type, name, roles]);
    }

    // Nodes — asis tab
    const nodes = [
      ['core', 'ws-default', 'prj-bank', 'asis', 'Граф знаний', 'Ядро', 'Knowledge', 'core', 'Каждое знание один раз. Формы связывают объекты.', null],
      ['reg', 'ws-default', 'prj-bank', 'asis', 'Regulatory Knowledge', 'Нормативка', 'Knowledge', 'domain', '809-П, 6406-У, ФЛК', null],
      ['ods', 'ws-default', 'prj-bank', 'asis', 'ODS Knowledge', 'Модель данных', 'Knowledge', 'domain', 'Сущности, lineage, владельцы', null],
      ['rep', 'ws-default', 'prj-bank', 'asis', 'Reporting Knowledge', 'Формы', 'Knowledge', 'domain', '0409101 пилот', null],
      ['ctrl', 'ws-default', 'prj-bank', 'asis', 'Control Knowledge', 'Контроль', 'Knowledge', 'domain', 'КС, DELTA, контрольные отчёты', null],
      ['dom', 'ws-default', 'prj-bank', 'asis', 'Banking Domain', 'Понятия', 'Knowledge', 'domain', 'Счета, СПОД, переоценка', null],
      ['proc', 'ws-default', 'prj-bank', 'asis', 'Process Knowledge', 'Регламенты', 'Knowledge', 'domain', 'ETL, расчёт, настройки', null],
      ['ai', 'ws-default', 'prj-bank', 'asis', 'AI Knowledge', 'ИИ', 'Knowledge', 'domain', 'Промты, eval, правила', null],
      ['stand', 'ws-default', 'prj-bank', 'asis', 'Synthetic Stand', 'Сервис', 'Implementation', 'service', 'Синтетика + КС', null],
      ['valid', 'ws-default', 'prj-bank', 'asis', 'Validation', 'Сервис', 'Implementation', 'service', 'Эталоны', null],
      ['migr', 'ws-default', 'prj-bank', 'asis', 'Migration', 'Сервис', 'Implementation', 'service', 'Перенос в контур', null],
      ['econ', 'ws-default', 'prj-bank', 'asis', 'Экономист', 'Роль', 'Resource', 'role', 'Сдаёт форму, отвечает за результат', null],
      ['aian', 'ws-default', 'prj-bank', 'asis', 'Инженер ИИ', 'Роль', 'Resource', 'role', 'Модель знаний, обучение', null],
      ['cb', 'ws-default', 'prj-bank', 'asis', 'ЦБ РФ', 'Внешняя', 'Knowledge', 'role', 'Регулятор', null],
      ['self-graph', 'ws-default', 'prj-bank', 'asis', 'Graph Engine', 'Platform', 'Implementation', 'service', 'Self-host: движок графа', null],
      ['self-copilot', 'ws-default', 'prj-bank', 'asis', 'Graph Copilot', 'Platform', 'Implementation', 'service', 'Self-host: чат с графом', null],
      ['self-pi', 'ws-default', 'prj-bank', 'asis', 'Platform Interactive', 'Platform', 'Implementation', 'service', 'PI: панели, сценарии', null],
      // as-is specific
      ['a-heads', 'ws-default', 'prj-bank', 'asis', 'Знания в головах', 'Проблема', 'Knowledge', 'domain', 'Не формализованы', null],
      ['a-f101', 'ws-default', 'prj-bank', 'asis', 'Форма 101', 'Артефакт', 'Knowledge', 'domain', 'Текущая форма', null],
    ];
    for (const [id, ws, proj, tab, label, kind, layer, nk, desc, badge] of nodes) {
      await tx.queryRun(
        'INSERT INTO nodes (id, workspace_id, project_id, tab, label, kind, layer, node_kind, description, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, ws, proj, tab, label, kind, layer, nk, desc, badge]
      );
    }

    // Edges — asis
    const edges = [
      ['e1', 'ws-default', 'asis', 'reg', 'core', 'объекты'],
      ['e2', 'ws-default', 'asis', 'ods', 'core', 'объекты'],
      ['e3', 'ws-default', 'asis', 'rep', 'core', 'проекции'],
      ['e4', 'ws-default', 'asis', 'ctrl', 'core', 'объекты'],
      ['e5', 'ws-default', 'asis', 'dom', 'core', 'объекты'],
      ['e6', 'ws-default', 'asis', 'proc', 'core', 'объекты'],
      ['e7', 'ws-default', 'asis', 'ai', 'core', 'обход'],
      ['e8', 'ws-default', 'asis', 'stand', 'core', 'проверка'],
      ['e9', 'ws-default', 'asis', 'valid', 'core', 'эталоны'],
      ['e10', 'ws-default', 'asis', 'migr', 'core', 'перенос'],
      ['e11', 'ws-default', 'asis', 'econ', 'ctrl', 'инструмент'],
      ['e12', 'ws-default', 'asis', 'econ', 'cb', 'сдача'],
      ['e13', 'ws-default', 'asis', 'aian', 'ai', 'модель'],
      ['e14', 'ws-default', 'asis', 'aian', 'core', 'наполнение'],
      ['e15', 'ws-default', 'asis', 'a-heads', 'proc', 'хранятся в'],
      ['e16', 'ws-default', 'asis', 'a-f101', 'rep', 'текущая'],
    ];
    for (const [id, ws, tab, src, tgt, lbl] of edges) {
      await tx.queryRun('INSERT INTO edges (id, workspace_id, tab, source, target, label) VALUES (?, ?, ?, ?, ?, ?)', [id, ws, tab, src, tgt, lbl]);
    }

    // Work items
    await tx.queryRun('INSERT INTO work_items (id, workspace_id, project_id, type, title, status, layer, actor_ids_json, related_node_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['wi-1', 'ws-default', 'prj-bank', 'ChangeRequest', 'Выделить Control Knowledge', 'done', 'Knowledge', jstr(['act-val']), jstr(['ctrl', 'core'])]);
    await tx.queryRun('INSERT INTO work_items (id, workspace_id, project_id, type, title, status, layer, actor_ids_json, related_node_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['wi-2', 'ws-default', 'prj-bank', 'KnowledgeDefect', 'Разрыв Process ↔ ETL', 'open', 'Knowledge', jstr(['act-aian']), jstr(['proc'])]);
    await tx.queryRun('INSERT INTO work_items (id, workspace_id, project_id, type, title, status, layer, actor_ids_json, related_node_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['wi-3', 'ws-default', 'prj-bank', 'Task', 'Interest Scope auto', 'open', 'Implementation', jstr(['act-ai']), jstr(['core'])]);
    await tx.queryRun('INSERT INTO work_items (id, workspace_id, project_id, type, title, status, layer, actor_ids_json, related_node_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['wi-4', 'ws-default', 'prj-bank', 'Risk', 'Знания в головах', 'open', 'Resource', jstr(['act-val']), jstr(['a-heads'])]);

    // Reviews
    await tx.queryRun('INSERT INTO reviews (id, workspace_id, n, scope_json, author_id, status, text, answer, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['r1', 'ws-default', 1, jstr({ projectId: 'prj-bank', artifactId: 'stand', version: 'v1' }), 'act-val', 'accepted', 'Центр — платформа знаний', 'Схема перестроена', '16.07']);
    await tx.queryRun('INSERT INTO reviews (id, workspace_id, n, scope_json, author_id, status, text, answer, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['r2', 'ws-default', 2, jstr({ projectId: 'prj-bank', artifactId: 'core', version: 'v5' }), 'act-val', 'accepted', 'Проекции по ролям', 'Role switcher', '17.07']);

    // Ontology
    await tx.queryRun('INSERT INTO ontology (workspace_id, profile_json) VALUES (?, ?)', ['ws-default', jstr(DEFAULT_PROFILE)]);
    await tx.queryRun('INSERT INTO ontology (workspace_id, profile_json) VALUES (?, ?) ON CONFLICT DO NOTHING', ['ws-demo', jstr(DEFAULT_PROFILE)]);

    // Role bindings
    const rbs = [
      ['rb1', 'ws-default', 'act-val', 'prj-bank', 'Заказчик'],
      ['rb2', 'ws-default', 'act-owner', 'prj-bank', 'Owner'],
      ['rb3', 'ws-default', 'act-econ', 'a-f101', 'Owner'],
      ['rb4', 'ws-default', 'act-val', 'core', 'Заказчик'],
    ];
    for (const [id, ws, actorId, objectId, role] of rbs) {
      try {
        await tx.queryRun('INSERT INTO role_bindings (id, workspace_id, actor_id, object_id, role) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING', [id, ws, actorId, objectId, role]);
      } catch {}
    }

    // Documents & chunks
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
        nodes: ['stand', 'valid', 'aian', 'a-heads']
      }
    ];
    for (const d of docs) {
      const id = randomUUID();
      await tx.queryRun('INSERT INTO documents (id, workspace_id, project_id, title, length, node_ids_json) VALUES (?, ?, ?, ?, ?, ?)',
        [id, 'ws-default', 'prj-bank', d.title, d.content.length, jstr(d.nodes)]);
      const parts = chunkText(d.content);
      for (let i = 0; i < parts.length; i++) {
        await tx.queryRun('INSERT INTO chunks (id, document_id, workspace_id, idx, text, tokens_json, node_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [randomUUID(), id, 'ws-default', i, parts[i], jstr(tokenize(parts[i])), jstr(d.nodes)]);
      }
    }
  });

  return true;
}
