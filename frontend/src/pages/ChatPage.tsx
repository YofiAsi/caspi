import { useRef, useEffect, useState } from 'react'
import { CollapsingHeader } from '../components/CollapsingHeader'
import { ChatMessageBubble } from '../components/chat/ChatMessageBubble'
import { ActionApprovalBubble } from '../components/chat/ActionApprovalBubble'
import { useAgentChat } from '../hooks/useAgentChat'

export function ChatPage() {
  const { messages, pending, status, error, send, approve, reject } = useAgentChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const busy = status === 'loading'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending, status])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const text = input
    setInput('')
    void send(text)
  }

  const visibleMessages = messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant' || m.role === 'tool',
  )

  return (
    <CollapsingHeader
      header={
        <div className="px-5 pt-5 pb-1">
          <h1 className="text-[28px] font-[800] text-fg tracking-tight">Chat</h1>
          <p className="text-[13px] text-fg-muted mt-0.5">Finance assistant for your Caspi data</p>
        </div>
      }
      className="flex-1 min-h-0 flex flex-col animate-fadeUp"
    >
      <div className="flex-1 min-h-0 flex flex-col max-w-lg w-full mx-auto">
        <div className="flex-1 min-h-0 overflow-y-auto pb-2">
          {visibleMessages.length === 0 && status === 'idle' && !error && (
            <p className="text-center text-fg-subtle text-sm px-6 pt-12">
              Ask about spending, tags, collections, or Splitwise rules.
            </p>
          )}
          {visibleMessages.map((m, i) => {
            const prev = i > 0 ? visibleMessages[i - 1] : null
            if (
              m.role === 'tool' &&
              prev?.role === 'tool' &&
              m.content &&
              prev.content &&
              m.content === prev.content
            ) {
              return null
            }
            return <ChatMessageBubble key={`${m.role}-${i}`} message={m} />
          })}
          {pending && (
            <ActionApprovalBubble
              pending={pending}
              onApprove={() => void approve()}
              onReject={() => void reject()}
              disabled={busy}
            />
          )}
          {busy && (
            <div className="flex justify-start px-4 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-accent">
                <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
                Thinking…
              </span>
            </div>
          )}
          {error && (
            <p className="text-center text-danger-fg text-xs px-6 py-2">{error}</p>
          )}
          <div ref={bottomRef} className="h-2" />
        </div>

        <form
          onSubmit={handleSubmit}
          className="shrink-0 px-4 pb-24 pt-2"
        >
          <div
            className="flex items-end gap-2 rounded-2xl bg-surface px-3 py-2"
            style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              rows={1}
              placeholder="Message…"
              disabled={busy}
              className="flex-1 resize-none bg-transparent text-[14px] text-fg placeholder:text-fg-subtle focus:outline-none min-h-[36px] max-h-28 py-2"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="shrink-0 w-9 h-9 rounded-full bg-accent text-accent-fg flex items-center justify-center disabled:opacity-40 transition-opacity"
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </CollapsingHeader>
  )
}
