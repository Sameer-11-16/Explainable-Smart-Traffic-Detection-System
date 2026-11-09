function ConfidenceBadge({ confidence, label }) {
  const pct = typeof confidence === 'number' ? confidence : parseFloat(confidence) || 0
  const displayPct = (pct > 1 ? pct : pct * 100).toFixed(1)

  let color = 'text-red-400 bg-red-500/10'
  if (displayPct >= 80) color = 'text-green-400 bg-green-500/10'
  else if (displayPct >= 60) color = 'text-yellow-400 bg-yellow-500/10'
  else if (displayPct >= 40) color = 'text-orange-400 bg-orange-500/10'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {label && <span>{label}:</span>}
      {displayPct}%
    </span>
  )
}

export default ConfidenceBadge
