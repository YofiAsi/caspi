import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/home', label: 'Home', icon: HomeIcon },
  { to: '/expenses', label: 'Expenses', icon: ListIcon },
  { to: '/analytics', label: 'Analytics', icon: ChartIcon },
  { to: '/settings', label: 'Settings', icon: GearIcon },
]

export default function TabLayout() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-50">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav
        className="flex shrink-0 border-t border-zinc-200 bg-white"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-zinc-900' : 'text-zinc-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" fill={active ? 'currentColor' : 'none'} />
      <path d="M7 9h10M7 13h6" stroke={active ? 'white' : 'currentColor'} />
    </svg>
  )
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="12" width="4" height="9" rx="1" fill={active ? 'currentColor' : 'none'} />
      <rect x="10" y="7" width="4" height="14" rx="1" fill={active ? 'currentColor' : 'none'} />
      <rect x="17" y="3" width="4" height="18" rx="1" fill={active ? 'currentColor' : 'none'} />
    </svg>
  )
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" fill={active ? 'white' : 'none'} stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}
