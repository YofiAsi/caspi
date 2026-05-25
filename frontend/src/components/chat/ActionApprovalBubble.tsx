import type { PendingAction } from '../../types'

interface Props {
  pending: PendingAction
  onApprove: () => void
  onReject: () => void
  disabled?: boolean
}

export function ActionApprovalBubble({ pending, onApprove, onReject, disabled }: Props) {
  return (
    <div className="px-4 py-2">
      <div
        className="rounded-2xl px-4 py-3 bg-surface"
        style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}
      >
        <p className="text-[12px] font-semibold text-fg-subtle uppercase tracking-wide mb-1.5">
          Approve change
        </p>
        <p className="text-[14px] text-fg mb-3">{pending.summary}</p>
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onReject}
            disabled={disabled}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-muted text-fg-muted hover:bg-hover-surface disabled:opacity-40 transition-colors"
            aria-label="Reject"
          >
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={disabled}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40 transition-opacity"
            aria-label="Approve"
          >
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
