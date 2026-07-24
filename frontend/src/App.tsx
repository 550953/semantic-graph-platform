import { apiUrl } from './config'
import { useEffect, useState, useCallback, useMemo } from 'react'
import FlowCanvas from './components/FlowCanvas'
import ChatSidePanel from './components/ChatSidePanel'
import Glossary from './components/Glossary'
import PlatformPanel from './components/PlatformPanel'
import NodeInspector from './components/NodeInspector'
import StatsBar from './components/StatsBar'
import ActivityFeed from './components/ActivityFeed'
import PathFinder from './components/PathFinder'
import AdminPage from './components/AdminPage'
import LibraryPanel from './components/LibraryPanel'
import LoginPage from './components/LoginPage'
import ReviewsPage from './components/ReviewsPage'
import TopBar from './components/TopBar'
import BottomNav from './components/BottomNav'
import ProfilePage from './components/ProfilePage'

const TABS = [
  { id: 'asis', label: 'As is' },
  { id: 'process', label: 'Process' },
  { id: 'tobe', label: 'To be' }
]
const NOTES: Record<string, string> = {
  asis: 'As is — отчётность до платформы: знания в ТЗ и головах.',
  process: 'Process — переход к to be. Пилот 0409101.',
  tobe: 'To be — платформа знаний в центре. Роли = проекции графа.'
}

type Page = 'app' | 'admin' | 'login' | 'reviews' | 'profile'

function pageFromHash(): Page {
  const h = window.location.hash
  if (h === '#/admin') return 'admin'
  if (h === '#/login') return 'login'
  if (h === '#/reviews') return 'reviews'
  if (h === '#/profile') return 'profile'
  return 'app'
}

export default function App() {
  const [tab, setTab] = useState('tobe')
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [pinned, setPinned] = useState<string | null>(null)
  const [highlightIds, setHighlightIds] = useState<string[]>([])
  const [layer, setLayer] = useState('all')
  const [roleView, setRoleView] = useState<string | null>(null)
  const [actors, setActors] = useState<any[]>([])
  const [workItems, setWorkItems] = useState<any[]>([])
  const [engines, setEngines] = useState<any[]>([])
  const [layers, setLayers] = useState<any[]>([])
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [workspaceId, setWorkspaceId] = useState(localStorage.getItem('gp_ws') || 'ws-default')
  const [token, setToken] = useState(localStorage.getItem('gp_token') || '')
  const [user, setUser] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [present, setPresent] = useState(false)
  const [toast, setToast] = useState('')
  const [graphKey, setGraphKey] = useState(0)
  const [graphLoading, setGraphLoading] = useState(false)
  const [page, setPage] = useState<Page>(() => pageFromHash())
  const [graphs, setGraphs] = useState<any[]>([])
  const [activeGraphId, setActiveGraphId] = useState(localStorage.getItem('gp_graph') || '')

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId
    }
    if (activeGraphId) h['X-Graph-Id'] = activeGraphId
    if (token) h.Authorization = `Bearer ${token}`
    else h['X-API-Key'] = 'dev-api-key'
    return h
  }, [token, workspaceId, activeGraphId])

  function showToast(t: string) { setToast(t); setTimeout(() => setToast(''), 2800) }

  function go(p: Page) {
    if (p === 'admin' && user?.role !== 'admin') { showToast('Нужен вход как admin'); go('login'); return }
    if (p === 'profile' && !token) { go('login'); return }
    const map: Record<Page, string> = { app: '#/', admin: '#/admin', login: '#/login', reviews: '#/reviews', profile: '#/profile' }
    window.location.hash = map[p]; setPage(p)
  }

  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  async function loadMe() {
    if (!token) { setUser(null); return }
    try {
      const res = await fetch(apiUrl('/api/auth/me'), { headers: headers() })
      if (res.ok) { const d = await res.json(); setUser(d.user) } else setUser(null)
    } catch { setUser(null) }
  }

  async function loadGraphs() {
    try {
      const res = await fetch(apiUrl('/api/graphs'), { headers: headers() })
      if (res.ok) {
        const data = await res.json()
        setGraphs(Array.isArray(data) ? data : [])
      }
    } catch {}
  }

  useEffect(() => { loadMe() }, [token])
  useEffect(() => { if (workspaceId) loadGraphs() }, [workspaceId])
  useEffect(() => { localStorage.setItem('gp_graph', activeGraphId) }, [activeGraphId])

  async function loadGraph(t = tab) {
    setGraphLoading(true); setPinned(null); setHighlightIds([])
    try {
      const params = `tab=${t}${activeGraphId ? `&graph_id=${activeGraphId}` : ''}`
      const [n, e] = await Promise.all([
        fetch(apiUrl(`/api/graph/nodes?${params}`), { headers: headers() }).then(r => r.json()),
        fetch(apiUrl(`/api/graph/edges?${params}`), { headers: headers() }).then(r => r.json())
      ])
      setNodes(Array.isArray(n) ? n : []); setEdges(Array.isArray(e) ? e : [])
      setGraphKey(k => k + 1)
    } catch {} finally { setGraphLoading(false) }
  }

  useEffect(() => { loadGraph(tab) }, [activeGraphId])

  async function refreshMeta() {
    try {
      const [a, w, eng, lay, ws, pr] = await Promise.all([
        fetch(apiUrl('/api/actors'), { headers: headers() }).then(r => r.json()),
        fetch(apiUrl('/api/work-items'), { headers: headers() }).then(r => r.json()),
        fetch(apiUrl('/api/platform/engines')).then(r => r.json()),
        fetch(apiUrl('/api/platform/layers')).then(r => r.json()),
        fetch(apiUrl('/api/workspaces'), { headers: headers() }).then(r => r.json()),
        fetch(apiUrl('/api/projects'), { headers: headers() }).then(r => r.json())
      ])
      setActors(Array.isArray(a) ? a : []); setWorkItems(Array.isArray(w) ? w : [])
      setEngines(Array.isArray(eng) ? eng : []); setLayers(Array.isArray(lay) ? lay : [])
      setWorkspaces(Array.isArray(ws) ? ws : []); setProjects(Array.isArray(pr) ? pr : [])
    } catch {}
  }

  useEffect(() => { fetch(apiUrl('/api/health')).then(r => r.json()).then(setHealth).catch(() => setHealth({ ok: false })); refreshMeta(); loadGraph('tobe') }, [])
  useEffect(() => { localStorage.setItem('gp_ws', workspaceId); loadGraph(tab); refreshMeta(); loadGraphs() }, [workspaceId])
  useEffect(() => { loadGraph(tab) }, [tab])
  useEffect(() => { setPinned(null); setHighlightIds([]); setGraphKey(k => k + 1) }, [layer])

  async function transitionWI(id: string, event: string) {
    const res = await fetch(apiUrl(`/api/fsm/${id}/transition`), { method: 'POST', headers: headers(), body: JSON.stringify({ event }) })
    if (res.ok) { refreshMeta(); showToast(`FSM: ${event}`) }
  }

  function onPin(id: string | null) { setPinned(id); setHighlightIds(id ? [id] : []) }
  function onGlossary(ids: string[]) { setHighlightIds(ids); setPinned(ids[0] || null); showToast('Глоссарий → подсветка графа') }

  function exportGraph() {
    const payload = { tab, workspaceId, activeGraphId, exportedAt: new Date().toISOString(), nodes, edges }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `graph-${tab}-${Date.now()}.json`; a.click(); showToast('Граф экспортирован (JSON)')
  }

  function exportClientSnapshot() {
    const text = [
      '# Graph Platform — снимок для заказчика', `Дата: ${new Date().toLocaleString('ru-RU')}`,
      `Вкладка: ${tab}`, `Workspace: ${workspaceId}`, `Graph: ${activeGraphId || 'все'}`,
      `Узлов: ${nodes.length}, связей: ${edges.length}`, '',
      '## Узлы', ...nodes.map(n => `- [${n.layer}] ${n.label}: ${n.description || n.kind}`),
      '', '## Связи', ...edges.map(e => `- ${e.source} → ${e.target} (${e.label || ''})`)
    ].join('\n')
    const blob = new Blob([text], { type: 'text/markdown' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `snapshot-${tab}.md`; a.click(); showToast('Снимок для заказчика скачан')
  }

  function logout() { localStorage.removeItem('gp_token'); localStorage.removeItem('gp_graph'); setToken(''); setUser(null); setActiveGraphId(''); showToast('Вы вышли'); go('app') }

  const q = search.trim().toLowerCase()
  const visibleNodes = useMemo(() => {
    let list = layer === 'all' ? nodes : nodes.filter(n => n.layer === layer)
    if (q) list = list.filter(n => (n.label || '').toLowerCase().includes(q) || (n.description || '').toLowerCase().includes(q) || (n.id || '').toLowerCase().includes(q))
    return list
  }, [nodes, layer, q])
  const visibleEdges = useMemo(() => { const ids = new Set(visibleNodes.map(n => n.id)); return edges.filter(e => ids.has(e.source) && ids.has(e.target)) }, [edges, visibleNodes])
  useEffect(() => { if (!q) return; setHighlightIds(visibleNodes.map(n => n.id)) }, [search, layer, visibleNodes, q])
  const selectedNode = nodes.find(n => n.id === pinned) || null
  const roles = tab === 'tobe' ? [{ id: 'mgmt', label: 'Руководство' }, { id: 'econ', label: 'Экономист' }, { id: 'aian', label: 'Инженер ИИ' }, { id: 'dev', label: 'Разработчик' }] : []

  const renderPage = (content: React.ReactNode, currentPage: Page) => (
    <div className="app-shell has-bottom-nav">{content}<BottomNav page={currentPage} isAdmin={user?.role === 'admin'} isLoggedIn={!!token} onNavigate={go} /></div>
  )

  if (page === 'login') return renderPage(<LoginPage onBack={() => go('app')} onSuccess={(tk, u) => { setToken(tk); if (u) setUser(u); showToast(u?.role === 'admin' ? 'Админ вошёл' : 'Добро пожаловать'); go(u?.role === 'admin' ? 'admin' : 'app') }} />, 'login')
  if (page === 'reviews') return renderPage(<><TopBar user={user} token={token} health={health} onLogin={() => go('login')} onLogout={logout} onAdmin={() => go('admin')} onReviews={() => go('reviews')} onHome={() => go('app')} /><ReviewsPage headers={headers} onBack={() => go('app')} /></>, 'reviews')
  if (page === 'admin') {
    if (!token || user?.role !== 'admin') return renderPage(<LoginPage onBack={() => go('app')} onSuccess={(tk, u) => { setToken(tk); if (u) setUser(u); if (u?.role === 'admin') { showToast('Админ-доступ открыт'); window.location.hash = '#/admin'; setPage('admin') } else { showToast('Вы вошли, но это не admin'); go('app') } }} />, 'admin')
    return renderPage(<AdminPage token={token} onAuth={(tk, u) => { setToken(tk); if (!tk) { localStorage.removeItem('gp_token'); setUser(null); go('app') } else if (u) setUser(u) }} onBack={() => go('app')} headers={headers} graphs={graphs} activeGraphId={activeGraphId} onGraphsChange={loadGraphs} />, 'admin')
  }
  if (page === 'profile') return renderPage(<><TopBar user={user} token={token} health={health} onLogin={() => go('login')} onLogout={logout} onAdmin={() => go('admin')} onReviews={() => go('reviews')} onHome={() => go('app')} /><ProfilePage user={user} onLogout={logout} onBack={() => go('app')} /></>, 'profile')

  return (
    <div className={`app-shell has-bottom-nav ${present ? 'present' : ''}`}>
      {!present && <TopBar user={user} token={token} health={health} onLogin={() => go('login')} onLogout={logout} onAdmin={() => go('admin')} onReviews={() => go('reviews')} onHome={() => go('app')} />}
      <main className="app-main">
        {!present && (
          <header className="hero">
            <p className="eyebrow">Graph Platform · Transformation Graph · Copilot</p>
            <h1>Платформа знаний для регуляторной отчётности</h1>
            <p className="hint">Граф с зависимостями · слои · Copilot · шаблоны · Actor reuse. Чат с ИИ внизу страницы.</p>
            <div className="toolbar">
              <select className="field" value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}>
                {workspaces.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                {!workspaces.length && <option value="ws-default">Default</option>}
              </select>
              <select className="field" value={activeGraphId} onChange={e => setActiveGraphId(e.target.value)}>
                <option value="">Все графы</option>
                {graphs.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button type="button" className="chip" onClick={exportGraph}>Export JSON</button>
              <button type="button" className="chip" onClick={exportClientSnapshot}>Снимок MD</button>
              <button type="button" className="chip on" onClick={() => setPresent(true)}>Present mode</button>
            </div>
          </header>
        )}
        <div className="toolbar">
          {TABS.map(t => <button key={t.id} type="button" className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => { setTab(t.id); setRoleView(null); setLayer('all') }}>{t.label}</button>)}
          {present && <button type="button" className="chip" onClick={() => setPresent(false)}>Выйти из Present</button>}
        </div>
        {!present && <p className="hint" style={{ marginBottom: 8 }}>{NOTES[tab]}</p>}
        <StatsBar nodes={nodes} edges={edges} tab={tab} />
        {tab === 'tobe' && !present && (
          <div className="rolebar"><span className="rolebar-label">Смотреть как</span><button type="button" className={`chip ${!roleView ? 'on' : ''}`} onClick={() => setRoleView(null)}>Все</button>{roles.map(r => <button key={r.id} type="button" className={`chip ${roleView === r.id ? 'on' : ''}`} onClick={() => setRoleView(roleView === r.id ? null : r.id)}>{r.label}</button>)}</div>
        )}
        <div className="toolbar">
          <input className="field search" placeholder="Поиск по узлам…" value={search} onChange={e => setSearch(e.target.value)} />
          <button type="button" className={`chip ${layer === 'all' ? 'on' : ''}`} onClick={() => setLayer('all')}>Все слои</button>
          {layers.map((l: any) => <button key={l.id} type="button" className={`chip ${layer === l.id ? 'on' : ''}`} onClick={() => setLayer(l.id)}>{l.title}</button>)}
        </div>
        <div className={`flow-wrap ${present ? 'flow-present' : ''}`}>
          {graphLoading ? <div className="flow-empty">Обновление графа…</div> : !visibleNodes.length ? <div className="flow-empty">Нет узлов в этом слое на вкладке «{tab}». Нажми «Все слои».</div> : <FlowCanvas key={`graph-${tab}-${layer}-${graphKey}`} nodes={visibleNodes} edges={visibleEdges} pinned={pinned} highlightIds={highlightIds} roleView={layer === 'all' ? roleView : null} activeTab={tab} onPin={onPin} />}
        </div>
        {selectedNode && <NodeInspector node={selectedNode} edges={edges} nodes={nodes} onClose={() => onPin(null)} onFocusRelated={ids => { setHighlightIds(ids); setPinned(ids[0] || null) }} />}
        {!present && (
          <>
            <PathFinder nodes={nodes} edges={edges} onPath={ids => { setHighlightIds(ids); if (ids[0]) setPinned(ids[0]); showToast(ids.length ? 'Путь подсвечен' : 'Путь не найден') }} />
            <Glossary onSelect={onGlossary} activeIds={highlightIds} />
            <ActivityFeed headers={headers} />
            <LibraryPanel headers={headers} workspaceId={workspaceId} projects={projects} />
            <PlatformPanel actors={actors} workItems={workItems} engines={engines} layers={layers} onTransition={transitionWI} />
            <div className="panel chat-bottom-panel">
              <h3>💬 ИИ Ассистент</h3>
              <p className="sub-hint">Задайте вопрос про граф знаний, Interest Scope, Control Knowledge, Pipe, Actor, Owner или админку.</p>
              <ChatSidePanel selectedNodeIds={pinned ? [pinned] : highlightIds} tab={tab} headers={headers} />
            </div>
          </>
        )}
        <footer className="main-foot">Граф · Отзывы · Профиль · Админка · Copilot · Templates · Actor reuse</footer>
      </main>
      {toast && <div className="toast">{toast}</div>}
      <BottomNav page="app" isAdmin={user?.role === 'admin'} isLoggedIn={!!token} onNavigate={go} />
    </div>
  )
}