const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-active disabled:bg-accent/40',
  secondary: 'bg-surface text-ink border border-border-strong hover:bg-surface-secondary disabled:opacity-50',
  ghost: 'bg-transparent text-ink-secondary hover:bg-surface-secondary hover:text-ink disabled:opacity-50',
  danger: 'bg-surface text-danger border border-danger-border hover:bg-danger-soft disabled:opacity-50',
  ai: 'bg-ai text-white hover:bg-ai-hover disabled:bg-ai/40',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-sm gap-2',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-control font-medium transition-colors duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
