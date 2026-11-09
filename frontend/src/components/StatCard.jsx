function StatCard({ icon: Icon, label, value, subtitle, gradient = false }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#333333] p-6 shadow-lg transition-all hover:border-orange-500/30 ${
        gradient
          ? 'bg-gradient-to-br from-[#1a1a1a] to-orange-500/5'
          : 'bg-[#1a1a1a]'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#a3a3a3] mb-1">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-white">{value ?? '—'}</p>
          {subtitle && (
            <p className="text-xs text-[#737373] mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-orange-500/10 shrink-0 ml-3">
            <Icon className="h-5 w-5 text-orange-400" />
          </div>
        )}
      </div>
    </div>
  )
}

export default StatCard
