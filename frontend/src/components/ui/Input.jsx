export default function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-tertiary transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-50 ${className}`}
      {...props}
    />
  )
}
