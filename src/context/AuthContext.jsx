import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [perfil,  setPerfil]  = useState(undefined)   // undefined = aún no sabemos
  const [hogar,   setHogar]   = useState(null)
  const [loading, setLoading] = useState(true)

  const loadPerfil = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*, hogares(*)')
        .eq('id', userId)
        .single()

      if (error || !data) {
        setPerfil(null)
        return null
      }

      setPerfil(data)
      if (data.hogares) setHogar(data.hogares)
      return data
    } catch {
      setPerfil(null)
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await loadPerfil(session.user.id)
          setLoading(false)
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
  }, [loadPerfil, clearAuth])

  // signOut robusto: limpia estado local inmediatamente y luego llama a Supabase
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