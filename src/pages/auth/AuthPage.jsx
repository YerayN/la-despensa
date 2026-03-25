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

// ─── Página principal ────────────────────────────────────────
export default function AuthPage() {
  const navigate = useNavigate()
  const [tab, setTab]       = useState('login')   // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState('')

  // Login
  const [loginEmail, setLoginEmail]       = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Registro
  const [regNombre,    setRegNombre]    = useState('')
  const [regEmail,     setRegEmail]     = useState('')
  const [regPassword,  setRegPassword]  = useState('')
  const [regConfirm,   setRegConfirm]   = useState('')
  const [regCodigo,    setRegCodigo]    = useState('')

  const reset = () => { setError(''); setSuccess('') }

  // ── HANDLER LOGIN ──
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
      if (err.message.includes('Invalid login')) {
        setError('Email o contraseña incorrectos.')
      } else if (err.message.includes('Email not confirmed')) {
        setError('Confirma tu email antes de entrar. Revisa tu bandeja de entrada.')
      } else {
        setError(err.message)
      }
      return
    }

    // El AuthContext detectará el SIGNED_IN y redirigirá via App.jsx
    navigate('/')
  }

  // ── HANDLER REGISTRO ──
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

    // 1. Crear cuenta en Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email:    regEmail.trim(),
      password: regPassword,
      options: {
        data: {
          nombre:      regNombre.trim(),
          codigo_hogar: regCodigo.trim().toUpperCase() || null,
        },
      },
    })

    if (authErr) {
      setLoading(false)
      if (authErr.message.includes('already registered')) {
        setError('Este email ya tiene una cuenta. Inicia sesión.')
      } else {
        setError(authErr.message)
      }
      return
    }

    // 2. Si el email ya estaba confirmado (caso raro), creamos perfil ya
    //    Si no, el perfil se crea en /setup tras confirmar el email
    if (authData.session) {
      // Email confirmación desactivada en Supabase (raro en dev)
      await crearPerfilInicial(authData.user)
      setLoading(false)
      navigate('/setup-hogar')
      return
    }

    setLoading(false)
    setSuccess('¡Cuenta creada! Revisa tu email y confirma tu cuenta antes de entrar.')
  }

  // ── Crear perfil en base de datos ──
  const crearPerfilInicial = async (user) => {
    const nombre      = user.user_metadata?.nombre      || 'Usuario'
    const codigoHogar = user.user_metadata?.codigo_hogar || null

    await supabase.from('perfiles').insert({
      id:    user.id,
      nombre,
      email: user.email,
      hogar_id: null,  // se asignará en setup-hogar
    })

    // Si viene con código, intentamos asignar hogar directamente
    if (codigoHogar) {
      const { data: hogar } = await supabase
        .from('hogares')
        .select('id')
        .eq('codigo_union', codigoHogar)
        .single()

      if (hogar) {
        await supabase
          .from('perfiles')
          .update({ hogar_id: hogar.id })
          .eq('id', user.id)
      }
    }
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

        body {
          font-family: var(--font-body);
          background: var(--bg);
          color: var(--text);
          min-height: 100dvh;
        }

        .auth-page {
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

        /* ── Logo ── */
        .logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
        }

        .logo-icon {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 20px rgba(45,106,79,0.25);
        }

        .logo h1 {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 700;
          color: var(--brand-dark);
          letter-spacing: -0.5px;
        }

        .logo p {
          font-size: 14px;
          color: var(--text-2);
          margin-top: -6px;
        }

        /* ── Card ── */
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          box-shadow: var(--shadow-lg);
          width: 100%;
          max-width: 420px;
          overflow: hidden;
        }

        /* ── Tabs ── */
        .tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-bottom: 1px solid var(--border);
        }

        .tab-btn {
          padding: 16px;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          color: var(--text-3);
          background: none;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .tab-btn.active {
          color: var(--brand);
          background: rgba(216,243,220,0.3);
        }

        .tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -1px; left: 16px; right: 16px;
          height: 2px;
          background: var(--brand);
          border-radius: 2px 2px 0 0;
        }

        /* ── Form body ── */
        .form-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ── Field ── */
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

        .field-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .field-icon {
          position: absolute;
          left: 13px;
          color: var(--text-3);
          pointer-events: none;
        }

        .field-wrap input {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--text);
          background: var(--surface);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          -webkit-appearance: none;
        }

        .field-wrap input.has-icon {
          padding-left: 38px;
        }

        .field-wrap input:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(45,106,79,0.1);
        }

        .toggle-pw {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-3);
          display: flex;
          padding: 4px;
          border-radius: 4px;
          transition: color 0.15s;
        }

        .toggle-pw:hover { color: var(--text-2); }

        .field-hint {
          font-size: 12px;
          color: var(--text-3);
          line-height: 1.4;
        }

        /* ── Separador opcional ── */
        .optional-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: var(--text-3);
          font-weight: 500;
        }
        .optional-label::before,
        .optional-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        /* ── Alertas ── */
        .alert {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px 14px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          line-height: 1.5;
        }

        .alert.error {
          background: var(--error-bg);
          color: var(--error);
          border: 1px solid rgba(192,57,43,0.15);
        }

        .alert.success {
          background: var(--success-bg);
          color: var(--success);
          border: 1px solid rgba(39,174,96,0.15);
        }

        /* ── Botón principal ── */
        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
          color: white;
          border: none;
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 2px 12px rgba(45,106,79,0.25);
          margin-top: 4px;
          -webkit-tap-highlight-color: transparent;
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.92;
          box-shadow: 0 4px 20px rgba(45,106,79,0.3);
        }

        .btn-primary:active:not(:disabled) {
          transform: scale(0.98);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ── Footer de la card ── */
        .card-footer {
          text-align: center;
          padding: 0 24px 20px;
          font-size: 13px;
          color: var(--text-3);
        }

        .card-footer button {
          background: none;
          border: none;
          color: var(--brand);
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          font-family: var(--font-body);
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        /* ── Responsive refinements ── */
        @media (max-width: 440px) {
          .auth-page { padding: 16px 12px; }
          .form-body { padding: 20px 18px; }
          .card { border-radius: 16px; }
          .logo h1 { font-size: 24px; }
        }
      `}</style>

      <div className="auth-page">
        {/* Logo */}
        <div className="logo">
          <div className="logo-icon">
            <ChefHat size={28} />
          </div>
          <h1>La Despensa</h1>
          <p>Tu cocina organizada</p>
        </div>

        {/* Card */}
        <div className="card">
          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); reset() }}
            >
              Iniciar sesión
            </button>
            <button
              className={`tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => { setTab('register'); reset() }}
            >
              Crear cuenta
            </button>
          </div>

          {/* ── LOGIN ── */}
          {tab === 'login' && (
            <form className="form-body" onSubmit={handleLogin}>
              <Field
                label="Email"
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="tu@email.com"
                icon={Mail}
                required
              />
              <Field
                label="Contraseña"
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                icon={Lock}
                required
              />

              {error && <div className="alert error">{error}</div>}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading
                  ? <><div className="spinner" />Entrando...</>
                  : <>Entrar <ArrowRight size={16} /></>
                }
              </button>
            </form>
          )}

          {/* ── REGISTRO ── */}
          {tab === 'register' && (
            <form className="form-body" onSubmit={handleRegister}>
              <Field
                label="Tu nombre"
                value={regNombre}
                onChange={e => setRegNombre(e.target.value)}
                placeholder="María García"
                icon={User}
                required
              />
              <Field
                label="Email"
                type="email"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                placeholder="tu@email.com"
                icon={Mail}
                required
              />
              <Field
                label="Contraseña"
                type="password"
                value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                icon={Lock}
                required
              />
              <Field
                label="Repite la contraseña"
                type="password"
                value={regConfirm}
                onChange={e => setRegConfirm(e.target.value)}
                placeholder="••••••••"
                icon={Lock}
                required
              />

              <div className="optional-label">Código de hogar (opcional)</div>

              <Field
                label="Código de invitación"
                value={regCodigo}
                onChange={e => setRegCodigo(e.target.value)}
                placeholder="Ej: A1B2C3D4"
                extra="Si tienes un código, te unirás al hogar de alguien. Si no, crearás el tuyo."
              />

              {error   && <div className="alert error">{error}</div>}
              {success && <div className="alert success">{success}</div>}

              {!success && (
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading
                    ? <><div className="spinner" />Creando cuenta...</>
                    : <>Crear cuenta <ArrowRight size={16} /></>
                  }
                </button>
              )}
            </form>
          )}

          {/* Footer */}
          {!success && (
            <div className="card-footer">
              {tab === 'login' ? (
                <>¿No tienes cuenta?{' '}
                  <button onClick={() => { setTab('register'); reset() }}>
                    Regístrate gratis
                  </button>
                </>
              ) : (
                <>¿Ya tienes cuenta?{' '}
                  <button onClick={() => { setTab('login'); reset() }}>
                    Inicia sesión
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
