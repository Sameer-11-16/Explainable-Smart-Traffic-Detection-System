import { AlertTriangle, RefreshCw } from 'lucide-react'

function ErrorMessage({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-4">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10">
        <AlertTriangle className="h-7 w-7 text-red-400" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-1">Error</h3>
        <p className="text-sm text-[#a3a3a3] max-w-md">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-2 transition-all text-sm font-medium cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      )}
    </div>
  )
}

export default ErrorMessage
