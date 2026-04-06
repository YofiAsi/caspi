import { NavLink } from 'react-router-dom'

const tabs = [
  {
    label: 'Home',
    to: '/',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Expenses',
    to: '/expenses',
    end: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth={1.6} />
        <path d="M3 10H21" stroke="currentColor" strokeWidth={1.6} />
        <path d="M8 15H11" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        <circle cx="16" cy="15" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'Analytics',
    to: '/analytics',
    end: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M4 20V15M9 20V9M14 20V12M19 20V4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    to: '/settings',
    end: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.6} />
        <path d="M12 2V4M12 20V22M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M2 12H4M20 12H22M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      </svg>
    ),
  },
]

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-nav-bg pb-safe"
      style={{ backdropFilter: 'blur(24px)', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}
      aria-label="Main navigation"
    >
      <div className="flex items-start pt-3.5 h-[88px]">
        {tabs.map(({ label, to, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-accent opacity-100' : 'text-fg-muted opacity-35'
              }`
            }
          >
            {icon}
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
