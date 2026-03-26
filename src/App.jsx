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

// 🟢 IMPORTANTE: Asegúrate de que estas importaciones están presentes
import ConsultaPage         from './pages/ConsultaPage'
import PlanningPacientePage from './pages/PlanningPacientePage'

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#F6F8F6', fontFamily: "'DM Sans', sans-serif",
    }}>
      <img src="/logo.png" alt="Cargando..." style={{
        width: 60, height: 60, objectFit: 'contain',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(.96)}}`}</style>
    </div>
  )
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/" replace />
  return children
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function AppRoute({ children }) {
  const { user, perfil, loading } = useAuth()
  if (loading || perfil === undefined) return <LoadingScreen />
  if (!user) return <Navigate to="/auth" replace />
  if (!perfil?.hogar_id) return <Navigate to="/setup-hogar" replace />
  return children
}

function NutricionistaRoute({ children }) {
  const { user, perfil, loading } = useAuth()
  if (loading || perfil === undefined) return <LoadingScreen />
  if (!user) return <Navigate to="/auth" replace />
  if (!perfil?.hogar_id) return <Navigate to="/setup-hogar" replace />
  if (!perfil?.es_nutricionista) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<PublicOnlyRoute><AuthPage /></PublicOnlyRoute>} />
      <Route path="/setup-hogar" element={<PrivateRoute><SetupHogarPage /></PrivateRoute>} />

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
        
        {/* 🟢 ZONA CONSULTA: Rutas corregidas 🟢 */}
        <Route path="consulta" element={<NutricionistaRoute><ConsultaPage /></NutricionistaRoute>} />
        <Route path="consulta/paciente/:id" element={<NutricionistaRoute><PlanningPacientePage /></NutricionistaRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}