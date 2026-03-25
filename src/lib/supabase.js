import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
    // Fix: evita el error de lock en móvil cuando hay múltiples pestañas
    // o cuando el navegador móvil libera el lock prematuramente
    lock: async (name, acquireTimeout, fn) => {
      // Implementación sin Web Locks API — funciona en todos los navegadores
      return fn()
    },
  },
})