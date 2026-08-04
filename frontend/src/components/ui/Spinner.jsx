export default function Spinner({ className = 'h-4 w-4', variant = 'current' }) {
  const color = variant === 'white' ? 'border-white/30 border-t-white' : 'border-ink-tertiary/30 border-t-ink-secondary'
  return <span className={`inline-block animate-spin rounded-full border-2 ${color} ${className}`} />
}
