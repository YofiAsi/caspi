import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  header: ReactNode
  children: ReactNode
  className?: string
  scrollRef?: (el: HTMLDivElement | null) => void
  disableCollapse?: boolean
}

export function CollapsingHeader({ header, children, className = '', scrollRef, disableCollapse = false }: Props) {
  const [visible, setVisible] = useState(true)
  const lastY = useRef(0)
  const headerRef = useRef<HTMLDivElement>(null)
  const scrollElRef = useRef<HTMLDivElement | null>(null)
  const [headerH, setHeaderH] = useState(0)
  const headerHRef = useRef(0)
  const lastToggle = useRef(0)

  const setScrollEl = useCallback(
    (el: HTMLDivElement | null) => {
      scrollElRef.current = el
      scrollRef?.(el)
    },
    [scrollRef],
  )

  // Measure header height
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height
      headerHRef.current = h
      setHeaderH(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = scrollElRef.current
    if (!el) return

    const onScroll = () => {
      // Skip collapse on desktop or when disabled
      if (disableCollapse || window.innerWidth >= 768) {
        setVisible(true)
        return
      }
      const y = el.scrollTop
      const delta = y - lastY.current
      lastY.current = y

      const now = Date.now()
      // Cooldown: ignore state changes within 300ms of the last one to prevent oscillation
      if (now - lastToggle.current < 300) return

      if (delta > 4) {
        setVisible((prev) => {
          if (prev) lastToggle.current = now
          return false
        })
      } else if (delta < -4) {
        setVisible((prev) => {
          if (!prev) lastToggle.current = now
          return true
        })
      }
    }

    const onResize = () => {
      if (window.innerWidth >= 768) setVisible(true)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const offset = visible ? 0 : -headerH

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div
        ref={headerRef}
        className="shrink-0"
        style={{
          transform: `translateY(${offset}px)`,
          marginBottom: `${offset}px`,
          transition: 'transform 0.25s ease, margin-bottom 0.25s ease',
        }}
      >
        {header}
      </div>
      <div ref={setScrollEl} className="flex-1 overflow-y-auto min-h-0">
        {children}
      </div>
    </div>
  )
}
