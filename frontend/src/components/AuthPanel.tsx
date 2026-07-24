import { apiUrl } from '../config'
import { useState } from 'react'

export default function AuthPanel({
  token,
  onAuth
}: {
  token: string
  onAuth: (token: string, user: any) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('admin@graph.local')
  const [password, setPassword] = useState('admin123')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setOk('')
    const url = mode === 'login' ? apiUrl('/api/auth/login') : apiUrl('/api/auth/register')
    const body =
      mode === 'login'
        ? { email, password }
        : { email, password, name: name || email }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) {
        setErr(data.error || 'Ошибка')
        return
      }
      if (data.token) {
        localStorage.setItem('gp_token', data.token)
        onAuth(data.token, data.user)
        setOk(mode === 'login' ? 'Вход выполнен' : 'Регистрация успешна')
      }
    } catch {
      setErr('Backend недоступен')
    }
  }

  if (token) {
    return (
      <div className="panel">
        <h3>Аккаунт</h3>
        <p className="sub-hint">JWT активен</p>
        <button
          type="button"
          className="chip"
          onClick={() => {
            localStorage.removeItem('gp_token')
            onAuth('', null)
          }}
        >
          Выйти
        </button>
      </div>
    )
  }

  return (
    <div className="panel">
      <h3>{mode === 'login' ? 'Вход' : 'Регистрация'}</h3>
      <div className="toolbar">
        <button type="button" className={`chip ${mode === 'login' ? 'on' : ''}`} onClick={() => setMode('login')}>Вход</button>
        <button type="button" className={`chip ${mode === 'register' ? 'on' : ''}`} onClick={() => setMode('register')}>Регистрация</button>
      </div>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {mode === 'register' && (
          <input className="field" placeholder="Имя" value={name} onChange={e => setName(e.target.value)} />
        )}
        <input className="field" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="field" type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" className="chip on">{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
      </form>
      {err && <p style={{ color: 'var(--danger)', marginTop: 8, fontSize: 13 }}>{err}</p>}
      {ok && <p style={{ color: 'var(--ok)', marginTop: 8, fontSize: 13 }}>{ok}</p>}
      <p className="sub-hint" style={{ marginTop: 8 }}>Демо: admin@graph.local / admin123</p>
    </div>
  )
}
