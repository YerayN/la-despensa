import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [perfil,  setPerfil]  = useState(undefined)  // undefined = todavía cargando
  const [hogar,   setHogar]   = useState(null)
  const [loading, setLoading] = useState(true)

  // Token anti-race: evita que una carga antigua sobreescriba una nueva
  const perfilTokenRef = useRef(null)

  const loadPerfil = useCallback(async (userId) => {
    const token = Symbol()
    perfilTokenRef.current = token

    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*, hogares(*)')
        .eq('id', userId)
        .single()

      // Si ya hay una carga más reciente en curso, ignorar este resultado
      if (perfilTokenRef.current !== token) return null

      if (error || !data) {
        setPerfil(null)
        return null
      }

      setPerfil(data)
      if (data.hogares) setHogar(data.hogares)
      return data
    } catch {
      if (perfilTokenRef.current !== token) return null
      setPerfil(null)
      return null
    }
  }, [])

  const clearAuth = useCallback(() => {
    perfilTokenRef.current = null
    setUser(null)
    setPerfil(null)
    setHogar(null)
  }, [])

  useEffect(() => {
    let mounted = true

    // ── Carga inicial: sesión persistida en el navegador ──────────
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        if (session?.user) {
          setUser(session.user)
          await loadPerfil(session.user.id)
        } else {
          setPerfil(null)
        }
      } catch (e) {
        console.error('Error inicializando auth:', e)
        if (mounted) setPerfil(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    // ── Listener de eventos de sesión ─────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          // Poner loading=true ANTES de cargar el perfil para que AppRoute
          // no evalúe con user=ok + perfil=undefined → /setup-hogar por error
          setLoading(true)
          setUser(session.user)
          await loadPerfil(session.user.id)
          if (mounted) setLoading(false)

        } else if (event === 'SIGNED_OUT') {
          clearAuth()
          setLoading(false)

        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Refresco silencioso — no tocar perfil ni loading
          setUser(session.user)

        } else if (event === 'USER_UPDATED' && session?.user) {
          setUser(session.user)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadPerfil, clearAuth])

  // signOut: limpiar estado local primero para respuesta inmediata en UI
  const signOut = useCallback(async () => {
    clearAuth()
    setLoading(false)
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('Error en signOut:', e)
    }
  }, [clearAuth])

  const value = {
    user,
    perfil,
    hogar,
    loading,
    setPerfil,
    setHogar,
    loadPerfil,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}