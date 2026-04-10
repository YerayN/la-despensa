import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(undefined)
  const [hogar, setHogar] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadPerfil = useCallback(async (userId) => {
    let intentos = 3; // Le damos 3 oportunidades para despertar
    
    while (intentos > 0) {
      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('*, hogares(*)')
          .eq('id', userId)
          .single()

        if (error) {
          // Si el usuario realmente no existe
          if (error.code === 'PGRST116') {
            setPerfil(null)
            setHogar(null)
            return null
          }
          // Si es otro error (ej. base de datos dormida), forzamos a que salte al catch
          throw error; 
        }

        if (!data) {
          setPerfil(null)
          setHogar(null)
          return null
        }

        // ¡Despertó y todo fue bien!
        setPerfil(data)
        setHogar(data.hogares ?? null)
        return data

      } catch (e) {
        console.error(`Intento fallido. Quedan ${intentos - 1} intentos...`, e)
        intentos--; // Restamos un intento
        
        if (intentos === 0) {
          // Si después de 3 intentos no va, avisamos y salimos para que no cargue infinito
          alert("El servidor está tardando mucho en responder. Por favor, recarga la página.");
          setPerfil(null); 
          return null;
        }
        
        // Esperamos 2 segundos antes de volver a intentar
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
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