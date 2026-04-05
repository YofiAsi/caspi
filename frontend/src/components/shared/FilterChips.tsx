interface Chip<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  chips: Chip<T>[]
  active: T
  onChange: (v: T) => void
}

export default function FilterChips<T extends string>({ chips, active, onChange }: Props<T>) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
      {chips.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            active === value
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
