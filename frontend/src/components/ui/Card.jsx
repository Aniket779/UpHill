export default function Card({ className = '', padding = 'p-6', children, ...props }) {
  return (
    <div
      className={`rounded-card border border-border bg-surface shadow-card ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
