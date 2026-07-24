# Деплой Graph Platform (HTTP)

Сервер работает по **HTTP** (не требуется HTTPS).

## 1. Конфиг frontend за 2 секунды

Файл: `frontend/public/config.js` (после `npm run build` — в `dist/config.js`):

```js
window.__GP_CONFIG__ = {
  API_URL: "http://ВАШ_IP:3001",   // или "" если nginx проксирует /api
  OFFLINE_AI_URL: "http://ВАШ_IP:5005",
  APP_TITLE: "Graph Platform"
};
```

Меняете IP/порт → сохраняете → обновляете страницу. **Пересборка не нужна** (для уже собранного `dist/`).

## 2. Backend

```bash
cd backend
cp .env.example .env   # при необходимости
npm install
# снести БД при первой установке новой версии:
# rm -f data/graph.db data/graph.db-*
npm start
# слушает 0.0.0.0:3001
```

```bash
export OFFLINE_AI_URL=http://127.0.0.1:5005
export OFFLINE_AI_KEY=offline-dev-key
export OPENAI_API_KEY=sk-...   # опционально DeepSeek
export OPENAI_BASE_URL=https://api.deepseek.com
```

## 3. Offline AI

```bash
cd offline-ai
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export OFFLINE_AI_HOST=0.0.0.0
export OFFLINE_AI_PORT=5005
python server.py
```

## 4. Frontend prod

```bash
cd frontend
npm install --legacy-peer-deps
npm run build
# раздать dist/ через nginx или:
npx vite preview --host 0.0.0.0 --port 5173
```

Отредактируйте `dist/config.js` под IP сервера.

## 5. Nginx (пример, HTTP)

```nginx
server {
  listen 80;
  server_name _;
  root /var/www/graph-platform/dist;
  location / {
    try_files $uri /index.html;
  }
  location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

При таком nginx в `config.js` оставьте `API_URL: ""`.

## 6. Логин

`admin@graph.local` / `admin123`  
Админка: `http://IP/#/admin`

## 7. Проверки

```bash
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1:5005/health
```
