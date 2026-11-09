function VideoPlayer({ src, poster, title }) {
  if (!src) {
    return (
      <div className="flex items-center justify-center w-full h-64 rounded-xl bg-[#252525] border border-[#333333]">
        <p className="text-[#737373] text-sm">No video available</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-medium text-[#a3a3a3] mb-2">{title}</h4>}
      <video
        controls
        className="w-full rounded-xl border border-[#333333] bg-black"
        poster={poster}
        preload="metadata"
      >
        <source src={src} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  )
}

export default VideoPlayer
