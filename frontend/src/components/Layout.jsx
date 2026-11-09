import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

function Layout() {
  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Sidebar />
      <main className="ml-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
