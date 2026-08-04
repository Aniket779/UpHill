export default function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}
