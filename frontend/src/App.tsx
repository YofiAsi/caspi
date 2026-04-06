import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AuthGate, type AuthContext } from './components/AuthGate'
import { CollectionDetailPage } from './pages/CollectionDetailPage'
import { HomePage } from './pages/HomePage'
import { ExpensesPage } from './pages/ExpensesPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function AppRoutes({ auth }: { auth: AuthContext }) {
  return (
    <Routes>
      <Route element={<AppLayout auth={auth} />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/collections/:collectionId" element={<CollectionDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Redirects from old routes */}
        <Route path="/analysis" element={<Navigate to="/analytics" replace />} />
        <Route path="/collections" element={<Navigate to="/analytics" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>{(auth) => <AppRoutes auth={auth} />}</AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
