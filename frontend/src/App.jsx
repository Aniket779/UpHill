import { useEffect } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { SunIcon, CalendarIcon, MessageIcon, TargetIcon, UserIcon, BarChartIcon, CheckCircleIcon, SearchIcon, CommandIcon, LogoMark, LogOutIcon } from './components/Icons'
import HabitsPage from './pages/HabitsPage'
import TodayPage from './pages/TodayPage'
import WeeklyGoalsPage from './pages/WeeklyGoalsPage'
import KanbanPage from './pages/KanbanPage'
import ProfilePage from './pages/ProfilePage'
import CoachPage from './pages/CoachPage'
import ChatPage from './pages/ChatPage'
import InsightsPage from './pages/InsightsPage'
import FocusPage from './pages/FocusPage'
import AuthPage from './pages/AuthPage'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/useAuth'
import { disconnectSocket, getSocket } from './lib/socket'
import NotificationsPopover from './components/NotificationsPopover'
import CommandPalette from './components/CommandPalette'
import LevelBar from './components/LevelBar'

const MAIN_NAV = [
  { to: '/', icon: SunIcon, label: 'Today', end: true },
  { to: '/weekly', icon: CalendarIcon, label: 'Weekly' },
  { to: '/kanban', icon: TargetIcon, label: 'Board' },
  { to: '/habits', icon: CheckCircleIcon, label: 'Habits' },
  { to: '/focus', icon: TargetIcon, label: 'Focus' },
]

const AI_NAV = [
  { to: '/chat', icon: MessageIcon, label: 'Chat' },
  { to: '/coach', icon: UserIcon, label: 'Coach' },
  { to: '/insights', icon: BarChartIcon, label: 'Insights' },
]

function NavSection({ label, items }) {
  return (
    <div>
      <p className="hidden lg:block px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-tertiary mb-1.5">
        {label}
      </p>
      <nav className="flex gap-1 lg:flex-col">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink-secondary hover:bg-surface-secondary hover:text-ink'
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, setUser, logout } = useAuth()

  const path = location.pathname.split('/')[1] || 'Today'
  const breadcrumb = path.charAt(0).toUpperCase() + path.slice(1)

  useEffect(() => {
    if (!user) return

    const socket = getSocket()
    const onXpUpdated = (data) => {
      setUser(prev => prev ? { ...prev, xp: data.xp, level: data.level } : prev)
    }

    socket.on('xp:updated', onXpUpdated)

    return () => {
      socket.off('xp:updated', onXpUpdated)
    }
  }, [user, setUser])

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col lg:flex-row">
      <aside className="w-full lg:w-64 shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-surface">
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <LogoMark className="h-[18px] w-[18px]" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-ink">UpHill</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 flex gap-2 lg:flex-col lg:gap-6 [&::-webkit-scrollbar]:hidden">
          <NavSection label="Main" items={MAIN_NAV} />
          <NavSection label="Analytics &amp; AI" items={AI_NAV} />
        </div>

        {user && (
          <div className="hidden lg:block p-3 mt-auto border-t border-border">
            <div
              onClick={() => navigate('/profile')}
              className="flex items-center justify-between rounded-control p-2 cursor-pointer transition-colors hover:bg-surface-secondary"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary border border-border text-ink-tertiary">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">{user?.name || 'User'}</p>
                  <p className="text-[11px] text-ink-tertiary">Free Plan</p>
                </div>
              </div>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await logout();
                  disconnectSocket();
                  navigate('/auth');
                }}
                className="shrink-0 rounded-control p-1.5 text-ink-tertiary transition-colors hover:bg-surface-tertiary hover:text-danger"
                title="Logout"
              >
                <LogOutIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            {user && <div className="px-2"><LevelBar level={user.level || 1} xp={user.xp || 0} /></div>}
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <header className="h-14 lg:h-16 flex items-center justify-between px-4 lg:px-8 border-b border-border bg-surface/90 backdrop-blur-sm z-40 sticky top-0">
          <div className="flex items-center gap-2 text-sm font-medium text-ink-tertiary">
            <span className="text-ink-secondary">UpHill</span>
            <span>/</span>
            <span className="text-ink">{breadcrumb}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
              className="hidden sm:flex items-center gap-2 rounded-control border border-border bg-surface-secondary/60 px-3 py-1.5 text-ink-tertiary transition-colors hover:border-border-strong hover:bg-surface-secondary hover:text-ink-secondary"
            >
              <SearchIcon className="h-3.5 w-3.5" />
              <span className="text-xs pr-6">Search tasks...</span>
              <span className="flex items-center gap-0.5 rounded border border-border-strong bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-tertiary">
                <CommandIcon className="h-2.5 w-2.5" />K
              </span>
            </button>

            <NotificationsPopover />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto lg:p-8 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="min-h-screen bg-bg" />
  }
  if (!user) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="auth" element={<AuthPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<TodayPage />} />
          <Route path="day/:date" element={<TodayPage />} />
          <Route path="weekly" element={<WeeklyGoalsPage />} />
          <Route path="kanban" element={<KanbanPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="focus" element={<FocusPage />} />
          <Route path="coach" element={<CoachPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="habits" element={<HabitsPage />} />
        </Route>
      </Routes>
      <CommandPalette />
    </AuthProvider>
  )
}
