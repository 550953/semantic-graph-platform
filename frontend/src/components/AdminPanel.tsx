import { useEffect, useState } from 'react'
import { apiUrl } from '../config'
import AuthPanel from './AuthPanel'

export default function AdminPage({
  token, onAuth, onBack, headers, graphs, activeGraphId, onGraphsChange
}: {
  token: string; onAuth: (t: string, u?: any) => void; onBack: () => void
  headers: () => Record<string, string>; graphs: any[]; activeGraphId: string; onGraphsChange: () => void
}) {
  const [user, setUser] = useState<any>(null)
  const [data, setData] = useState<any>(null)
  const [bindings, setBindings] = useState<any[]>([])
  const [ontology, setOntology] = useState<any>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [templates, setTemplates] = useState<any[]>([])
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [newGraphName, setNewGraphName] = useState('')
  const [importJson, setImportJson] = useState('')
  const [importTab, setImportTab] = useState('tobe')
  const [importWs, setImportWs] = useState('ws-default')
  const [importGraphId, setImportGraphId] = useState('')

  function hdrs(): Record<string, string> { const h = headers(); if (token) h.Authorization = `Bearer ${token}`; return h }

  async function loadMe() {
    if (!token) { setUser(null); return }
    try { const r = await fetch(apiUrl('/api/auth/me'), { headers: hdrs() }); if (r.ok) setUser((await r.json()).user); else setUser(null) } catch { setUser(null) }
  }

  async function loadAdmin() {
    setErr(''); setLoading(true)
    try {
      const r = await fetch(apiUrl('/api/admin/summary'), { headers: hdrs() })
      if (!r.ok) { setErr(r.status === 403 ? 'Доступ только для role=admin' : 'Ошибка загрузки'); setData(null); setLoading(false); return }
      setData(await r.json())
    } catch { setErr('Backend offline'); setLoading(false); return }
    try { const rb = await fetch(apiUrl('/api/role-bindings'), { headers: hdrs() }).then(r => r.json()); setBindings(Array.isArray(rb) ? rb : []) } catch {}
    try { const ont = await fetch(apiUrl('/api/ontology'), { headers: hdrs() }).then(r => r.json()); setOntology(ont) } catch {}
    try { const temps = await fetch(apiUrl('/api/workspaces/ws-default/templates'), { headers: hdrs() }).then(r => r.json()); setTemplates(Array.isArray(temps) ? temps : []) } catch {}
    try { const ws = await fetch(apiUrl('/api/workspaces'), { headers: hdrs() }).then(r => r.json()); setWorkspaces(Array.isArray(ws) ? ws : []) } catch {}
    try { const qs = await fetch(apiUrl('/api/copilot/history'), { headers: hdrs() }).then(r => r.json()); setQuestions(Array.isArray(qs) ? qs : []) } catch {}
    setLoading(false)
  }

  async function createGraph() {
    if (!newGraphName) return
    try {
      const r = await fetch(apiUrl('/api/graphs'), { method: 'POST', headers: hdrs(), body: JSON.stringify({ name: newGraphName }) })
      if (r.ok) { setNewGraphName(''); onGraphsChange(); setMsg('Граф создан') }
    } catch { setMsg('Ошибка') }
  }

  async function deleteGraph(id: string) {
    try { await fetch(apiUrl(`/api/graphs/${id}`), { method: 'DELETE', headers: hdrs() }); onGraphsChange(); setMsg('Граф удалён') } catch {}
  }

  async function importGraph(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    try {
      const graph = JSON.parse(importJson)
      const r = await fetch(apiUrl('/api/admin/import-graph'), { method: 'POST', headers: hdrs(), body: JSON.stringify({ workspaceId: importWs, tab: importTab, graphId: importGraphId || null, nodes: graph.nodes || [], edges: graph.edges || [] }) })
      if (r.ok) { const d = await r.json(); setMsg(`Импортировано: ${d.nodesCreated} узлов, ${d.edgesCreated} связей`); setImportJson(''); loadAdmin(); onGraphsChange() }
      else setMsg((await r.json()).error || 'Ошибка импорта')
    } catch { setMsg('Невалидный JSON') }
  }

  async function exportGraph(gid: string) {
    try {
      const nodes = await fetch(apiUrl(`/api/graph/nodes?graph_id=${gid}`), { headers: hdrs() }).then(r => r.json())
      const edges = await fetch(apiUrl(`/api/graph/edges?graph_id=${gid}`), { headers: hdrs() }).then(r => r.json())
      const pkg = { graphId: gid, exportedAt: new Date().toISOString(), nodes, edges }
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `knowledge-package-${gid}.json`; a.click()
      setMsg('Пакет знаний экспортирован')
    } catch { setMsg('Ошибка экспорта') }
  }

  async function deleteUser(uid: string) { try { await fetch(apiUrl(`/api/admin/users/${uid}`), { method: 'DELETE', headers: hdrs() }); loadAdmin(); setDeleteConfirm(null) } catch {} }
  async function deleteWorkspace(wsId: string) { try { await fetch(apiUrl(`/api/workspaces/${wsId}`), { method: 'DELETE', headers: hdrs() }); loadAdmin(); setDeleteConfirm(null) } catch {} }

  useEffect(() => { loadMe() }, [token])
  useEffect(() => { if (user?.role === 'admin') loadAdmin() }, [user])

  const isAdmin = user?.role === 'admin'
  const tabs = ['overview', 'graphs', 'import', 'users', 'workspaces', 'ratings', 'bindings', 'templates', 'ai', 'ontology']
  const tl: Record<string, string> = { overview: '📊 Обзор', graphs: '🧬 Графы', import: '📥 Импорт', users: '👥 Польз.', workspaces: '🏢 WS', ratings: '⭐ Оценки', bindings: '🔗 Роли', templates: '📋 Шаблоны', ai: '🤖 ИИ', ontology: '🧬 Онтология' }

  if (!token) return <div className="admin-page"><div className="panel"><h3>Админ-панель</h3><p className="sub-hint">Войдите как admin@graph.local</p></div></div>

  return (
    <div className="admin-page">
      <header className="admin-hero">
        <div><p className="eyebrow">Graph Platform · Control Center</p><h1>Админ-панель</h1><p className="hint">{isAdmin ? `role: admin · ${user.email}` : 'Нужен admin'}</p></div>
        <div className="toolbar">
          <button type="button" className="chip" onClick={onBack}>← К платформе</button>
          {isAdmin && <><button type="button" className="chip on" onClick={loadAdmin} disabled={loading}>{loading ? '...' : 'Обновить'}</button></>}
        </div>
      </header>
      <div className="admin-grid">
        <AuthPanel token={token} onAuth={(tk, u) => { onAuth(tk, u); if (u) setUser(u); if (!tk) setUser(null) }} />
        {msg && <div className="panel"><p style={{ color: msg.includes('создан') || msg.includes('Импортировано') || msg.includes('экспортирован') ? 'var(--ok)' : 'var(--danger)' }}>{msg}</p></div>}
        {err && <div className="panel"><p style={{ color: 'var(--danger)' }}>{err}</p></div>}
        {isAdmin && (
          <>
            <div className="toolbar">{tabs.map(t => <button key={t} type="button" className={`tab ${activeTab === t ? 'on' : ''}`} onClick={() => setActiveTab(t)}>{tl[t]}</button>)}</div>

            {activeTab === 'graphs' && (
              <div className="panel">
                <h3>Графы знаний</h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input className="field" placeholder="Название графа" value={newGraphName} onChange={e => setNewGraphName(e.target.value)} />
                  <button type="button" className="chip on" onClick={createGraph}>Создать</button>
                </div>
                <div className="activity-list">
                  {graphs.map((g: any) => (
                    <div key={g.id} className="activity-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><div className="activity-q">{g.name}</div><div className="activity-meta">{g.slug} · {g.description || '—'}</div></div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="chip" onClick={() => exportGraph(g.id)}>Export</button>
                        <button type="button" className="chip" onClick={() => deleteGraph(g.id)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>Удалить</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'import' && (
              <div className="panel">
                <h3>Импорт Knowledge Package</h3>
                <p className="sub-hint">Вставьте JSON сгенерированный ChatGPT или другим ИИ</p>
                <form onSubmit={importGraph} style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <select className="field" value={importWs} onChange={e => setImportWs(e.target.value)}>{(data?.workspaces || []).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                    <select className="field" value={importTab} onChange={e => setImportTab(e.target.value)}><option value="asis">As is</option><option value="process">Process</option><option value="tobe">To be</option></select>
                    <select className="field" value={importGraphId} onChange={e => setImportGraphId(e.target.value)}><option value="">Новый граф</option>{graphs.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                  </div>
                  <textarea className="field" placeholder='{"nodes":[...],"edges":[...]}' value={importJson} onChange={e => setImportJson(e.target.value)} rows={6} />
                  <button type="submit" className="auth-submit">Импортировать Knowledge Package</button>
                </form>
              </div>
            )}

            {activeTab === 'overview' && data && <div className="admin-stats-grid"><div className="admin-stat-card"><div className="stat-value">{data.stats?.users||0}</div><div className="stat-label">Пользователей</div></div><div className="admin-stat-card"><div className="stat-value">{data.stats?.workspaces||0}</div><div className="stat-label">Workspaces</div></div><div className="admin-stat-card"><div className="stat-value">{data.stats?.nodes||0}</div><div className="stat-label">Узлов</div></div><div className="admin-stat-card"><div className="stat-value">{graphs.length}</div><div className="stat-label">Графов</div></div></div>}
            {activeTab === 'users' && <div className="panel"><h3>Пользователи ({(data?.users||[]).length})</h3><div className="activity-list">{(data?.users||[]).map((u:any)=><div key={u.id} className="activity-item" style={{display:'flex',justifyContent:'space-between'}}><div><div className="activity-q">{u.email} · {u.name}</div><div className="activity-meta"><span className={`badge ${u.role==='admin'?'on':''}`}>{u.role}</span> · {u.workspace_id}</div></div>{u.role!=='admin'&&<button className="chip" onClick={()=>setDeleteConfirm(u.id)} style={{color:'var(--danger)',borderColor:'var(--danger)'}}>Удалить</button>}</div>)}</div></div>}
            {activeTab === 'ontology' && ontology && <div className="panel"><h3>Онтология</h3><pre className="code-block">{JSON.stringify(ontology,null,2)}</pre></div>}
          </>
        )}
        {deleteConfirm && <div className="panel" style={{borderColor:'var(--danger)'}}><h3 style={{color:'var(--danger)'}}>Подтверждение</h3><div className="toolbar"><button className="chip" onClick={()=>{deleteUser(deleteConfirm);setDeleteConfirm(null)}} style={{background:'var(--danger)',color:'#fff'}}>Удалить</button><button className="chip" onClick={()=>setDeleteConfirm(null)}>Отмена</button></div></div>}
      </div>
    </div>
  )
}