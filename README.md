# Graph Platform v2.4

Платформа знаний с независимыми графами, AI-ассистентом и multi-tenant изоляцией.

## Что нового в v2.4

- **Независимые графы знаний (Graph Instances)** — каждый граф со своей онтологией, узлами, связями, RAG и промптами
- **Knowledge Package** — импорт/экспорт графов через JSON для обмена с ChatGPT и другими ИИ
- **Graph переключатель** — селектор активного графа в интерфейсе
- **Tenant-изоляция** — проверка memberships на каждом запросе, заголовок `X-Graph-Id`
- **Безопасность** — bcrypt cost factor 12, CSP, HSTS, rate limit с блокировкой, защита от XSS/SQL-инъекций
- **FSM из онтологии** — машины состояний загружаются из БД, расширяются через API
- **Админ-панель** — управление графами, пользователями, workspace, импорт/экспорт Knowledge Package
- **Роли на связях** — Заказчик ≠ Owner, роль привязана к Actor↔Object
- **Шаблоны** — заморозка проекта в шаблон с независимым копированием
- **Адаптивный UI** — поддержка телефонов и планшетов

## Быстрый старт

# 1. Backend
cd backend
npm install
npm run dev

# 2. Frontend
cd frontend
npm install --legacy-peer-deps
npm run dev
UI: http://localhost:5173
API: http://localhost:3001
Логин: admin@graph.local / admin123

Пересоздать БД

bash
rm -f backend/data/graph.db
cd backend && npm run dev
DeepSeek / OpenAI

bash
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://api.deepseek.com
export OPENAI_MODEL=deepseek-chat
Без ключа используется локальный fallback.

Архитектура

text
Platform
  └── Workspace (пользователи, доступы)
        └── Graph "Bank" (онтология, узлы, RAG, промпты)
        └── Graph "Pharmacy" (другая онтология)
        └── Graph "Labor Safety" (третья модель)
Структура проекта

text
backend/src/
  index.js              # Express сервер
  db/
    database.js         # SQLite + schema + миграции
    seed.js             # Демо-данные
  routes/
    auth.js             # Аутентификация
    admin.js            # Админ-панель + импорт графов
    graph.js            # Граф, акторы, FSM (с graph_id)
    graphs.js           # Управление графами (CRUD)
    workspaces.js       # Workspace + шаблоны
    copilot.js          # AI-ассистент
    rag.js              # Поиск по документам
    ratings.js          # Оценки
  engines/
    fsm.js              # Машины состояний (из онтологии)
    ontology.js         # Default First → Extend
    llm.js              # LLM Gateway с fallback
  middleware/
    auth.js             # JWT + bcrypt(12)
    security.js         # Rate limit + CSP + валидация
  utils/
    helpers.js          # wsId, graphId, validateAccess

frontend/src/
  App.tsx               # Главный компонент с Graph selector
  components/
    FlowCanvas.tsx      # Граф на React Flow
    ChatSidePanel.tsx   # AI-ассистент
    AdminPage.tsx       # Админ-панель с управлением графами
    TopBar.tsx          # Верхняя панель
    BottomNav.tsx       # Нижняя навигация
API

Метод	Путь	Описание
GET	/api/health	Статус сервера
POST	/api/auth/register	Регистрация
POST	/api/auth/login	Вход
GET	/api/auth/me	Профиль
Graphs		
GET	/api/graphs	Список графов
POST	/api/graphs	Создать граф
DELETE	/api/graphs/:id	Удалить граф
Graph Data		
GET	/api/graph/nodes?tab=&layer=&graph_id=	Узлы графа
GET	/api/graph/edges?tab=&graph_id=	Связи
GET	/api/actors	Акторы
GET	/api/interest-scope/:actorId	Область интересов
GET	/api/work-items	Work Items
FSM		
GET	/api/fsm/machines	Машины состояний
GET	/api/fsm/:id/transitions	Допустимые переходы
POST	/api/fsm/:id/transition	Выполнить переход
Ontology		
GET	/api/ontology	Онтология
POST	/api/ontology/extend	Расширить онтологию
RAG		
GET	/api/rag/documents	Документы
POST	/api/rag/ingest	Загрузить документ
GET	/api/rag/search?q=	Поиск
Copilot		
POST	/api/copilot/chat	Чат с AI
GET	/api/copilot/history	История чата
Reviews & Ratings		
GET	/api/reviews	Ревью
POST	/api/reviews	Создать ревью
GET	/api/ratings	Оценки
POST	/api/ratings	Поставить оценку
Role Bindings		
GET	/api/role-bindings	Роли на связях
POST	/api/role-bindings	Привязать роль
DELETE	/api/role-bindings/:id	Отвязать роль
Workspace & Templates		
GET	/api/workspaces	Список workspace
POST	/api/workspaces	Создать workspace
GET	/api/workspaces/:id/templates	Шаблоны
POST	/api/workspaces/:id/templates	Создать шаблон
DELETE	/api/templates/:id	Удалить шаблон
POST	/api/projects	Создать проект
Admin		
GET	/api/admin/summary	Админ-сводка
GET	/api/admin/users	Пользователи
POST	/api/admin/import-graph	Импорт Knowledge Package
POST	/api/admin/nodes	Создать узел
POST	/api/admin/edges	Создать связь
DELETE	/api/admin/nodes/:id	Удалить узел
DELETE	/api/admin/edges/:id	Удалить связь
Knowledge Package (импорт/экспорт)

Экспорт графа:

bash
GET /api/graph/nodes?graph_id=xxx
GET /api/graph/edges?graph_id=xxx
→ сохраняется как knowledge-package.json

Импорт графа:

bash
POST /api/admin/import-graph
{
  "workspaceId": "ws-default",
  "tab": "tobe",
  "graphId": "graph-xxx",
  "nodes": [...],
  "edges": [...]
}
Типовой сценарий:

ChatGPT генерирует JSON с узлами и связями
Пользователь нажимает Upload в админке
Граф создаётся автоматически
Пользователь нажимает Download → редактирует в ChatGPT → Upload снова
Безопасность

JWT с проверкой memberships
bcrypt cost factor 12
Content Security Policy (CSP)
Rate limiting с блокировкой IP
Валидация всех входных данных
Tenant-изоляция через middleware
Graph-изоляция через X-Graph-Id
Требования

Node.js 20 LTS
SQLite (встроен)
Без пробелов в пути (macOS)

## Автообновления с github
Также взгляните на файл upload.py
Он само `обновляет` в целом весь проект каждые `60 секунд`
Точнее `проверяет` на `обновления`!

## Postre SQL и ORM для работы от нашей студии
Также когда проект выдет из демо и станет полноценный будет внедрения с SQL запросов сырых на ORM от нашей студии `HoneyORM` его главный файл есть в корнне проекта можно ознакомиться и будет полноценный `PostreSQL`, а не sqlite3 ведь sqlite только для демо, чтобы заказчик видел что все работает! Если что сам файл задокументировн на `время`

## Для быстрого стратра на Ubuntu сервер
```bash
chmod +x Dowload_dependencies.sh
./Dowload_dependencies.sh
```

## После страта
Когда все будет запушенно рекомендую запустить тестирования на пайтон
в папе test
Для запуска вам нужно ввести
- `cd test`
- `pip install -r requirements.txt`
- `python3 main.py`
