import { useTheme } from 'next-themes'
import { getTagChipStyleById, type TagColorVariant } from '../lib/tagColors'

type Props = {
  tagId: string
  label: string
  className?: string
  onRemove?: () => void
  disabled?: boolean
  removeAriaLabel?: string
}

function resolvedVariant(resolvedTheme: string | undefined): TagColorVariant {
  return resolvedTheme === 'dark' ? 'dark' : 'light'
}

export function TagChip({
  tagId,
  label,
  className = '',
  onRemove,
  disabled,
  removeAriaLabel,
}: Props) {
  const { resolvedTheme } = useTheme()
  const variant = resolvedVariant(resolvedTheme)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${className}`}
      style={getTagChipStyleById(tagId, variant)}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="leading-none opacity-70 hover:opacity-100 disabled:opacity-40"
          aria-label={removeAriaLabel ?? `Remove tag ${label}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
