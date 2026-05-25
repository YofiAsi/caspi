import { useCallback, useState } from 'react'
import { api } from '../api/client'
import type { ChatMessage, PendingAction } from '../types'

export type AgentChatStatus = 'idle' | 'loading' | 'pending' | 'error'

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [status, setStatus] = useState<AgentChatStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const applyResponse = useCallback((resp: Awaited<ReturnType<typeof api.agent.chat>>) => {
    setMessages(resp.messages as ChatMessage[])
    if (resp.status === 'pending_action' && resp.pending_action) {
      setPending(resp.pending_action)
      setStatus('pending')
      setError(null)
    } else if (resp.status === 'error') {
      setPending(null)
      setStatus('error')
      setError(resp.error ?? 'Something went wrong')
    } else {
      setPending(null)
      setStatus('idle')
      setError(null)
    }
  }, [])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
      setMessages(next)
      setStatus('loading')
      setError(null)
      try {
        const resp = await api.agent.chat(next)
        applyResponse(resp)
      } catch (e) {
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Request failed')
      }
    },
    [messages, applyResponse],
  )

  const approve = useCallback(async () => {
    if (!pending) return
    setStatus('loading')
    setError(null)
    try {
      const resp = await api.agent.executeAction(messages, pending.action_id, 'approve')
      applyResponse(resp)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Request failed')
    }
  }, [messages, pending, applyResponse])

  const reject = useCallback(async () => {
    if (!pending) return
    setStatus('loading')
    setError(null)
    try {
      const resp = await api.agent.executeAction(messages, pending.action_id, 'reject')
      applyResponse(resp)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Request failed')
    }
  }, [messages, pending, applyResponse])

  return { messages, pending, status, error, send, approve, reject }
}
