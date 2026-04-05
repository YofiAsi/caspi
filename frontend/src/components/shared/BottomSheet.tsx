import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function BottomSheet({ open, onClose, title, children }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="relative flex max-h-[92dvh] flex-col rounded-t-2xl bg-white"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-zinc-300" />
        </div>
        {title && (
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 shrink-0">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 active:bg-zinc-100"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l12 12M14 2L2 14" />
              </svg>
            </button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  )
}
