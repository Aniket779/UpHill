export function todayLocalString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatHeading(ymd) {
  if (ymd === 'today' || !ymd || ymd === todayLocalString()) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date())
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parseYmd(ymd))
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Monday of the week containing `ref`, in local time (YYYY-MM-DD). */
export function weekStartMondayLocal(ref = new Date()) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const day = d.getDay()
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatWeekRangeLabel(weekStartYmd) {
  const start = parseYmd(weekStartYmd)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const md = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  const y = new Intl.DateTimeFormat(undefined, { year: 'numeric' })
  return `${md.format(start)} — ${md.format(end)}, ${y.format(end)}`
}

export function addDays(ymd, amount) {
  const d = ymd === 'today' ? new Date() : parseYmd(ymd)
  d.setDate(d.getDate() + amount)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function getShortWeekday(ymd) {
  const d = ymd === 'today' ? new Date() : parseYmd(ymd)
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d)
}

export function getNumericDay(ymd) {
  const d = ymd === 'today' ? new Date() : parseYmd(ymd)
  return new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(d)
}
