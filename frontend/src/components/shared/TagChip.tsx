interface Props {
  name: string
  onRemove?: () => void
  variant?: 'default' | 'muted'
}

export default function TagChip({ name, onRemove, variant = 'default' }: Props) {
  const base =
    variant === 'muted'
      ? 'bg-zinc-100 text-zinc-400'
      : 'bg-zinc-800 text-white'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${base}`}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center rounded-full opacity-70 hover:opacity-100"
          aria-label={`Remove ${name}`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  )
}
