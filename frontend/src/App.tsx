import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/layout/RequireAuth'
import TabLayout from './components/layout/TabLayout'

import AuthScreen from './screens/AuthScreen'
import HomeScreen from './screens/HomeScreen'
import ExpensesScreen from './screens/ExpensesScreen'
import AnalyticsScreen from './screens/AnalyticsScreen'
import CollectionDetailScreen from './screens/CollectionDetailScreen'
import SettingsScreen from './screens/SettingsScreen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

const router = createBrowserRouter([
  { path: '/auth/login', element: <AuthScreen /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <TabLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomeScreen /> },
      { path: 'expenses', element: <ExpensesScreen /> },
      { path: 'analytics', element: <AnalyticsScreen /> },
      { path: 'analytics/collections/:id', element: <CollectionDetailScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
  { path: '*', element: <Navigate to="/home" replace /> },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
