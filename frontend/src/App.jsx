import { NavLink, Navigate, Outlet, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { SunIcon, CalendarIcon, MessageIcon, TargetIcon, UserIcon, BarChartIcon, CheckCircleIcon, SearchIcon, CommandIcon } from './components/Icons'
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
import { clearToken, getToken } from './lib/auth'
import RemindersPopover from './components/RemindersPopover'
import CommandPalette from './components/CommandPalette'

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = getToken()

  const path = location.pathname.split('/')[1] || 'Today'
  const breadcrumb = path.charAt(0).toUpperCase() + path.slice(1)

  return (
    <div className="min-h-screen text-slate-100 flex flex-col lg:flex-row font-sans">
      <aside className="w-full lg:w-64 shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-white/5 bg-slate-950/50 backdrop-blur-xl">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <span className="text-sm font-semibold tracking-wide text-slate-200">GrindOS</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 flex gap-2 lg:flex-col [&::-webkit-scrollbar]:hidden">
          <div className="lg:mb-6">
            <p className="hidden lg:block px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-2">Main</p>
            <nav className="flex gap-1 lg:flex-col">
              {[
                { to: '/', icon: SunIcon, label: 'Today', end: true },
                { to: '/weekly', icon: CalendarIcon, label: 'Weekly' },
                { to: '/kanban', icon: TargetIcon, label: 'Board' },
                { to: '/habits', icon: CheckCircleIcon, label: 'Habits' },
                { to: '/focus', icon: TargetIcon, label: 'Focus' },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white/10 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 opacity-70 group-hover:opacity-100" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div>
            <p className="hidden lg:block px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-2">Analytics & AI</p>
            <nav className="flex gap-1 lg:flex-col">
              {[
                { to: '/chat', icon: MessageIcon, label: 'Chat' },
                { to: '/coach', icon: UserIcon, label: 'Coach' },
                { to: '/insights', icon: BarChartIcon, label: 'Insights' },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white/10 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 opacity-70 group-hover:opacity-100" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {token && (
          <div className="hidden lg:block p-4 mt-auto border-t border-white/5">
            <div 
              onClick={() => navigate('/profile')}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-200">User</p>
                  <p className="text-[10px] text-slate-500">Free Plan</p>
                </div>
              </div>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  clearToken(); 
                  navigate('/auth'); 
                }} 
                className="text-xs text-slate-500 hover:text-rose-400 transition" 
                title="Logout"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <header className="h-14 lg:h-16 flex items-center justify-between px-4 lg:px-8 border-b border-white/5 backdrop-blur-md bg-slate-950/20 z-40 sticky top-0">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <span className="hover:text-slate-200 cursor-pointer transition">GrindOS</span>
            <span>/</span>
            <span className="text-slate-200">{breadcrumb}</span>
          </div>

          <div className="flex items-center gap-4">
            <div 
              onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
              className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 hover:bg-white/10 hover:border-white/20 transition cursor-pointer group"
            >
              <SearchIcon className="h-4 w-4 text-slate-400 group-hover:text-slate-200 transition" />
              <span className="text-xs text-slate-400 pr-8 group-hover:text-slate-200 transition">Search tasks...</span>
              <div className="flex items-center gap-1 border border-white/10 rounded px-1.5 py-0.5 bg-slate-950/50 text-[10px] text-slate-400">
                <CommandIcon className="h-3 w-3" />
                <span>K</span>
              </div>
            </div>

            <RemindersPopover />
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
  if (!getToken()) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  return (
    <>
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
    </>
  )
}
