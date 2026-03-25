import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Home, Users, Minus, Plus, ArrowRight, ChefHat } from 'lucide-react'

export default function SetupHogarPage() {
  const navigate = useNavigate()
  const { user, perfil, setHogar, loadPerfil } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [nombre, setNombre]   = useState('')
  const [comensales, setComensales] = useState(2)

  // Si ya tiene hogar, redirigir
  useEffect(() => {
    if (perfil?.hogar_id) navigate('/', { replace: true })
  }, [perfil, navigate])

  // Si no tiene perfil aún (viene de confirmar email), crearlo
  useEffect(() => {
    const ensurePerfil = async () => {
      if (!user) return
      if (perfil) return // ya existe

      const nombre = user.user_metadata?.nombre || 'Usuario'
      const codigoHogar = user.user_metadata?.codigo_hogar || null

      const { error } = await supabase.from('perfiles').upsert({
        id:    user.id,
        nombre,
        email: user.email,
        hogar_id: null,
      }, { onConflict: 'id' })

      if (error) console.error('Error creando perfil:', error)

      // Si tiene código, intentar unirse directamente
      if (codigoHogar) {
        const { data: hogar } = await supabase
          .from('hogares')
          .select('*')
          .eq('codigo_union', codigoHogar)
          .single()

        if (hogar) {
          await supabase
            .from('perfiles')
            .update({ hogar_id: hogar.id })
            .eq('id', user.id)

          await loadPerfil(user.id)
          navigate('/', { replace: true })
          return
        }
      }

      await loadPerfil(user.id)
    }

    ensurePerfil()
  }, [user, perfil, navigate, loadPerfil])

  const handleCrear = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // 1. Crear hogar
    const { data: hogar, error: errHogar } = await supabase
      .from('hogares')
      .insert({ nombre: nombre.trim(), num_comensales: comensales })
      .select()
      .single()

    if (errHogar) {
      setError('No se pudo crear el hogar. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    // 2. Asignar al perfil
    const { error: errPerfil } = await supabase
      .from('perfiles')
      .update({ hogar_id: hogar.id })
      .eq('id', user.id)

    if (errPerfil) {
      setError('Error al actualizar tu perfil.')
      setLoading(false)
      return
    }

    setHogar(hogar)
    await loadPerfil(user.id)
    navigate('/', { replace: true })
  }

  const userName = perfil?.nombre || user?.user_metadata?.nombre || 'tú'

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --brand:       #2D6A4F;
          --brand-light: #40916C;
          --brand-dark:  #1B4332;
          --brand-pale:  #D8F3DC;
          --bg:          #F8FAF8;
          --surface:     #FFFFFF;
          --border:      #E2EBE4;
          --text:        #1A2E22;
          --text-2:      #5A7366;
          --text-3:      #8FA89A;
          --error:       #C0392B;
          --error-bg:    #FDF2F0;
          --font-display: 'Fraunces', Georgia, serif;
          --font-body:    'DM Sans', system-ui, sans-serif;
          --shadow-lg:    0 8px 40px rgba(45,106,79,0.12);
        }

        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700&family=DM+Sans:wght@400;500;600&display=swap');

        body { font-family: var(--font-body); background: var(--bg); color: var(--text); }

        .setup-page {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          background:
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(64,145,108,0.12) 0%, transparent 70%),
            var(--bg);
        }

        .logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
        }

        .logo-icon {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #2D6A4F 0%, #40916C 100%);
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          color: white;
          box-shadow: 0 4px 20px rgba(45,106,79,0.25);
        }

        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          box-shadow: var(--shadow-lg);
          width: 100%;
          max-width: 420px;
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .card-header h2 {
          font-family: var(--font-display);
          font-size: 22px;
          color: var(--text);
          margin-bottom: 4px;
        }
        .card-header p { font-size: 14px; color: var(--text-2); line-height: 1.5; }

        .icon-badge {
          width: 48px; height: 48px;
          border-radius: 14px;
          background: var(--brand-pale);
          display: flex; align-items: center; justify-content: center;
          color: var(--brand);
          margin-bottom: 12px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-2);
        }

        .field input {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid var(--border);
          border-radius: 8px;
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--text);
          background: var(--surface);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          -webkit-appearance: none;
        }
        .field input:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(45,106,79,0.1);
        }

        .counter {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 2px;
        }

        .counter-btn {
          width: 40px; height: 40px;
          border-radius: 10px;
          border: 1.5px solid var(--border);
          background: var(--surface);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: var(--text-2);
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
        }

        .counter-btn:hover:not(:disabled) {
          border-color: var(--brand);
          color: var(--brand);
          background: var(--brand-pale);
        }
        .counter-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .counter-value {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 700;
          color: var(--brand);
          min-width: 40px;
          text-align: center;
        }

        .counter-label {
          font-size: 13px;
          color: var(--text-3);
        }

        .alert {
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 13px;
          background: var(--error-bg);
          color: var(--error);
          border: 1px solid rgba(192,57,43,0.15);
        }

        .btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          box-shadow: 0 2px 12px rgba(45,106,79,0.25);
          -webkit-tap-highlight-color: transparent;
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.92; }
        .btn-primary:active:not(:disabled) { transform: scale(0.98); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .spinner {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 440px) {
          .card { padding: 24px 18px; border-radius: 16px; }
        }
      `}</style>

      <div className="setup-page">
        <div className="logo">
          <div className="logo-icon">
            <ChefHat size={28} />
          </div>
        </div>

        <div className="card">
          <form onSubmit={handleCrear}>
            <div className="card-header" style={{ marginBottom: 24 }}>
              <div className="icon-badge">
                <Home size={22} />
              </div>
              <h2>Crea tu hogar</h2>
              <p>
                Hola <strong>{userName}</strong>, ponle nombre a tu hogar y dinos cuántos coméis.
                Podrás cambiarlo cuando quieras.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="field">
                <label>Nombre del hogar</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Casa García, El Pisito..."
                  required
                />
              </div>

              <div className="field">
                <label>¿Cuántos coméis normalmente?</label>
                <div className="counter">
                  <button
                    type="button"
                    className="counter-btn"
                    onClick={() => setComensales(c => Math.max(1, c - 1))}
                    disabled={comensales <= 1}
                  >
                    <Minus size={16} />
                  </button>
                  <div>
                    <div className="counter-value">{comensales}</div>
                  </div>
                  <button
                    type="button"
                    className="counter-btn"
                    onClick={() => setComensales(c => c + 1)}
                    disabled={comensales >= 20}
                  >
                    <Plus size={16} />
                  </button>
                  <span className="counter-label">
                    {comensales === 1 ? 'persona' : 'personas'}
                  </span>
                </div>
              </div>

              {error && <div className="alert">{error}</div>}

              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !nombre.trim()}
              >
                {loading
                  ? <><div className="spinner" />Creando...</>
                  : <>Crear hogar <ArrowRight size={16} /></>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
