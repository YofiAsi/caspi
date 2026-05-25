import type { ChatMessage } from '../../types'

interface Props {
  message: ChatMessage
}

function isThinkingOnlyContent(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return false
  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>
    if (typeof data.thinking === 'string' && Object.keys(data).length === 1) return true
    if (typeof data.thinking === 'string' && !data.content) return true
  } catch {
    return false
  }
  return false
}

function compactToolLabel(content: string): string | null {
  try {
    const data = JSON.parse(content) as Record<string, unknown>
    if (data.error) return `Lookup failed: ${String(data.error)}`
    if (Array.isArray(data.tags)) return 'Looked up tags'
    if (data.collections) return 'Looked up collections'
    if (data.merchants) return 'Looked up merchants'
    if (data.items) return 'Looked up payments'
    if (data.payment_count !== undefined && data.by_tag !== undefined) return 'Summarized spending'
    if (data.rows) return 'Loaded spending over time'
    if (data.rule !== undefined) return 'Checked Splitwise rule'
    if (data.groups) return 'Listed Splitwise groups'
    return 'Looked up data'
  } catch {
    return null
  }
}

export function ChatMessageBubble({ message }: Props) {
  if (message.role === 'system') return null

  if (message.role === 'tool') {
    const label = message.content ? compactToolLabel(message.content) : null
    if (!label) return null
    return (
      <div className="flex justify-center px-4 py-1" data-tool-hint={label}>
        <span className="text-[11px] text-fg-subtle italic">{label}</span>
      </div>
    )
  }

  if (message.role === 'assistant' && !message.content && message.tool_calls?.length) {
    return null
  }

  const isUser = message.role === 'user'
  const text = message.content ?? ''

  if (!isUser && isThinkingOnlyContent(text)) {
    return null
  }

  if (!isUser && !text.trim()) {
    return null
  }

  return (
    <div className={`flex px-4 py-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
          isUser
            ? 'bg-accent text-accent-fg rounded-br-md'
            : 'bg-surface text-fg rounded-bl-md'
        }`}
        style={!isUser ? { border: '0.5px solid rgba(255,255,255,0.06)' } : undefined}
      >
        {text}
      </div>
    </div>
  )
}
