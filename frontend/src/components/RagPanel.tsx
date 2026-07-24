import { useEffect, useState } from 'react'
import { apiUrl } from '../config'

export default function RagPanel({ headers }: { headers: () => Record<string, string> }) {
  const [docs, setDocs] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  async function load() {
    const r = await fetch(apiUrl('/api/rag/documents'), { headers: headers() })
    setDocs(await r.json())
  }

  useEffect(() => { load().catch(() => {}) }, [])

  async function ingest() {
    if (!content.trim()) return
    const res = await fetch(apiUrl('/api/rag/ingest'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ title: title || 'Документ', content })
    })
    if (res.ok) {
      const data = await res.json()
      setMsg(`Загружено: ${data.chunks} chunks`)
      setTitle('')
      setContent('')
      load()
    } else setMsg('Ошибка ingest (нужен login?)')
  }

  async function search() {
    const res = await fetch(apiUrl(`/api/rag/search?q=${encodeURIComponent(q)}`), { headers: headers() })
    setHits(await res.json())
  }

  return (
    <div className="panel">
      <h3>RAG · документы workspace</h3>
      <div className="badge-row">
        {docs.map(d => <span key={d.id} className="badge">{d.title} · {d.length} символов</span>)}
        {!docs.length && <span className="badge">Документов пока нет</span>}
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        <input className="field" placeholder="Заголовок" value={title} onChange={e => setTitle(e.target.value)} />
        <textarea className="field" placeholder="Текст документа для RAG…" value={content} onChange={e => setContent(e.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="button" onClick={ingest}>Загрузить в RAG</button>
          <input className="field" placeholder="Поиск по RAG" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn ghost" type="button" onClick={search}>Найти</button>
        </div>
        {msg && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{msg}</p>}
        {hits.map((h, i) => (
          <div key={i} className="card">
            <strong>score {h.score?.toFixed?.(1) ?? h.score}</strong>
            <p>{h.text?.slice(0, 280)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
