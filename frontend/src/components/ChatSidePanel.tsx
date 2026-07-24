import { useState } from 'react'
import { apiUrl } from '../config'

const SUGGESTIONS = [
  'Привет',
  'Кто ты?',
  'Что такое граф знаний?',
  'Interest Scope',
  'Control Knowledge',
  'Как работает Pipe?'
]

export default function ChatSidePanel({ selectedNodeIds, tab, headers }: any) {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    {
      role: 'bot',
      text: 'Graph Copilot. Отдельная панель чата.\nDeepSeek — если ключ есть; иначе локальная RNN.\nСпросите: «привет», «кто ты», про домены и граф.'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send(text?: string) {
    const message = (text ?? input).trim()
    if (!message || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: message }])
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/copilot/chat'), {
        method: 'POST',
        headers: typeof headers === 'function' ? headers() : headers,
        body: JSON.stringify({
          message,
          selectedNodeIds: selectedNodeIds || [],
          actorId: 'act-ai',
          tab
        })
      })
      const data = await res.json()
      const tag = data.usedExternalLLM ? `\n\n✦ ${data.model}` : `\n\n· ${data.model || 'local'}`
      setMessages(m => [...m, { role: 'bot', text: (data.answer || 'Пустой ответ') + tag }])
    } catch {
      setMessages(m => [
        ...m,
        { role: 'bot', text: 'Backend недоступен. Проверьте: offline-ai :5005 и backend :3001' }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="app-chat">
      <div className="chat-head">
        <h2>Graph Copilot</h2>
        <p>
          Отдельное окно чата · Context Builder + RAG + LLM/RNN
          {selectedNodeIds?.length ? ` · узлы: ${selectedNodeIds.join(', ')}` : ''}
        </p>
      </div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>{m.text}</div>
        ))}
        {loading && <div className="msg bot">Думаю…</div>}
      </div>
      <div className="chat-suggestions">
        {SUGGESTIONS.map(s => (
          <button key={s} type="button" className="chip" onClick={() => send(s)}>{s}</button>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={e => {
          e.preventDefault()
          send()
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Сообщение…"
          disabled={loading}
        />
        <button type="submit" disabled={loading}>→</button>
      </form>
    </aside>
  )
}
