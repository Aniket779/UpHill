export default function LevelBar({ level, xp }) {
  const nextLevelXp = level * 100
  const progress = xp % 100

  return (
    <div className="w-full mt-2">
      <div className="flex justify-between items-center text-[10px] text-ink-tertiary mb-1 font-medium font-mono">
        <span>LVL {level}</span>
        <span>{xp} / {nextLevelXp} XP</span>
      </div>
      <div className="h-1.5 w-full bg-surface-tertiary rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
