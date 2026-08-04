export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`rounded-card border border-dashed border-border-strong px-6 py-14 text-center ${className}`}>
      {Icon && (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary text-ink-tertiary">
          <Icon className="h-5 w-5" />
        </div>
      )}
      {title && <p className="text-sm font-medium text-ink-secondary">{title}</p>}
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-tertiary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
