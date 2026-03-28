import { getTagChipStyle } from '../lib/tagColors'

type Props = {
  tag: string
  className?: string
  onRemove?: () => void
  disabled?: boolean
  removeAriaLabel?: string
}

export function TagChip({ tag, className = '', onRemove, disabled, removeAriaLabel }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${className}`}
      style={getTagChipStyle(tag)}
    >
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="leading-none opacity-70 hover:opacity-100 disabled:opacity-40"
          aria-label={removeAriaLabel ?? `Remove tag ${tag}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
