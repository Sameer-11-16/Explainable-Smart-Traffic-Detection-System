export function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

export function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDuration(seconds) {
  if (!seconds) return '0s'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

export function getCongestionColor(level) {
  if (!level) return '#737373'
  const l = level.toLowerCase()
  if (l === 'low' || l === 'free flow') return '#22c55e'
  if (l === 'medium' || l === 'moderate') return '#eab308'
  if (l === 'high' || l === 'heavy' || l === 'severe') return '#ef4444'
  return '#737373'
}

export function getCongestionBg(level) {
  if (!level) return 'bg-neutral-700'
  const l = level.toLowerCase()
  if (l === 'low' || l === 'free flow') return 'bg-green-500/20'
  if (l === 'medium' || l === 'moderate') return 'bg-yellow-500/20'
  if (l === 'high' || l === 'heavy' || l === 'severe') return 'bg-red-500/20'
  return 'bg-neutral-700'
}

export function getCongestionText(level) {
  if (!level) return 'text-neutral-400'
  const l = level.toLowerCase()
  if (l === 'low' || l === 'free flow') return 'text-green-400'
  if (l === 'medium' || l === 'moderate') return 'text-yellow-400'
  if (l === 'high' || l === 'heavy' || l === 'severe') return 'text-red-400'
  return 'text-neutral-400'
}

export function truncateFilename(name, maxLen = 30) {
  if (!name) return 'Unknown'
  if (name.length <= maxLen) return name
  const ext = name.split('.').pop()
  return name.substring(0, maxLen - ext.length - 4) + '...' + ext
}

export function validateVideoFile(file) {
  const allowedTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo']
  const maxSize = 500 * 1024 * 1024 // 500MB

  if (!allowedTypes.includes(file.type)) {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['mp4', 'avi', 'mov'].includes(ext)) {
      return { valid: false, error: 'Invalid file format. Please upload MP4, AVI, or MOV files.' }
    }
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 500MB.' }
  }

  return { valid: true, error: null }
}

export function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i]
}

export const CHART_COLORS = ['#f97316', '#fb923c', '#ea580c', '#fdba74', '#c2410c', '#fed7aa']
