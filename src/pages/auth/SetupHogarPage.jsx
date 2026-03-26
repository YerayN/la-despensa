import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Minus, Plus, ArrowRight, ChefHat } from 'lucide-react'

export default function SetupHogarPage() {
  const navigate = useNavigate()
  const { user, perfil, setHogar, loadPerfil } = useAuth()

  const [modo,       setModo]       = useState(null)   // null | 'crear' | 'unirse'
  const [loading,    setLoading]    = useState(false)
  const [iniciando,  setIniciando]  = useState(true)   // gestiona creación de perfil si falta
  const [error,      setError]      = useState('')

  // Crear hogar
  const [nombre,     setNombre]     = useState('')
  const [comensales, setComensales] = useState(2)

  // Unirse con código
  const [codigo, setCodigo] = useState('')

  // ── Si ya tiene hogar, salir inmediatamente ───────────────
  useEffect(() => {
    if (perfil?.hogar_id) {
      navigate('/', { replace: true })
    }
  }, [perfil, navigate])

  // ── Asegurar que el perfil existe en la BD ────────────────
  // Esto solo corre una vez: cuando el user está disponible pero
  // perfil aún no existe (usuario recién confirmado por email).
  useEffect(() => {
    if (!user) return

    const init = async () => {
      setIniciando(true)

      // Intentar leer el perfil directamente de Supabase (no confiar en el contexto
      // porque puede estar en undefined durante la transición)
      const { data: perfilExistente } = await supabase
        .from('perfiles')
        .select('id, hogar_id')
        .eq('id', user.id)
        .single()

      if (perfilExistente?.hogar_id) {
        // Ya tiene hogar — recargar contexto y salir
        await loadPerfil(user.id)
        navigate('/', { replace: true })
        return
      }

      if (!perfilExistente) {
        // Perfil no existe aún (primer acceso tras confirmar email)
        const nombre = user.user_metadata?.nombre || 'Usuario'
        await supabase.from('perfiles').upsert({
          id:       user.id,
          nombre,
          email:    user.email,
          hogar_id: null,
        }, { onConflict: 'id' })
        await loadPerfil(user.id)
      }

      // Código de invitación guardado en metadata durante el registro
      const codigoMeta = user.user_metadata?.codigo_hogar?.trim().toUpperCase()
      if (codigoMeta) {
        const { data: hogarEncontrado } = await supabase
          .from('hogares')
          .select('*')
          .eq('codigo_union', codigoMeta)
          .single()

        if (hogarEncontrado) {
          await supabase.from('perfiles').update({ hogar_id: hogarEncontrado.id }).eq('id', user.id)
          await supabase.auth.updateUser({ data: { codigo_hogar: null } })
          await loadPerfil(user.id)
          navigate('/', { replace: true })
          return
        }
        // Código no encontrado — pre-rellenar campo
        setCodigo(codigoMeta)
        setModo('unirse')
      }

      setIniciando(false)
    }

    init()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Crear hogar ───────────────────────────────────────────
  const handleCrear = async (e) => {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) { setError('Escribe un nombre para el hogar.'); return }
    setLoading(true)

    const { data: hogar, error: errH } = await supabase
      .from('hogares')
      .insert({ nombre: nombre.trim(), num_comensales: comensales })
      .select().single()

    if (errH) { setError('No se pudo crear el hogar. Inténtalo de nuevo.'); setLoading(false); return }

    const { error: errP } = await supabase
      .from('perfiles').update({ hogar_id: hogar.id }).eq('id', user.id)

    if (errP) { setError('Error al actualizar tu perfil.'); setLoading(false); return }

    setHogar(hogar)
    await loadPerfil(user.id)
    navigate('/', { replace: true })
  }

  // ── Unirse con código ─────────────────────────────────────
  const handleUnirse = async (e) => {
    e.preventDefault()
    setError('')
    const cod = codigo.trim().toUpperCase()
    if (!cod) { setError('Introduce el código de invitación.'); return }
    setLoading(true)

    const { data: hogar, error: errB } = await supabase
      .from('hogares').select('*').eq('codigo_union', cod).single()

    if (errB || !hogar) {
      setError('Código no encontrado. Comprueba que lo has escrito bien.')
      setLoading(false); return
    }

    const { error: errP } = await supabase
      .from('perfiles').update({ hogar_id: hogar.id }).eq('id', user.id)

    if (errP) { setError('Error al unirte al hogar.'); setLoading(false); return }

    setHogar(hogar)
    await loadPerfil(user.id)
    navigate('/', { replace: true })
  }

  const userName = perfil?.nombre || user?.user_metadata?.nombre || ''

  // Pantalla de carga mientras inicializamos
  if (iniciando) {
    return (
      <div style={{
        minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'#F8FAF8',
      }}>
        <div style={{
          width:52, height:52, background:'linear-gradient(135deg,#2D6A4F,#40916C)',
          borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:26, animation:'pulse 1.5s ease-in-out infinite',
        }}>🥘</div>
        <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(.96)}}`}</style>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --brand:#2D6A4F;--brand-light:#40916C;--brand-pale:#D8F3DC;
          --bg:#F8FAF8;--surface:#fff;--border:#E2EBE4;
          --text:#1A2E22;--text-2:#5A7366;--text-3:#8FA89A;
          --error:#C0392B;--error-bg:#FDF2F0;
          --font-display:'Fraunces',Georgia,serif;
          --font-body:'DM Sans',system-ui,sans-serif;
        }
        body{font-family:var(--font-body);background:var(--bg);color:var(--text);}
        .page{min-height:100dvh;display:flex;flex-direction:column;align-items:center;
          justify-content:center;padding:24px 16px;
          background:radial-gradient(ellipse 80% 50% at 50% -20%,rgba(64,145,108,.12) 0%,transparent 70%),var(--bg);}
        .logo{display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:32px;}
        .logo-icon{width:60px;height:60px;border-radius:18px;
          background:linear-gradient(135deg,#2D6A4F,#40916C);
          display:flex;align-items:center;justify-content:center;color:white;
          box-shadow:0 4px 20px rgba(45,106,79,.25);}
        .logo-name{font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--text);}
        .card{background:var(--surface);border:1px solid var(--border);border-radius:20px;
          padding:32px 28px;box-shadow:0 8px 40px rgba(45,106,79,.12);width:100%;max-width:420px;}
        .card-header{text-align:center;margin-bottom:28px;}
        h2{font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--text);margin-bottom:8px;}
        p{font-size:14px;color:var(--text-2);line-height:1.5;}
        .modo-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;}
        .modo-btn{display:flex;flex-direction:column;align-items:center;gap:8px;
          padding:18px 12px;border:2px solid var(--border);border-radius:14px;
          background:var(--surface);cursor:pointer;transition:all .15s;
          font-family:var(--font-body);color:var(--text-2);}
        .modo-btn:hover,.modo-btn.active{border-color:var(--brand);background:var(--brand-pale);color:var(--brand);}
        .modo-icon{font-size:28px;}
        .modo-label{font-size:13px;font-weight:600;}
        .form{display:flex;flex-direction:column;gap:16px;margin-top:24px;}
        .field{display:flex;flex-direction:column;gap:6px;}
        .field label{font-size:13px;font-weight:600;color:var(--text-2);}
        .field input{width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;
          font-family:var(--font-body);font-size:15px;color:var(--text);outline:none;
          transition:border-color .15s,box-shadow .15s;-webkit-appearance:none;}
        .field input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(45,106,79,.1);}
        .hint{font-size:12px;color:var(--text-3);margin-top:3px;}
        .counter{display:flex;align-items:center;gap:16px;}
        .cnt-btn{width:36px;height:36px;border-radius:10px;border:1.5px solid var(--border);
          background:var(--surface);display:flex;align-items:center;justify-content:center;
          cursor:pointer;color:var(--text);transition:all .15s;}
        .cnt-btn:hover:not(:disabled){border-color:var(--brand);color:var(--brand);}
        .cnt-btn:disabled{opacity:.4;cursor:not-allowed;}
        .cnt-n{font-size:22px;font-weight:600;min-width:32px;text-align:center;}
        .alert{background:var(--error-bg);border:1px solid #F5C6C0;border-radius:10px;
          padding:10px 14px;font-size:13px;color:var(--error);line-height:1.4;}
        .btn{width:100%;padding:14px;
          background:linear-gradient(135deg,var(--brand) 0%,var(--brand-light) 100%);
          color:white;border:none;border-radius:10px;font-family:var(--font-body);
          font-size:15px;font-weight:600;cursor:pointer;transition:opacity .15s,transform .1s;
          display:flex;align-items:center;justify-content:center;gap:8px;
          box-shadow:0 2px 12px rgba(45,106,79,.25);-webkit-tap-highlight-color:transparent;}
        .btn:hover:not(:disabled){opacity:.92;}
        .btn:active:not(:disabled){transform:scale(.98);}
        .btn:disabled{opacity:.6;cursor:not-allowed;}
        .spinner{width:18px;height:18px;border:2.5px solid rgba(255,255,255,.4);
          border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:440px){.card{padding:24px 18px;border-radius:16px;}}
      `}</style>

      <div className="page">
        <div className="logo">
          <div className="logo-icon"><ChefHat size={28} /></div>
          <div className="logo-name">La Despensa</div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>¡Hola{userName ? `, ${userName.split(' ')[0]}` : ''}! 👋</h2>
            <p>Crea tu hogar o únete al de alguien con su código de invitación.</p>
          </div>

          <div className="modo-grid">
            <button type="button" className={`modo-btn${modo==='crear'?' active':''}`}
              onClick={() => { setModo('crear'); setError('') }}>
              <span className="modo-icon">🏠</span>
              <span className="modo-label">Crear hogar</span>
            </button>
            <button type="button" className={`modo-btn${modo==='unirse'?' active':''}`}
              onClick={() => { setModo('unirse'); setError('') }}>
              <span className="modo-icon">🔑</span>
              <span className="modo-label">Tengo un código</span>
            </button>
          </div>

          {modo === 'crear' && (
            <form className="form" onSubmit={handleCrear}>
              <div className="field">
                <label>Nombre del hogar</label>
                <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Casa García, Piso Centro..." required />
              </div>
              <div className="field">
                <label>¿Cuántos coméis habitualmente?</label>
                <div className="counter">
                  <button type="button" className="cnt-btn" disabled={comensales<=1}
                    onClick={() => setComensales(c=>c-1)}><Minus size={16}/></button>
                  <span className="cnt-n">{comensales}</span>
                  <button type="button" className="cnt-btn"
                    onClick={() => setComensales(c=>c+1)}><Plus size={16}/></button>
                </div>
              </div>
              {error && <div className="alert">{error}</div>}
              <button type="submit" className="btn" disabled={loading}>
                {loading ? <><div className="spinner"/>Creando...</> : <>Crear hogar <ArrowRight size={16}/></>}
              </button>
            </form>
          )}

          {modo === 'unirse' && (
            <form className="form" onSubmit={handleUnirse}>
              <div className="field">
                <label>Código de invitación</label>
                <input autoFocus value={codigo}
                  onChange={e => setCodigo(e.target.value.toUpperCase())}
                  placeholder="Ej: A1B2C3D4"
                  style={{letterSpacing:'0.15em',fontWeight:600,textTransform:'uppercase'}}
                  required />
                <p className="hint">Pídele el código al administrador del hogar. Lo encontrará en Ajustes.</p>
              </div>
              {error && <div className="alert">{error}</div>}
              <button type="submit" className="btn" disabled={loading}>
                {loading ? <><div className="spinner"/>Buscando...</> : <>Unirme al hogar <ArrowRight size={16}/></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}