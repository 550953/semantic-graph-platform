import { useState } from 'react'
import { apiUrl } from '../config'

const SUGGESTIONS = [
  'Что такое граф знаний?',
  'Control Knowledge',
  'Interest Scope',
  'Как работает RAG?',
  'Workspace multi-tenant',
  '4 слоя Transformation Graph'
]

export default function ChatPanel({ selectedNodeIds, tab, headers }: any) {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: 'bot', text: 'Graph Copilot: Context Builder + RAG + DeepSeek/OpenAI Gateway. Выберите узел на схеме — он попадёт в контекст.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send(text?: string) {
    const message = (text || input).trim()
    if (!message) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: message }])
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/copilot/chat'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ message, selectedNodeIds, actorId: 'act-ai', tab })
      })
      const data = await res.json()
      const meta = data.usedExternalLLM ? `\n\n✦ ${data.model}` : `\n\n· ${data.model}`
      setMessages(m => [...m, { role: 'bot', text: (data.answer || '') + meta }])
    } catch {
      setMessages(m => [...m, { role: 'bot', text: 'Backend offline. cd backend && npm i && npm run dev' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel">
      <h3>Graph Copilot</h3>
      <div className="chat-box">
        {messages.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.text}</div>)}
        {loading && <div className="msg bot">Собираю контекст графа и RAG…</div>}
      </div>
      <div className="badge-row">
        {SUGGESTIONS.map(s => (
          <button key={s} className="chip" type="button" onClick={() => send(s)}>{s}</button>
        ))}
      </div>
      <div className="chat-input">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Вопрос по графу…" />
        <button type="button" onClick={() => send()} disabled={loading}>Спросить</button>
      </div>
    </div>
  )
}
