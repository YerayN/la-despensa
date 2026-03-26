import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [perfil,  setPerfil]  = useState(undefined)  // undefined = resolviendo
  const [hogar,   setHogar]   = useState(null)
  const [loading, setLoading] = useState(true)

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

      if (perfilTokenRef.current !== token) return null
      if (error || !data) { setPerfil(null); setHogar(null); return null }

      setPerfil(data)
      setHogar(data.hogares ?? null)
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
        console.error('Auth init error:', e)
        if (mounted) setPerfil(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          const esElMismoUsuario = perfil?.id === session.user.id
          if (esElMismoUsuario) {
            // Reactivación tras inactividad — actualizar silenciosamente
            setUser(session.user)
            loadPerfil(session.user.id)
          } else {
            // Login real
            setLoading(true)
            setUser(session.user)
            await loadPerfil(session.user.id)
            if (mounted) setLoading(false)
          }
        } else if (event === 'SIGNED_OUT') {
          clearAuth()
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
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
  }, [loadPerfil, clearAuth, perfil])

  const signOut = useCallback(async () => {
    clearAuth()
    setLoading(false)
    try { await supabase.auth.signOut() } catch (e) { console.error(e) }
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