import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(undefined)
  const [hogar, setHogar] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadPerfil = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*, hogares(*)')
        .eq('id', userId)
        .single()

      if (error) {
        console.error("Error al cargar perfil:", error)
        // Si hay un error de red, evitamos borrar el perfil si ya lo teníamos
        setPerfil(prev => prev !== undefined ? prev : null)
        return null
      }

      if (!data) {
        setPerfil(null)
        setHogar(null)
        return null
      }

      setPerfil(data)
      setHogar(data.hogares ?? null)
      return data
    } catch (e) {
      console.error("Excepción en loadPerfil:", e)
      setPerfil(prev => prev !== undefined ? prev : null)
      return null
    }
  }, [])

  const clearAuth = useCallback(() => {
    setUser(null)
    setPerfil(null)
    setHogar(null)
  }, [])

  useEffect(() => {
    let mounted = true

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (!mounted) return

        if (error) throw error

        if (session?.user) {
          setUser(session.user)
          await loadPerfil(session.user.id)
        } else {
          clearAuth()
        }
      } catch (e) {
        console.error('Error inicializando sesión:', e)
        if (mounted) clearAuth()
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          // IMPORTANTE: Aquí estaba el error. Ya no bloqueamos la app con setLoading(true).
          // La carga se hace de fondo de manera invisible.
          await loadPerfil(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          clearAuth()
        } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) setUser(session.user)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadPerfil, clearAuth])

  const signOut = useCallback(async () => {
    setLoading(true)
    try { 
      await supabase.auth.signOut() 
    } catch (e) { 
      console.error(e) 
    } finally {
      clearAuth()
      setLoading(false)
    }
  }, [clearAuth])

  return (
    <AuthContext.Provider value={{ user, perfil, hogar, loading, setPerfil, setHogar, loadPerfil, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}