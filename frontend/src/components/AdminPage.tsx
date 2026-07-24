import { useEffect, useState } from 'react'
import { apiUrl } from '../config'
import AuthPanel from './AuthPanel'

export default function AdminPage({
  token,
  onAuth,
  onBack
}: {
  token: string
  onAuth: (token: string, user?: any) => void
  onBack: () => void
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

  // Формы
  const [nodeForm, setNodeForm] = useState({
    workspaceId: 'ws-default', tab: 'tobe', label: '', kind: '',
    layer: 'Knowledge', nodeKind: 'domain', description: '', badge: ''
  })
  const [edgeForm, setEdgeForm] = useState({
    workspaceId: 'ws-default', tab: 'tobe', source: '', target: '', label: ''
  })
  const [importJson, setImportJson] = useState('')
  const [importTab, setImportTab] = useState('tobe')
  const [importWs, setImportWs] = useState('ws-default')

  function headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) h.Authorization = `Bearer ${token}`
    else h['X-API-Key'] = 'dev-api-key'
    return h
  }

  async function loadMe() {
    if (!token) { setUser(null); return }
    try {
      const res = await fetch(apiUrl('/api/auth/me'), { headers: headers() })
      if (res.ok) { const d = await res.json(); setUser(d.user) }
      else setUser(null)
    } catch { setUser(null) }
  }

  async function loadAdmin() {
    setErr('')
    setMsg('')
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/admin/summary'), { headers: headers() })
      if (!res.ok) {
        setErr(res.status === 403 ? 'Доступ только для role=admin' : 'Ошибка загрузки')
        setData(null)
        setLoading(false)
        return
      }
      setData(await res.json())
    } catch {
      setErr('Backend offline')
      setLoading(false)
      return
    }

    try { const rb = await fetch(apiUrl('/api/role-bindings'), { headers: headers() }).then(r => r.json()); setBindings(Array.isArray(rb) ? rb : []) } catch { setBindings([]) }
    try { const ont = await fetch(apiUrl('/api/ontology'), { headers: headers() }).then(r => r.json()); setOntology(ont) } catch { setOntology(null) }
    try { const temps = await fetch(apiUrl('/api/workspaces/ws-default/templates'), { headers: headers() }).then(r => r.json()); setTemplates(Array.isArray(temps) ? temps : []) } catch { setTemplates([]) }
    try { const ws = await fetch(apiUrl('/api/workspaces'), { headers: headers() }).then(r => r.json()); setWorkspaces(Array.isArray(ws) ? ws : []) } catch { setWorkspaces([]) }
    try { const qs = await fetch(apiUrl('/api/copilot/history'), { headers: headers() }).then(r => r.json()); setQuestions(Array.isArray(qs) ? qs : []) } catch { setQuestions([]) }

    setLoading(false)
  }

  async function importGraph(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    try {
      const graph = JSON.parse(importJson)
      const res = await fetch(apiUrl('/api/admin/import-graph'), {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ workspaceId: importWs, tab: importTab, nodes: graph.nodes || [], edges: graph.edges || [] })
      })
      if (res.ok) {
        const d = await res.json()
        setMsg(`Импортировано: ${d.nodesCreated} узлов, ${d.edgesCreated} связей`)
        setImportJson('')
        loadAdmin()
      } else { const err = await res.json(); setMsg(err.error || 'Ошибка импорта') }
    } catch { setMsg('Невалидный JSON') }
  }

  async function addNode(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    try {
      const res = await fetch(apiUrl('/api/admin/nodes'), { method: 'POST', headers: headers(), body: JSON.stringify(nodeForm) })
      if (res.ok) { setMsg('Узел создан'); setNodeForm({ ...nodeForm, label: '', kind: '', description: '', badge: '' }); loadAdmin() }
      else { const err = await res.json(); setMsg(err.error || 'Ошибка') }
    } catch { setMsg('Backend offline') }
  }

  async function addEdge(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    try {
      const res = await fetch(apiUrl('/api/admin/edges'), { method: 'POST', headers: headers(), body: JSON.stringify(edgeForm) })
      if (res.ok) { setMsg('Связь создана'); setEdgeForm({ ...edgeForm, source: '', target: '', label: '' }); loadAdmin() }
      else { const err = await res.json(); setMsg(err.error || 'Ошибка') }
    } catch { setMsg('Backend offline') }
  }

  async function deleteUser(userId: string) {
    try { await fetch(apiUrl(`/api/admin/users/${userId}`), { method: 'DELETE', headers: headers() }); loadAdmin(); setDeleteConfirm(null) }
    catch { setErr('Ошибка удаления') }
  }

  async function deleteWorkspace(wsId: string) {
    try { await fetch(apiUrl(`/api/workspaces/${wsId}`), { method: 'DELETE', headers: headers() }); loadAdmin(); setDeleteConfirm(null) }
    catch { setErr('Ошибка удаления') }
  }

  function exportData(format: 'json' | 'csv') {
    const payload = { users: data?.users || [], workspaces, ratings: data?.ratings || [], bindings, templates, ontology, exportedAt: new Date().toISOString() }
    let blob
    if (format === 'json') blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    else blob = new Blob([`email,name,role,workspace_id\n${(data?.users || []).map((u: any) => `${u.email},${u.name},${u.role},${u.workspace_id}`).join('\n')}`], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `admin-export-${Date.now()}.${format}`; a.click()
  }

  useEffect(() => { loadMe() }, [token])
  useEffect(() => { if (user?.role === 'admin') loadAdmin() }, [user])

  const isAdmin = user?.role === 'admin'
  const tabs = ['overview', 'import', 'nodes', 'users', 'workspaces', 'ratings', 'bindings', 'templates', 'ai', 'ontology']
  const tabLabels: Record<string, string> = { overview: '📊 Обзор', import: '📥 Импорт', nodes: '🔧 Узлы и связи', users: '👥 Пользователи', workspaces: '🏢 Workspaces', ratings: '⭐ Оценки', bindings: '🔗 Роли', templates: '📋 Шаблоны', ai: '🤖 ИИ', ontology: '🧬 Онтология' }

  return (
    <div className="admin-page">
      <header className="admin-hero">
        <div>
          <p className="eyebrow">Graph Platform · Control Center</p>
          <h1>Админ-панель</h1>
          <p className="hint">{isAdmin ? `role: admin · ${user.email}` : 'Доступ только после входа с role=admin'}</p>
        </div>
        <div className="toolbar">
          <button type="button" className="chip" onClick={onBack}>← К платформе</button>
          {isAdmin && (
            <>
              <button type="button" className="chip on" onClick={loadAdmin} disabled={loading}>{loading ? 'Загрузка...' : 'Обновить'}</button>
              <button type="button" className="chip" onClick={() => exportData('json')}>Export JSON</button>
              <button type="button" className="chip" onClick={() => exportData('csv')}>Export CSV</button>
            </>
          )}
        </div>
      </header>

      <div className="admin-grid">
        <AuthPanel token={token} onAuth={(tk, u) => { onAuth(tk, u); if (u) setUser(u); if (!tk) setUser(null) }} />

        {!token && <div className="panel"><h3>Требуется вход</h3><p className="sub-hint">Зарегистрируйтесь или войдите. Админка откроется только для admin@graph.local.</p></div>}
        {token && user && !isAdmin && <div className="panel"><h3>Недостаточно прав</h3><p className="sub-hint">Вы вошли как <strong>{user.email}</strong> (role: {user.role}). Нужен role=admin.</p></div>}

        {isAdmin && (
          <>
            <div className="toolbar" style={{ marginTop: 0 }}>
              {tabs.map(t => <button key={t} type="button" className={`tab ${activeTab === t ? 'on' : ''}`} onClick={() => setActiveTab(t)}>{tabLabels[t]}</button>)}
            </div>

            {msg && <div className="panel"><p style={{ color: msg.includes('создан') || msg.includes('Импортировано') ? 'var(--ok)' : 'var(--danger)' }}>{msg}</p></div>}

            {activeTab === 'overview' && data && (
              <>
                <div className="admin-stats-grid">
                  <div className="admin-stat-card"><div className="stat-value">{data.stats?.users || 0}</div><div className="stat-label">Пользователей</div></div>
                  <div className="admin-stat-card"><div className="stat-value">{data.stats?.workspaces || 0}</div><div className="stat-label">Workspaces</div></div>
                  <div className="admin-stat-card"><div className="stat-value">{data.stats?.nodes || 0}</div><div className="stat-label">Узлов</div></div>
                  <div className="admin-stat-card"><div className="stat-value">{data.stats?.questions || 0}</div><div className="stat-label">Вопросов ИИ</div></div>
                  <div className="admin-stat-card"><div className="stat-value">{data.stats?.ratingAvg ? Number(data.stats.ratingAvg).toFixed(1) : '—'}</div><div className="stat-label">Средняя оценка</div></div>
                </div>
                <div className="grid-2">
                  <div className="panel"><h3>Последние пользователи</h3><div className="activity-list" style={{ maxHeight: 200, overflow: 'auto' }}>{(data.users || []).slice(0, 5).map((u: any) => <div key={u.id} className="activity-item"><div className="activity-q">{u.email}</div><div className="activity-meta">{u.role} · {u.workspace_id}</div></div>)}</div></div>
                  <div className="panel"><h3>Последние оценки</h3><div className="activity-list" style={{ maxHeight: 200, overflow: 'auto' }}>{(data.ratings || []).slice(0, 5).map((r: any) => <div key={r.id} className="activity-item"><div className="activity-q">{'★'.repeat(r.score)} · {r.user_name}</div><div className="activity-meta">{r.comment?.slice(0, 50) || '—'}</div></div>)}</div></div>
                </div>
              </>
            )}

            {activeTab === 'import' && data && (
              <div className="panel">
                <h3>Импорт графа из JSON</h3>
                <p className="sub-hint">Вставьте JSON с nodes и edges для массового создания графа. Внешний ИИ может сгенерировать схему.</p>
                <form onSubmit={importGraph} style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select className="field" value={importWs} onChange={e => setImportWs(e.target.value)}>{(data.workspaces || []).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                    <select className="field" value={importTab} onChange={e => setImportTab(e.target.value)}><option value="asis">As is</option><option value="process">Process</option><option value="tobe">To be</option></select>
                  </div>
                  <textarea className="field" placeholder='{"nodes":[{"id":"n1","label":"Узел","layer":"Knowledge","nodeKind":"domain"}],"edges":[{"source":"n1","target":"n2"}]}' value={importJson} onChange={e => setImportJson(e.target.value)} rows={6} />
                  <button type="submit" className="auth-submit">Импортировать граф</button>
                </form>
              </div>
            )}

            {activeTab === 'nodes' && data && (
              <>
                <div className="panel">
                  <h3>Добавить узел</h3>
                  <form onSubmit={addNode} className="admin-form">
                    <select className="field" value={nodeForm.workspaceId} onChange={e => setNodeForm({...nodeForm, workspaceId: e.target.value})}>{(data.workspaces || []).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                    <select className="field" value={nodeForm.tab} onChange={e => setNodeForm({...nodeForm, tab: e.target.value})}><option value="asis">As is</option><option value="process">Process</option><option value="tobe">To be</option></select>
                    <input className="field" placeholder="Label" value={nodeForm.label} onChange={e => setNodeForm({...nodeForm, label: e.target.value})} required />
                    <input className="field" placeholder="Kind" value={nodeForm.kind} onChange={e => setNodeForm({...nodeForm, kind: e.target.value})} />
                    <select className="field" value={nodeForm.layer} onChange={e => setNodeForm({...nodeForm, layer: e.target.value})}><option value="Knowledge">Knowledge</option><option value="Implementation">Implementation</option><option value="Project">Project</option><option value="Resource">Resource</option></select>
                    <select className="field" value={nodeForm.nodeKind} onChange={e => setNodeForm({...nodeForm, nodeKind: e.target.value})}><option value="domain">Domain</option><option value="core">Core</option><option value="service">Service</option><option value="role">Role</option><option value="note">Note</option><option value="step">Step</option><option value="act">Activity</option></select>
                    <input className="field field-full" placeholder="Description" value={nodeForm.description} onChange={e => setNodeForm({...nodeForm, description: e.target.value})} />
                    <button type="submit" className="auth-submit">Создать узел</button>
                  </form>
                </div>
                <div className="panel">
                  <h3>Добавить связь</h3>
                  <form onSubmit={addEdge} className="admin-form">
                    <select className="field" value={edgeForm.workspaceId} onChange={e => setEdgeForm({...edgeForm, workspaceId: e.target.value})}>{(data.workspaces || []).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                    <select className="field" value={edgeForm.tab} onChange={e => setEdgeForm({...edgeForm, tab: e.target.value})}><option value="asis">As is</option><option value="process">Process</option><option value="tobe">To be</option></select>
                    <input className="field" placeholder="Source node ID" value={edgeForm.source} onChange={e => setEdgeForm({...edgeForm, source: e.target.value})} required />
                    <input className="field" placeholder="Target node ID" value={edgeForm.target} onChange={e => setEdgeForm({...edgeForm, target: e.target.value})} required />
                    <input className="field field-full" placeholder="Label" value={edgeForm.label} onChange={e => setEdgeForm({...edgeForm, label: e.target.value})} />
                    <button type="submit" className="auth-submit">Создать связь</button>
                  </form>
                </div>
              </>
            )}

            {activeTab === 'users' && <div className="panel"><h3>Пользователи ({data?.users?.length || 0})</h3><div className="activity-list" style={{ maxHeight: 500, overflow: 'auto' }}>{(data?.users || []).map((u: any) => <div key={u.id} className="activity-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div className="activity-q">{u.email} · {u.name}</div><div className="activity-meta"><span className={`badge ${u.role === 'admin' ? 'on' : ''}`}>{u.role}</span><span style={{ marginLeft: 8 }}>{u.workspace_id}</span><span style={{ marginLeft: 8 }}>{u.created_at}</span></div></div>{u.role !== 'admin' && <button type="button" className="chip" onClick={() => setDeleteConfirm(u.id)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>Удалить</button>}</div>)}</div></div>}

            {activeTab === 'workspaces' && <div className="panel"><h3>Workspaces ({workspaces.length})</h3><div className="activity-list">{workspaces.map((ws: any) => <div key={ws.id} className="activity-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div className="activity-q">{ws.name}</div><div className="activity-meta">{ws.id} · {ws.type} · {ws.membership_role}</div></div><button type="button" className="chip" onClick={() => setDeleteConfirm(ws.id)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>Удалить</button></div>)}</div></div>}

            {activeTab === 'ratings' && data && <div className="panel"><h3>Оценки платформы ({data?.ratings?.length || 0})</h3><div className="stats-bar"><div className="stat"><b>{data?.stats?.ratingAvg ? Number(data.stats.ratingAvg).toFixed(2) : '—'}</b><span>средняя</span></div><div className="stat"><b>{data?.stats?.ratingCount || 0}</b><span>всего</span></div></div><div className="activity-list" style={{ maxHeight: 400, overflow: 'auto' }}>{(data?.ratings || []).map((r: any) => <div key={r.id} className="activity-item"><div className="activity-q">{'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)} · {r.user_name}</div><div className="activity-meta">{r.comment || '—'}</div><div className="activity-meta" style={{ fontSize: 10 }}>{r.created_at} · {r.page}</div></div>)}</div></div>}

            {activeTab === 'bindings' && <div className="panel"><h3>Роли на связях ({bindings.length})</h3><p className="sub-hint">Заказчик ≠ Owner — роль на связи Actor↔Object</p><div className="activity-list">{bindings.map((b: any) => <div key={b.id} className="activity-item"><div className="activity-q"><span className="badge on">{b.role}</span></div><div className="activity-meta">{b.actor_id} → {b.object_id} · ws: {b.workspace_id}</div></div>)}{bindings.length === 0 && <p className="muted">Нет активных связей</p>}</div></div>}

            {activeTab === 'templates' && <div className="panel"><h3>Шаблоны ({templates.length})</h3><div className="activity-list">{templates.map((t: any) => <div key={t.id} className="activity-item"><div className="activity-q">{t.name}</div><div className="activity-meta">v{t.version} · {t.description || '—'} · {t.created_at}</div></div>)}{templates.length === 0 && <p className="muted">Нет шаблонов</p>}</div></div>}

            {activeTab === 'ai' && <div className="panel"><h3>История запросов к ИИ ({questions.length})</h3><div className="activity-list" style={{ maxHeight: 500, overflow: 'auto' }}>{questions.map((q: any) => <div key={q.id} className="activity-item"><div className="activity-q">{q.message?.slice(0, 100)}</div><div className="activity-meta"><span className="badge">{q.model}</span><span style={{ marginLeft: 8 }}>{new Date(q.ts).toLocaleString('ru-RU')}</span></div><div className="muted" style={{ marginTop: 4 }}>{q.answer?.slice(0, 150)}...</div></div>)}{questions.length === 0 && <p className="muted">Нет запросов</p>}</div></div>}

            {activeTab === 'ontology' && ontology && <div className="panel"><h3>Онтология</h3><div className="admin-stats-grid" style={{ marginBottom: 12 }}><div className="admin-stat-card"><div className="stat-value">{ontology.nodeTypes?.length || 0}</div><div className="stat-label">Типов узлов</div></div><div className="admin-stat-card"><div className="stat-value">{ontology.roles?.length || 0}</div><div className="stat-label">Ролей</div></div><div className="admin-stat-card"><div className="stat-value">{ontology.workItemTypes?.length || 0}</div><div className="stat-label">Типов WI</div></div><div className="admin-stat-card"><div className="stat-value">{ontology.extensions?.length || 0}</div><div className="stat-label">Расширений</div></div></div><pre className="code-block">{JSON.stringify(ontology, null, 2)}</pre></div>}
          </>
        )}

        {err && <div className="panel"><p style={{ color: 'var(--danger)' }}>{err}</p></div>}

        {deleteConfirm && (
          <div className="panel" style={{ borderColor: 'var(--danger)' }}>
            <h3 style={{ color: 'var(--danger)' }}>Подтверждение удаления</h3>
            <p className="sub-hint">Это действие нельзя отменить.</p>
            <div className="toolbar">
              <button type="button" className="chip" onClick={() => { if (activeTab === 'users') deleteUser(deleteConfirm); else deleteWorkspace(deleteConfirm) }} style={{ background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' }}>Удалить</button>
              <button type="button" className="chip" onClick={() => setDeleteConfirm(null)}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}