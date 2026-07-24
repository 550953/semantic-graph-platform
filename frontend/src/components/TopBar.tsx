export default function TopBar({
  user,
  token,
  health,
  onLogin,
  onLogout,
  onAdmin,
  onReviews,
  onHome
}: {
  user: any
  token: string
  health: any
  onLogin: () => void
  onLogout: () => void
  onAdmin: () => void
  onReviews: () => void
  onHome: () => void
}) {
  return (
    <header className="topbar">
      <div className="topbar-left" onClick={onHome} style={{ cursor: 'pointer' }}>
        <span className="topbar-logo">GP</span>
        <div>
          <div className="topbar-title">Graph Platform</div>
          <div className="topbar-sub">Bank Knowledge · demo</div>
        </div>
      </div>

      <nav className="topbar-nav">
        <button type="button" className="chip" onClick={onHome}>Граф</button>
        <button type="button" className="chip" onClick={onReviews}>Отзывы</button>
        {user?.role === 'admin' && (
          <button type="button" className="chip on" onClick={onAdmin}>Админка</button>
        )}
        {health?.ok && <span className="badge ok">API</span>}
      </nav>

      <div className="topbar-profile">
        {token && user ? (
          <>
            <div className="profile-chip">
              <span className="profile-avatar">{(user.name || user.email || '?')[0].toUpperCase()}</span>
              <div className="profile-meta">
                <div className="profile-name">{user.name || user.email}</div>
                <div className="profile-role">{user.role || 'member'}</div>
              </div>
            </div>
            <button type="button" className="chip" onClick={onLogout}>Выйти</button>
          </>
        ) : (
          <button type="button" className="chip on" onClick={onLogin}>Войти</button>
        )}
      </div>
    </header>
  )
}
