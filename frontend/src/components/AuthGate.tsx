import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, fetchAuthMe } from '../api/client'

export type AuthContext = {
  authRequired: boolean
  email: string | null
  refresh: () => Promise<void>
}

type GateState =
  | { phase: 'loading' }
  | { phase: 'login'; banner: string | null }
  | { phase: 'error'; status: number }
  | { phase: 'app'; ctx: AuthContext }

function readOAuthErrorBanner(): string | null {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('error')
  if (!code) return null
  window.history.replaceState({}, '', window.location.pathname)
  if (code === 'account_not_allowed') {
    return 'This Google account is not allowed to access Caspi.'
  }
  if (code === 'no_email') {
    return 'Google did not return an email for this account. Try again or use a different account.'
  }
  return 'Sign-in failed. Try again.'
}

export function AuthGate({ children }: { children: (ctx: AuthContext) => ReactNode }) {
  const [state, setState] = useState<GateState>({ phase: 'loading' })

  const refresh = useCallback(async () => {
    const result = await fetchAuthMe()
    if (result.kind === 'error') {
      setState({ phase: 'error', status: result.status })
      return
    }
    if (result.kind === 'unauthorized') {
      setState({ phase: 'login', banner: readOAuthErrorBanner() })
      return
    }
    const { data } = result
    if (!data.auth_required) {
      setState({
        phase: 'app',
        ctx: {
          authRequired: false,
          email: null,
          refresh,
        },
      })
      return
    }
    if (data.email) {
      setState({
        phase: 'app',
        ctx: {
          authRequired: true,
          email: data.email,
          refresh,
        },
      })
      return
    }
    setState({ phase: 'login', banner: readOAuthErrorBanner() })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (state.phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600 text-sm">
        Loading…
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 px-4">
        <p className="text-sm text-gray-700">Could not verify access (HTTP {state.status}).</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Retry
        </button>
      </div>
    )
  }

  if (state.phase === 'login') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Caspi</h1>
        {state.banner ? (
          <p className="text-sm text-red-600 text-center max-w-sm">{state.banner}</p>
        ) : null}
        <a
          href="/api/auth/google"
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
        >
          Continue with Google
        </a>
      </div>
    )
  }

  return <>{children(state.ctx)}</>
}

export async function logoutAndRefresh(ctx: AuthContext): Promise<void> {
  await api.auth.logout()
  await ctx.refresh()
}
