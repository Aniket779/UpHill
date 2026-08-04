export default function IconButton({ className = '', size = 'md', children, ...props }) {
  const dims = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  return (
    <button
      className={`inline-flex ${dims} shrink-0 items-center justify-center rounded-full border border-border text-ink-secondary transition-colors hover:border-border-strong hover:bg-surface-secondary hover:text-ink disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
