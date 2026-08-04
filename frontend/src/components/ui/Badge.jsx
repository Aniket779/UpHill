const VARIANTS = {
  high: 'bg-priority-high-soft text-priority-high',
  medium: 'bg-priority-medium-soft text-priority-medium',
  low: 'bg-priority-low-soft text-priority-low',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent-soft text-accent',
  ai: 'bg-ai-soft text-ai',
  neutral: 'bg-surface-secondary text-ink-secondary',
}

export default function Badge({ variant = 'neutral', className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
