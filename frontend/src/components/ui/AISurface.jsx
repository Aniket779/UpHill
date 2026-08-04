/**
 * The dedicated visual language for anything AI-generated: Coach, Chat,
 * agentic suggestions, AI-derived insight callouts. A soft violet tint plus
 * a thin gradient ring (see .ai-ring in index.css) marks it as distinct from
 * ordinary cards without a loud fill, glow, or animation.
 */
export default function AISurface({ className = '', padding = 'p-6', children, ...props }) {
  return (
    <div
      className={`ai-ring rounded-card bg-ai-soft/60 ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
