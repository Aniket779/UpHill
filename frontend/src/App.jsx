import { NavLink, Outlet, Route, Routes } from 'react-router-dom'
import HabitsPage from './pages/HabitsPage'
import TodayPage from './pages/TodayPage'
import WeeklyGoalsPage from './pages/WeeklyGoalsPage'
import CoachPage from './pages/CoachPage'
import ChatPage from './pages/ChatPage'
import InsightsPage from './pages/InsightsPage'

function Layout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-slate-800/80 bg-slate-950/95 px-4 py-4 lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r lg:py-10">
          <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-stretch">
            <div className="lg:px-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400/90">
                GrindOS
              </p>
              <p className="mt-1 hidden text-xs text-slate-500 lg:block">Productivity core</p>
            </div>
            <nav className="flex gap-1 rounded-xl border border-slate-800/80 bg-slate-900/40 p-1 lg:flex-col lg:border-0 lg:bg-transparent lg:p-0">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide transition lg:text-left ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
                  }`
                }
              >
                Today
              </NavLink>
              <NavLink
                to="/weekly"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide transition lg:text-left ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
                  }`
                }
              >
                Weekly
              </NavLink>
              <NavLink
                to="/chat"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide transition lg:text-left ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
                  }`
                }
              >
                Chat
              </NavLink>
              <NavLink
                to="/coach"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide transition lg:text-left ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
                  }`
                }
              >
                Coach
              </NavLink>
              <NavLink
                to="/insights"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide transition lg:text-left ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
                  }`
                }
              >
                Insights
              </NavLink>
              <NavLink
                to="/habits"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide transition lg:text-left ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
                  }`
                }
              >
                Habits
              </NavLink>
            </nav>
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-slate-800/60 lg:h-screen lg:border-l">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TodayPage />} />
        <Route path="weekly" element={<WeeklyGoalsPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="coach" element={<CoachPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="habits" element={<HabitsPage />} />
      </Route>
    </Routes>
  )
}
