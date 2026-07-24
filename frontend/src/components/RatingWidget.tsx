import { useEffect, useState } from 'react'
import { apiUrl } from '../config'

export default function RatingWidget({ headers }: { headers: () => Record<string, string> }) {
  const [score, setScore] = useState(5)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [avg, setAvg] = useState(0)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  async function load() {
    const res = await fetch(apiUrl('/api/ratings'), { headers: headers() })
    const data = await res.json()
    setAvg(Number(data.average) || 0)
    setCount(Number(data.count) || 0)
    setItems(Array.isArray(data.items) ? data.items.slice(0, 10) : [])
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(apiUrl('/api/ratings'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ score, comment, userName: name || 'Гость', page: 'platform' })
    })
    if (res.ok) {
      setMsg('Спасибо! Оценка сохранена')
      setComment('')
      load()
    } else {
      setMsg('Не удалось сохранить')
    }
  }

  return (
    <div className="panel">
      <h3>Оценка платформы</h3>
      <p className="sub-hint">
        Средняя: <strong>{avg ? avg.toFixed(2) : '—'}</strong> · голосов: {count}
      </p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <div className="toolbar">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              className={`chip ${score === n ? 'on' : ''}`}
              onClick={() => setScore(n)}
            >
              {n}★
            </button>
          ))}
        </div>
        <input className="field" placeholder="Ваше имя (необязательно)" value={name} onChange={e => setName(e.target.value)} />
        <textarea className="field" placeholder="Комментарий…" value={comment} onChange={e => setComment(e.target.value)} />
        <button type="submit" className="chip on">Отправить оценку</button>
      </form>
      {msg && <p className="sub-hint">{msg}</p>}
      <div className="activity-list" style={{ marginTop: 12 }}>
        {items.map((r: any) => (
          <div key={r.id} className="activity-item">
            <div className="activity-q">{'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)} · {r.user_name}</div>
            <div className="activity-meta">{r.comment || 'без комментария'} · {r.created_at}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
