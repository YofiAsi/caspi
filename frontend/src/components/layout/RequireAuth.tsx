import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import FullScreenSpinner from '../shared/FullScreenSpinner'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullScreenSpinner />
  if (!user) return <Navigate to="/auth/login" replace />
  return <>{children}</>
}
