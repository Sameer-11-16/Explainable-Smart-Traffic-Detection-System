function LoadingSpinner({ size = 'md', message = 'Loading...' }) {
  const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div
        className={`${sizeClasses[size]} rounded-full border-orange-500/30 border-t-orange-500 animate-spin`}
      />
      {message && <p className="text-sm text-[#a3a3a3]">{message}</p>}
    </div>
  )
}

export default LoadingSpinner
