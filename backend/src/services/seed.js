import { hashPassword } from '../middleware/auth.js';
import { DEFAULT_PROFILE } from '../engines/ontology.js';
import { seedDefaultDocs } from '../engines/rag.js';

export function seedAll(db) {
  if (db.workspaces?.length) return false;

  db.workspaces = [
    { id: 'ws-default', name: 'Default Workspace', type: 'company', parentId: null }
  ];
  db.portfolios = [
    { id: 'pf-main', workspaceId: 'ws-default', name: 'Reporting Portfolio', projectIds: ['prj-bank'] }
  ];
  db.projects = [
    { id: 'prj-bank', portfolioId: 'pf-main', workspaceId: 'ws-default', name: 'Bank Regulatory Reporting', graphTabs: ['asis', 'process', 'tobe'] }
  ];

  db.users = [
    {
      id: 'user-admin',
      email: 'admin@graph.local',
      passwordHash: hashPassword('admin123'),
      name: 'Admin',
      role: 'admin',
      workspaceId: 'ws-default'
    }
  ];

  db.ontology = { ...DEFAULT_PROFILE };

  db.actors = [
    { id: 'act-val', type: 'Human', name: 'Валерий (практик)', roles: ['Заказчик', 'Эксперт'], workspaceId: 'ws-default' },
    { id: 'act-econ', type: 'Human', name: 'Экономист', roles: ['Owner'], workspaceId: 'ws-default' },
    { id: 'act-aian', type: 'Human', name: 'Инженер ИИ', roles: ['Owner'], workspaceId: 'ws-default' },
    { id: 'act-ai', type: 'AIAgent', name: 'Graph Copilot', roles: ['Ассистент'], workspaceId: 'ws-default' },
    { id: 'act-dev', type: 'Human', name: 'Разработчик', roles: ['Исполнитель'], workspaceId: 'ws-default' }
  ];

  // Full 3 tabs nodes
  const asis = [
    { id: 'a-auditor', tab: 'asis', label: 'Аудитор ЦБ', kind: 'Внешняя', layer: 'Resource', nodeKind: 'role', description: 'Проверяет обоснованность цифр вручную' },
    { id: 'a-tech', tab: 'asis', label: 'Технолог', kind: 'Банк', layer: 'Resource', nodeKind: 'role', description: 'Пишет ТЗ по нормативке' },
    { id: 'a-dev', tab: 'asis', label: 'Разработчик', kind: 'Банк', layer: 'Resource', nodeKind: 'role', description: 'Кодит расчёт на внутреннем SQL' },
    { id: 'a-ops', tab: 'asis', label: 'Сопровождение', kind: 'Банк', layer: 'Resource', nodeKind: 'role', description: 'Инциденты по опыту' },
    { id: 'a-econ', tab: 'asis', label: 'Экономист', kind: 'Банк', layer: 'Resource', nodeKind: 'role', description: 'Готовит и сдаёт форму' },
    { id: 'a-cb', tab: 'asis', label: 'ЦБ РФ', kind: 'Внешняя', layer: 'Knowledge', nodeKind: 'role', description: 'Нормативка и приём отчётности' },
    { id: 'a-abs', tab: 'asis', label: 'АБС', kind: 'Источник', layer: 'Implementation', nodeKind: 'domain', description: 'Счета, проводки' },
    { id: 'a-ods', tab: 'asis', label: 'ODS', kind: 'Слой данных', layer: 'Implementation', nodeKind: 'domain', description: 'ETL из АБС' },
    { id: 'a-frw', tab: 'asis', label: 'Расчётный фреймворк', kind: 'Расчёт', layer: 'Implementation', nodeKind: 'domain', description: 'Настроечные таблицы + SQL' },
    { id: 'a-f101', tab: 'asis', label: 'Форма 0409101', kind: 'Результат', layer: 'Knowledge', nodeKind: 'domain', description: 'КС, ФЛК, сдача в ЦБ' },
    { id: 'a-tz', tab: 'asis', label: 'ТЗ и регламенты', kind: 'Документы', layer: 'Implementation', nodeKind: 'note', description: 'Знания в документах' },
    { id: 'a-heads', tab: 'asis', label: 'Знания в головах', kind: 'Люди', layer: 'Resource', nodeKind: 'note', description: 'Носители опыта' }
  ];

  const process = [
    { id: 's1', tab: 'process', label: 'Срез 101 на синтетике', kind: 'Шаг', layer: 'Project', nodeKind: 'step', description: 'Стенд, КС, демо', badge: 'done' },
    { id: 's2', tab: 'process', label: 'Вторая форма', kind: 'Шаг', layer: 'Project', nodeKind: 'step', description: 'Максимально непохожая на 101', badge: 'next' },
    { id: 's3', tab: 'process', label: 'ODS Knowledge Model', kind: 'Шаг', layer: 'Project', nodeKind: 'step', description: 'Внутри контура с экспертами', badge: 'inside' },
    { id: 's4', tab: 'process', label: 'Конвертация SQL', kind: 'Шаг', layer: 'Project', nodeKind: 'step', description: 'Внутренний диалект', badge: 'inside' },
    { id: 's5', tab: 'process', label: 'Боевая сверка', kind: 'Шаг', layer: 'Project', nodeKind: 'step', description: 'Реальные данные', badge: 'inside' },
    { id: 's6', tab: 'process', label: 'Программа', kind: 'Шаг', layer: 'Project', nodeKind: 'step', description: 'Масштабирование', badge: 'inside' },
    { id: 'act-sint', tab: 'process', label: 'Синтетика', kind: 'Активность', layer: 'Project', nodeKind: 'act', description: 'Генераторы и эталоны' },
    { id: 'p-aian', tab: 'process', label: 'Инженер ИИ', kind: 'Центр перехода', layer: 'Resource', nodeKind: 'role', description: 'Ведёт все активности' },
    { id: 'p-experts', tab: 'process', label: 'Эксперты банка', kind: 'Банк', layer: 'Resource', nodeKind: 'role', description: 'Наполнение и приёмка' },
    { id: 'p-mgmt', tab: 'process', label: 'Руководство', kind: 'Банк', layer: 'Resource', nodeKind: 'role', description: 'Решение о программе' }
  ];

  const tobe = [
    { id: 'core', tab: 'tobe', label: 'Граф знаний', kind: 'Ядро', layer: 'Knowledge', nodeKind: 'core', description: 'Знание один раз; формы связывают объекты' },
    { id: 'reg', tab: 'tobe', label: 'Regulatory Knowledge', kind: 'Нормативка', layer: 'Knowledge', nodeKind: 'domain', description: '809-П, 6406-У, ФЛК' },
    { id: 'ods', tab: 'tobe', label: 'ODS Knowledge', kind: 'Модель данных', layer: 'Knowledge', nodeKind: 'domain', description: 'Lineage, владельцы' },
    { id: 'rep', tab: 'tobe', label: 'Reporting Knowledge', kind: 'Формы', layer: 'Knowledge', nodeKind: 'domain', description: '0409101 пилот' },
    { id: 'ctrl', tab: 'tobe', label: 'Control Knowledge', kind: 'Контроль', layer: 'Knowledge', nodeKind: 'domain', description: 'КС, DELTA, контрольные отчёты' },
    { id: 'dom', tab: 'tobe', label: 'Banking Domain', kind: 'Понятия', layer: 'Knowledge', nodeKind: 'domain', description: 'Счета, СПОД' },
    { id: 'proc', tab: 'tobe', label: 'Process Knowledge', kind: 'Регламенты', layer: 'Knowledge', nodeKind: 'domain', description: 'ETL, расчёт' },
    { id: 'ai', tab: 'tobe', label: 'AI Knowledge', kind: 'ИИ', layer: 'Knowledge', nodeKind: 'domain', description: 'Промты, eval' },
    { id: 'stand', tab: 'tobe', label: 'Synthetic Stand', kind: 'Сервис', layer: 'Implementation', nodeKind: 'service', description: 'Верификация на синтетике' },
    { id: 'valid', tab: 'tobe', label: 'Validation', kind: 'Сервис', layer: 'Implementation', nodeKind: 'service', description: 'Эталоны' },
    { id: 'migr', tab: 'tobe', label: 'Migration', kind: 'Сервис', layer: 'Implementation', nodeKind: 'service', description: 'Перенос в контур' },
    { id: 'econ', tab: 'tobe', label: 'Экономист', kind: 'Роль', layer: 'Resource', nodeKind: 'role', description: 'Сдаёт форму' },
    { id: 'aian', tab: 'tobe', label: 'Инженер ИИ', kind: 'Роль', layer: 'Resource', nodeKind: 'role', description: 'Модель знаний' },
    { id: 'cb', tab: 'tobe', label: 'ЦБ РФ', kind: 'Внешняя', layer: 'Knowledge', nodeKind: 'role', description: 'Регулятор' },
    { id: 'self-graph', tab: 'tobe', label: 'Graph Engine', kind: 'Platform', layer: 'Implementation', nodeKind: 'service', description: 'Self-host' },
    { id: 'self-copilot', tab: 'tobe', label: 'Graph Copilot', kind: 'Platform', layer: 'Implementation', nodeKind: 'service', description: 'Self-host chat' }
  ];

  db.nodes = [...asis, ...process, ...tobe].map(n => ({ ...n, workspaceId: 'ws-default', projectId: 'prj-bank' }));

  db.edges = [
    // asis
    { id: 'ae1', tab: 'asis', source: 'a-abs', target: 'a-ods', label: 'ETL' },
    { id: 'ae2', tab: 'asis', source: 'a-ods', target: 'a-frw', label: 'данные' },
    { id: 'ae3', tab: 'asis', source: 'a-frw', target: 'a-f101', label: 'расчёт' },
    { id: 'ae4', tab: 'asis', source: 'a-econ', target: 'a-f101', label: 'сдача' },
    { id: 'ae5', tab: 'asis', source: 'a-f101', target: 'a-cb', label: 'KLIKO' },
    { id: 'ae6', tab: 'asis', source: 'a-tech', target: 'a-tz', label: 'ТЗ' },
    { id: 'ae7', tab: 'asis', source: 'a-tz', target: 'a-dev', label: 'постановка' },
    { id: 'ae8', tab: 'asis', source: 'a-dev', target: 'a-frw', label: 'код' },
    { id: 'ae9', tab: 'asis', source: 'a-heads', target: 'a-tz', label: 'частично' },
    // process
    { id: 'pe1', tab: 'process', source: 's1', target: 's2', label: 'ядро' },
    { id: 'pe2', tab: 'process', source: 's2', target: 's3', label: 'контур' },
    { id: 'pe3', tab: 'process', source: 's3', target: 's4', label: 'SQL' },
    { id: 'pe4', tab: 'process', source: 's4', target: 's5', label: 'сверка' },
    { id: 'pe5', tab: 'process', source: 's5', target: 's6', label: 'программа' },
    { id: 'pe6', tab: 'process', source: 'p-aian', target: 'act-sint', label: 'ведёт' },
    { id: 'pe7', tab: 'process', source: 'act-sint', target: 's1', label: 'проверено' },
    { id: 'pe8', tab: 'process', source: 'p-experts', target: 's3', label: 'наполнение' },
    { id: 'pe9', tab: 'process', source: 'p-mgmt', target: 's6', label: 'решение' },
    // tobe
    { id: 'te1', tab: 'tobe', source: 'reg', target: 'core', label: 'объекты' },
    { id: 'te2', tab: 'tobe', source: 'ods', target: 'core', label: 'объекты' },
    { id: 'te3', tab: 'tobe', source: 'rep', target: 'core', label: 'проекции' },
    { id: 'te4', tab: 'tobe', source: 'ctrl', target: 'core', label: 'объекты' },
    { id: 'te5', tab: 'tobe', source: 'dom', target: 'core', label: 'объекты' },
    { id: 'te6', tab: 'tobe', source: 'proc', target: 'core', label: 'объекты' },
    { id: 'te7', tab: 'tobe', source: 'ai', target: 'core', label: 'обход' },
    { id: 'te8', tab: 'tobe', source: 'stand', target: 'core', label: 'проверка' },
    { id: 'te9', tab: 'tobe', source: 'valid', target: 'core', label: 'эталоны' },
    { id: 'te10', tab: 'tobe', source: 'migr', target: 'core', label: 'перенос' },
    { id: 'te11', tab: 'tobe', source: 'econ', target: 'ctrl', label: 'инструмент' },
    { id: 'te12', tab: 'tobe', source: 'econ', target: 'cb', label: 'сдача' },
    { id: 'te13', tab: 'tobe', source: 'aian', target: 'ai', label: 'модель' },
    { id: 'te14', tab: 'tobe', source: 'aian', target: 'core', label: 'наполнение' },
    { id: 'te15', tab: 'tobe', source: 'self-graph', target: 'core', label: 'self-host' },
    { id: 'te16', tab: 'tobe', source: 'self-copilot', target: 'ai', label: 'self-host' }
  ].map(e => ({ ...e, workspaceId: 'ws-default' }));

  db.workItems = [
    { id: 'wi-1', type: 'ChangeRequest', title: 'Выделить Control Knowledge', status: 'done', actorIds: ['act-val'], relatedNodeIds: ['ctrl', 'core'], layer: 'Knowledge', workspaceId: 'ws-default', projectId: 'prj-bank' },
    { id: 'wi-2', type: 'KnowledgeDefect', title: 'Разрыв Process ↔ ETL', status: 'open', actorIds: ['act-aian'], relatedNodeIds: ['proc'], layer: 'Knowledge', workspaceId: 'ws-default', projectId: 'prj-bank' },
    { id: 'wi-3', type: 'Task', title: 'Interest Scope auto', status: 'open', actorIds: ['act-ai'], relatedNodeIds: ['core'], layer: 'Implementation', workspaceId: 'ws-default', projectId: 'prj-bank' },
    { id: 'wi-4', type: 'Defect', title: 'Подсветка связей', status: 'closed', actorIds: ['act-dev'], relatedNodeIds: ['core'], layer: 'Implementation', workspaceId: 'ws-default', projectId: 'prj-bank' },
    { id: 'wi-5', type: 'Risk', title: 'Знания в головах', status: 'open', actorIds: ['act-val'], relatedNodeIds: ['a-heads'], layer: 'Resource', workspaceId: 'ws-default', projectId: 'prj-bank' }
  ];

  db.reviews = [
    { id: 'r1', n: 1, scope: { projectId: 'prj-bank', artifactId: 'stand', version: 'v1' }, authorId: 'act-val', status: 'accepted', text: 'Центр — платформа знаний', answer: 'Схема перестроена', date: '16.07', workspaceId: 'ws-default' },
    { id: 'r2', n: 2, scope: { projectId: 'prj-bank', artifactId: 'core', version: 'v5' }, authorId: 'act-val', status: 'accepted', text: 'Проекции по ролям', answer: 'Role switcher', date: '17.07', workspaceId: 'ws-default' }
  ];

  db.sprints = [
    { id: 'sp1', name: 'Sprint 1', start: '2026-07-10', end: '2026-07-17', workItemIds: ['wi-1', 'wi-2'], workspaceId: 'ws-default' }
  ];
  db.pipes = [
    { id: 'pipe-1', name: 'Control Knowledge flow', stages: ['analysis', 'design', 'dev', 'review'], workItemIds: ['wi-1'], workspaceId: 'ws-default' }
  ];

  db.documents = [];
  db.chunks = [];
  db.questions = [];
  db.fsmStates = {};

  seedDefaultDocs(db);
  return true;
}
