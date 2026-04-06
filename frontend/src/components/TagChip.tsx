import { useTheme } from 'next-themes'
import { getTagChipStyleById, type TagColorVariant } from '../lib/tagColors'

type Props = {
  tagId: string
  label: string
  className?: string
  variant?: 'default' | 'collection' | 'untagged'
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
  variant = 'default',
  onRemove,
  disabled,
  removeAriaLabel,
}: Props) {
  const { resolvedTheme } = useTheme()
  const colorVariant = resolvedVariant(resolvedTheme)

  const variantStyles: React.CSSProperties =
    variant === 'collection'
      ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'rgba(212,168,83,0.25)' }
      : variant === 'untagged'
        ? { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-fg)', borderColor: 'rgba(232,88,88,0.2)' }
        : getTagChipStyleById(tagId, colorVariant)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${variant === 'untagged' ? 'font-semibold' : ''} ${className}`}
      style={{ ...variantStyles, border: `0.5px solid ${variantStyles.borderColor ?? 'rgba(255,255,255,0.1)'}` }}
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
          x
        </button>
      )}
    </span>
  )
}
