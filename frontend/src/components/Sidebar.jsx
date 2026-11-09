import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Video,
  BarChart3,
  Brain,
  FileText,
  Settings,
  Radar,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/detection', label: 'Detection', icon: Video },
  { to: '/analysis', label: 'Analysis', icon: BarChart3 },
  { to: '/explainability', label: 'Explainable AI', icon: Brain },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Sidebar() {
  const [expanded, setExpanded] = useState(false)

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`fixed left-0 top-0 h-screen bg-[#1a1a1a] border-r border-[#333333] z-50 flex flex-col transition-all duration-300 ease-in-out ${
        expanded ? 'w-60' : 'w-16'
      }`}
    >
      {/* Brand */}
      <div className="flex items-center h-16 px-4 border-b border-[#333333] shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500 shrink-0">
          <Radar className="h-4 w-4 text-white" />
        </div>
        <span
          className={`ml-3 text-lg font-bold tracking-tight text-white whitespace-nowrap transition-opacity duration-300 ${
            expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
          }`}
        >
          <span className="text-orange-500">S</span>TDS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative ${
                isActive
                  ? 'bg-orange-500/10 text-orange-400'
                  : 'text-[#a3a3a3] hover:text-white hover:bg-[#252525]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-orange-500 rounded-r" />
                )}
                <item.icon className="h-5 w-5 shrink-0" />
                <span
                  className={`whitespace-nowrap transition-opacity duration-300 ${
                    expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                  }`}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#333333] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            AI
          </div>
          <span
            className={`text-xs text-[#737373] whitespace-nowrap transition-opacity duration-300 ${
              expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
            }`}
          >
            Smart Traffic v1.0
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
