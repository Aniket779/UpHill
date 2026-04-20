import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchIcon, SunIcon, CalendarIcon, MessageIcon, TargetIcon, UserIcon, BarChartIcon, CheckCircleIcon } from './Icons'
import { apiFetch } from '../lib/api'
import { todayLocalString } from '../utils/date'

const apiBase = import.meta.env.VITE_API_URL ?? ''

const pages = [
  { id: 'today', title: 'Go to Today', icon: SunIcon, path: '/' },
  { id: 'weekly', title: 'Go to Weekly', icon: CalendarIcon, path: '/weekly' },
  { id: 'habits', title: 'Go to Habits', icon: CheckCircleIcon, path: '/habits' },
  { id: 'focus', title: 'Go to Focus', icon: TargetIcon, path: '/focus' },
  { id: 'chat', title: 'Go to Chat', icon: MessageIcon, path: '/chat' },
  { id: 'coach', title: 'Go to Coach', icon: UserIcon, path: '/coach' },
  { id: 'insights', title: 'Go to Insights', icon: BarChartIcon, path: '/insights' },
]

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((open) => !open)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Custom event to open from other components
  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    window.addEventListener('open-command-palette', handleOpen)
    return () => window.removeEventListener('open-command-palette', handleOpen)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      // Focus after small delay to let render happen
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const filteredPages = pages.filter((page) =>
    page.title.toLowerCase().includes(query.toLowerCase())
  )

  const showAddTask = query.trim().length > 0
  const items = [...filteredPages]
  if (showAddTask) {
    items.unshift({ id: 'add-task', title: `Add task: "${query.trim()}"`, isAction: true })
  }

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = async (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items.length > 0) {
        await executeAction(items[selectedIndex])
      }
    }
  }

  const executeAction = async (item) => {
    if (item.id === 'add-task') {
      setIsSubmitting(true)
      try {
        await apiFetch(`${apiBase}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: query.trim(),
            priority: 'medium',
            date: todayLocalString(),
            category: 'general',
            tags: [],
            goalId: null,
          }),
        })
        setIsOpen(false)
        window.dispatchEvent(new Event('task-added'))
      } finally {
        setIsSubmitting(false)
      }
    } else {
      navigate(item.path)
      setIsOpen(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center border-b border-white/5 px-4 py-3">
          <SearchIcon className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
          />
          <div className="flex shrink-0 items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 border border-white/10">
            ESC
          </div>
        </div>

        {items.length > 0 ? (
          <ul className="max-h-72 overflow-y-auto p-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {items.map((item, index) => {
              const isSelected = index === selectedIndex
              return (
                <li
                  key={item.id}
                  onClick={() => executeAction(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                    isSelected ? 'bg-indigo-500/10 text-indigo-100' : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {item.icon ? (
                    <item.icon className={`h-4 w-4 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                  ) : (
                    <div className={`flex h-5 w-5 items-center justify-center rounded bg-indigo-500/20 text-[10px] font-bold text-indigo-400`}>
                      +
                    </div>
                  )}
                  <span className="text-sm font-medium">{item.title}</span>
                  {isSelected && item.isAction && isSubmitting && (
                    <span className="ml-auto text-xs text-indigo-400 animate-pulse">Saving...</span>
                  )}
                  {isSelected && !item.isAction && (
                    <span className="ml-auto text-xs text-indigo-400">Jump to</span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            No results found.
          </div>
        )}
      </div>
    </div>
  )
}
