import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import AuthPage       from './pages/auth/AuthPage'
import SetupHogarPage from './pages/auth/SetupHogarPage'
import Layout         from './components/layout/Layout'
import DashboardPage  from './pages/DashboardPage'
import RecetasPage    from './pages/RecetasPage'
import RecetaDetalle  from './pages/RecetaDetalle'
import RecetaForm     from './pages/RecetaForm'
import PlanningPage   from './pages/PlanningPage'
import ListaPage      from './pages/ListaPage'
import ComunidadPage  from './pages/ComunidadPage'
import AjustesPage    from './pages/AjustesPage'

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#F6F8F6', fontFamily: "'DM Sans', sans-serif",
    }}>
      <img src="/logo.png" alt="Cargando..." style={{
        width: 60, height: 60,
        objectFit: 'contain',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(.96)}}`}</style>
    </div>
  )
}

// Solo usuarios SIN sesión (login/registro)
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/" replace />
  return children
}

// Cualquier usuario CON sesión, sin importar si tiene hogar o no
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/auth" replace />
  return children
}

// Sesión + perfil cargado + hogar configurado
function AppRoute({ children }) {
  const { user, perfil, loading } = useAuth()
  if (loading || perfil === undefined) return <LoadingScreen />
  if (!user) return <Navigate to="/auth" replace />
  if (!perfil?.hogar_id) return <Navigate to="/setup-hogar" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={
        <PublicOnlyRoute><AuthPage /></PublicOnlyRoute>
      } />

      <Route path="/setup-hogar" element={
        <PrivateRoute><SetupHogarPage /></PrivateRoute>
      } />

      <Route path="/" element={<AppRoute><Layout /></AppRoute>}>
        <Route index                     element={<DashboardPage />} />
        <Route path="recetas"            element={<RecetasPage />} />
        <Route path="recetas/nueva"      element={<RecetaForm />} />
        <Route path="recetas/:id"        element={<RecetaDetalle />} />
        <Route path="recetas/:id/editar" element={<RecetaForm />} />
        <Route path="planning"           element={<PlanningPage />} />
        <Route path="lista"              element={<ListaPage />} />
        <Route path="comunidad"          element={<ComunidadPage />} />
        <Route path="ajustes"            element={<AjustesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}