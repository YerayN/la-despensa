import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, ChefHat } from 'lucide-react'

// ─── Subcomponente: campo de texto ───────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, icon: Icon, required, extra }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const inputType  = isPassword && show ? 'text' : type

  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-wrap">
        {Icon && <Icon size={16} className="field-icon" />}
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={Icon ? 'has-icon' : ''}
        />
        {isPassword && (
          <button type="button" className="toggle-pw" onClick={() => setShow(s => !s)}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {extra && <p className="field-hint">{extra}</p>}
    </div>
  )
}

// ─── Traduce errores de Supabase Auth a mensajes amigables ───
function traducirError(msg = '') {
  if (msg.includes('Invalid login') || msg.includes('invalid_credentials'))
    return 'Email o contraseña incorrectos.'
  if (msg.includes('Email not confirmed'))
    return 'Confirma tu email antes de entrar. Revisa tu bandeja de entrada.'
  if (msg.includes('already registered') || msg.includes('User already registered'))
    return 'Este email ya tiene una cuenta. Inicia sesión.'
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('email rate limit'))
    return 'Demasiados intentos de registro seguidos. Supabase limita los emails en el plan gratuito. Espera unos minutos e inténtalo de nuevo, o usa un email diferente.'
  if (msg.includes('over_email_send_rate_limit'))
    return 'Límite de emails alcanzado. Espera unos minutos antes de volver a registrarte.'
  if (msg.includes('Password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.'
  if (msg.includes('Unable to validate email address'))
    return 'El formato del email no es válido.'
  return msg
}

// ─── Página principal ────────────────────────────────────────
export default function AuthPage() {
  const navigate = useNavigate()
  const [tab, setTab]         = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  // Login
  const [loginEmail,    setLoginEmail]    = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Registro
  const [regNombre,   setRegNombre]   = useState('')
  const [regEmail,    setRegEmail]    = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm,  setRegConfirm]  = useState('')

  const reset = () => { setError(''); setSuccess('') }

  // ── HANDLER LOGIN ──────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    reset()
    setLoading(true)

    const { error: err } = await supabase.auth.signInWithPassword({
      email:    loginEmail.trim(),
      password: loginPassword,
    })

    setLoading(false)

    if (err) {
      setError(traducirError(err.message))
      return
    }

    navigate('/')
  }

  // ── HANDLER REGISTRO ───────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault()
    reset()

    if (regPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (regPassword !== regConfirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email:    regEmail.trim(),
      password: regPassword,
      options: {
        data: {
          nombre: regNombre.trim(),
        },
      },
    })

    if (authErr) {
      setLoading(false)
      setError(traducirError(authErr.message || String(authErr.status)))
      return
    }

    // Confirmación de email desactivada en Supabase (desarrollo)
    if (authData.session) {
      await crearPerfilInicial(authData.user)
      setLoading(false)
      navigate('/setup-hogar')
      return
    }

    setLoading(false)
    setSuccess('¡Cuenta creada! Revisa tu email y confirma tu cuenta antes de entrar.')
  }

  // ── Crear perfil en base de datos ─────────────────────────
  const crearPerfilInicial = async (user) => {
    const nombre = user.user_metadata?.nombre || 'Usuario'

    await supabase.from('perfiles').upsert({
      id:    user.id,
      nombre,
      email: user.email,
      hogar_id: null,
    }, { onConflict: 'id' })
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --brand:       #2D6A4F;
          --brand-light: #40916C;
          --brand-dark:  #1B4332;
          --brand-pale:  #D8F3DC;
          --accent:      #F4845F;
          --bg:          #F8FAF8;
          --surface:     #FFFFFF;
          --border:      #E2EBE4;
          --text:        #1A2E22;
          --text-2:      #5A7366;
          --text-3:      #8FA89A;
          --error:       #C0392B;
          --error-bg:    #FDF2F0;
          --success:     #27AE60;
          --success-bg:  #F0FBF4;
          --radius:      14px;
          --radius-sm:   8px;
          --font-display: 'Fraunces', Georgia, serif;
          --font-body:    'DM Sans', system-ui, sans-serif;
          --shadow:       0 2px 16px rgba(45,106,79,0.08);
          --shadow-lg:    0 8px 40px rgba(45,106,79,0.12);
        }

        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@400;500;600&display=swap');

        body { font-family: var(--font-body); background: var(--bg); color: var(--text); min-height: 100dvh; }

        .auth-page {
          min-height: 100dvh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 24px 16px;
          background:
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(64,145,108,0.12) 0%, transparent 70%),
            var(--bg);
        }

        .logo { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 32px; }
        .logo-icon {
          width: 60px; height: 60px; border-radius: 18px;
          background: linear-gradient(135deg, #2D6A4F, #40916C);
          display: flex; align-items: center; justify-content: center; color: white;
          box-shadow: 0 4px 20px rgba(45,106,79,0.25);
        }
        .logo-name { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--text); }
        .logo-tagline { font-size: 13px; color: var(--text-3); }

        .card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 20px; padding: 32px 28px;
          box-shadow: var(--shadow-lg); width: 100%; max-width: 400px;
        }

        .tabs { display: flex; gap: 4px; background: #F0F4F1; border-radius: 10px; padding: 4px; margin-bottom: 28px; }
        .tab-btn {
          flex: 1; padding: 9px; border: none; border-radius: 7px;
          font-family: var(--font-body); font-size: 13px; font-weight: 600;
          color: var(--text-3); background: transparent; cursor: pointer;
          transition: all 0.15s;
        }
        .tab-btn.active { background: white; color: var(--brand); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }

        .form-body { display: flex; flex-direction: column; gap: 14px; }

        .field { display: flex; flex-direction: column; gap: 6px; }
        .field label { font-size: 13px; font-weight: 600; color: var(--text-2); }
        .field-wrap { position: relative; }
        .field-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .field input {
          width: 100%; padding: 12px 13px 12px 38px;
          border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          font-family: var(--font-body); font-size: 14px; color: var(--text);
          outline: none; transition: border-color 0.15s, box-shadow 0.15s;
          -webkit-appearance: none; background: white;
        }
        .field input:not(.has-icon) { padding-left: 13px; }
        .field input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(45,106,79,0.1); }
        .field-hint { font-size: 12px; color: var(--text-3); line-height: 1.4; }

        .toggle-pw {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: var(--text-3); padding: 4px;
        }

        .alert {
          border-radius: var(--radius-sm); padding: 10px 14px;
          font-size: 13px; line-height: 1.5;
        }
        .alert.error   { background: var(--error-bg);   color: var(--error);   border: 1px solid #F5C6C0; }
        .alert.success { background: var(--success-bg); color: var(--success); border: 1px solid #A8DFC0; }

        .btn-primary {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
          color: white; border: none; border-radius: var(--radius-sm);
          font-family: var(--font-body); font-size: 15px; font-weight: 600;
          cursor: pointer; transition: opacity 0.15s, transform 0.1s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 12px rgba(45,106,79,0.25);
          -webkit-tap-highlight-color: transparent;
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.92; }
        .btn-primary:active:not(:disabled) { transform: scale(0.98); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .card-footer { margin-top: 20px; text-align: center; font-size: 13px; color: var(--text-3); }
        .card-footer button {
          background: none; border: none; cursor: pointer;
          color: var(--brand); font-family: var(--font-body); font-size: 13px; font-weight: 600;
        }

        .spinner {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,0.4); border-top-color: white;
          border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 440px) {
          .card { padding: 24px 18px; border-radius: 16px; }
        }
      `}</style>

      <div className="auth-page">
        <div className="logo">
          <div className="logo-icon"><ChefHat size={28} /></div>
          <div className="logo-name">La Despensa</div>
          <div className="logo-tagline">Planifica, cocina, comparte</div>
        </div>

        <div className="card">
          <div className="tabs">
            <button className={`tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); reset() }}>
              Iniciar sesión
            </button>
            <button className={`tab-btn ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); reset() }}>
              Crear cuenta
            </button>
          </div>

          {/* ── LOGIN ── */}
          {tab === 'login' && (
            <form className="form-body" onSubmit={handleLogin}>
              <Field label="Email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="tu@email.com" icon={Mail} required />
              <Field label="Contraseña" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" icon={Lock} required />
              {error && <div className="alert error">{error}</div>}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <><div className="spinner" />Entrando...</> : <>Entrar <ArrowRight size={16} /></>}
              </button>
            </form>
          )}

          {/* ── REGISTRO ── */}
          {tab === 'register' && (
            <form className="form-body" onSubmit={handleRegister}>
              <Field label="Tu nombre" value={regNombre} onChange={e => setRegNombre(e.target.value)} placeholder="María García" icon={User} required />
              <Field label="Email" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="tu@email.com" icon={Mail} required />
              <Field label="Contraseña" type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Mínimo 6 caracteres" icon={Lock} required />
              <Field label="Repite la contraseña" type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} placeholder="••••••••" icon={Lock} required />

              {error   && <div className="alert error">{error}</div>}
              {success && <div className="alert success">{success}</div>}

              {!success && (
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <><div className="spinner" />Creando cuenta...</> : <>Crear cuenta <ArrowRight size={16} /></>}
                </button>
              )}
            </form>
          )}

          {!success && (
            <div className="card-footer">
              {tab === 'login' ? (
                <>¿No tienes cuenta?{' '}
                  <button onClick={() => { setTab('register'); reset() }}>Regístrate gratis</button>
                </>
              ) : (
                <>¿Ya tienes cuenta?{' '}
                  <button onClick={() => { setTab('login'); reset() }}>Inicia sesión</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}