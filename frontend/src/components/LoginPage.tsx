import { useState } from 'react'
import { apiUrl } from '../config'

export default function LoginPage({
  onSuccess,
  onBack
}: {
  onSuccess: (token: string, user: any) => void
  onBack: () => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('admin@graph.local')
  const [password, setPassword] = useState('admin123')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body =
      mode === 'login'
        ? { email, password }
        : { email, password, name: name || email.split('@')[0] }
    try {
      const res = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) {
        setErr(data.error || 'Ошибка')
        setLoading(false)
        return
      }
      if (data.token) {
        localStorage.setItem('gp_token', data.token)
        onSuccess(data.token, data.user)
      }
    } catch {
      setErr('Backend недоступен')
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <button type="button" className="auth-back" onClick={onBack}>← На платформу</button>
        <p className="eyebrow">Graph Platform</p>
        <h1>{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
        <p className="hint">
          {mode === 'login'
            ? 'Войдите, чтобы открыть профиль, админку и персональные настройки.'
            : 'Создайте аккаунт. Новые пользователи получают роль member.'}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'on' : ''}
            onClick={() => setMode('login')}
          >
            Вход
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'on' : ''}
            onClick={() => setMode('register')}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label>
              <span>Имя</span>
              <input
                className="field"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Как к вам обращаться"
              />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              className="field"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            <span>Пароль</span>
            <input
              className="field"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          {err && <div className="auth-err">{err}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <p className="auth-demo">Демо-админ: admin@graph.local / admin123</p>
      </div>
    </div>
  )
}
