import React from 'react'

export default function LevelBar({ level, xp }) {
  const nextLevelXp = level * 100
  const progress = xp % 100

  return (
    <div className="w-full mt-2">
      <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1 font-medium">
        <span>Lvl {level}</span>
        <span>{xp} / {nextLevelXp} XP</span>
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden shadow-inner">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
