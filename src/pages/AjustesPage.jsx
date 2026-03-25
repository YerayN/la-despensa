import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { User, Home, Users, Copy, LogOut, ChevronRight, Check, Minus, Plus } from 'lucide-react'

export default function AjustesPage() {
  const { user, perfil, hogar, setPerfil, setHogar, signOut, loadPerfil } = useAuth()
  const qc = useQueryClient()

  // ── Perfil ───────────────────────────────────────────────
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nuevoNombre, setNuevoNombre]       = useState('')
  const [copiado, setCopiado]               = useState(false)

  // ── Hogar ────────────────────────────────────────────────
  const [editandoHogar, setEditandoHogar]       = useState(false)
  const [nuevoNombreHogar, setNuevoNombreHogar] = useState('')
  const [nuevosComensales, setNuevosComensales] = useState(2)

  // ── Miembros del hogar ───────────────────────────────────
  const { data: miembros = [] } = useQuery({
    queryKey: ['miembros', hogar?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('perfiles')
        .select('id, nombre, email')
        .eq('hogar_id', hogar.id)
      return data ?? []
    },
    enabled: !!hogar?.id,
  })

  // ── Guardar nombre perfil ────────────────────────────────
  const guardarNombre = useMutation({
    mutationFn: async () => {
      if (!nuevoNombre.trim()) throw new Error('El nombre no puede estar vacío')
      const { data, error } = await supabase
        .from('perfiles')
        .update({ nombre: nuevoNombre.trim() })
        .eq('id', user.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      await loadPerfil(user.id)
      setEditandoNombre(false)
    },
  })

  // ── Guardar hogar ────────────────────────────────────────
  const guardarHogar = useMutation({
    mutationFn: async () => {
      if (!nuevoNombreHogar.trim()) throw new Error('El nombre no puede estar vacío')
      const { data, error } = await supabase
        .from('hogares')
        .update({ nombre: nuevoNombreHogar.trim(), num_comensales: nuevosComensales })
        .eq('id', hogar.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setHogar(data)
      setEditandoHogar(false)
      qc.invalidateQueries(['miembros', hogar?.id])
    },
  })

  // ── Copiar código ────────────────────────────────────────
  const copiarCodigo = () => {
    navigator.clipboard?.writeText(hogar?.codigo_union ?? '')
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // ── Abandonar hogar ──────────────────────────────────────
  const abandonarHogar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('perfiles')
        .update({ hogar_id: null })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await loadPerfil(user.id)
    },
  })

  return (
    <>
      <style>{`
        .ajustes-section {
          background:var(--surface); border:1px solid var(--border);
          border-radius:var(--radius); overflow:hidden; margin-bottom:14px;
        }
        .ajustes-section-title {
          font-size:11px; font-weight:700; text-transform:uppercase;
          letter-spacing:0.08em; color:var(--text-3);
          padding:14px 16px 8px;
        }

        .ajustes-row {
          display:flex; align-items:center; gap:12px;
          padding:13px 16px; border-top:1px solid var(--border);
          transition:background var(--transition);
        }
        .ajustes-row:first-of-type { border-top:none; }
        .ajustes-row.clickable { cursor:pointer; }
        .ajustes-row.clickable:hover { background:var(--surface-2); }

        .ajustes-icon {
          width:36px; height:36px; border-radius:10px;
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0; font-size:18px;
        }
        .ajustes-label { font-size:14px; font-weight:600; color:var(--text); }
        .ajustes-value { font-size:13px; color:var(--text-3); margin-top:1px; }
        .ajustes-chevron { margin-left:auto; color:var(--text-3); flex-shrink:0; }

        /* Formulario inline */
        .inline-form {
          padding:12px 16px 16px; border-top:1px solid var(--border);
          display:flex; flex-direction:column; gap:10px;
          background:var(--surface-2);
        }
        .inline-form input {
          width:100%; padding:9px 12px; border:1.5px solid var(--border);
          border-radius:var(--radius-sm); font-family:var(--font-body);
          font-size:14px; color:var(--text); background:var(--surface);
          outline:none; transition:border-color var(--transition);
          -webkit-appearance:none;
        }
        .inline-form input:focus { border-color:var(--brand); box-shadow:0 0 0 3px rgba(45,106,79,0.1); }
        .inline-btns { display:flex; gap:8px; }

        .counter-row { display:flex; align-items:center; gap:4px; }
        .cnt-btn {
          width:30px; height:30px; border-radius:8px; border:1.5px solid var(--border);
          background:var(--surface); display:flex; align-items:center; justify-content:center;
          cursor:pointer; color:var(--text-2); transition:all var(--transition);
        }
        .cnt-btn:hover { border-color:var(--brand); color:var(--brand); background:var(--brand-pale); }
        .cnt-btn:disabled { opacity:0.35; cursor:not-allowed; }
        .cnt-num { font-family:var(--font-display); font-size:20px; font-weight:700; color:var(--brand); min-width:32px; text-align:center; }

        /* Código */
        .codigo-box {
          display:flex; align-items:center; justify-content:space-between;
          background:var(--surface-2); border:1.5px solid var(--border);
          border-radius:var(--radius-sm); padding:10px 14px; margin:0 16px 14px;
        }
        .codigo-text { font-size:22px; font-weight:700; letter-spacing:0.15em; color:var(--text); font-family:var(--font-display); }
        .codigo-hint { font-size:11px; color:var(--text-3); margin-top:2px; }
        .btn-copiar {
          display:flex; align-items:center; gap:6px; padding:8px 14px;
          border-radius:var(--radius-sm); border:1.5px solid var(--border);
          background:var(--surface); font-family:var(--font-body);
          font-size:13px; font-weight:600; color:var(--text-2); cursor:pointer;
          transition:all var(--transition); flex-shrink:0;
        }
        .btn-copiar:hover { border-color:var(--brand-pale2); color:var(--brand); }
        .btn-copiar.copiado { border-color:var(--brand-pale2); color:var(--brand); background:var(--brand-pale); }

        /* Miembros */
        .miembro-avatar {
          width:32px; height:32px; border-radius:50%;
          background:var(--brand-pale); color:var(--brand-dark);
          display:flex; align-items:center; justify-content:center;
          font-size:13px; font-weight:700; flex-shrink:0;
        }

        /* Zona peligro */
        .danger-row {
          display:flex; align-items:center; gap:12px;
          padding:13px 16px; cursor:pointer;
          transition:background var(--transition);
        }
        .danger-row:hover { background:#FEF2F2; }
        .danger-label { font-size:14px; font-weight:600; color:#DC2626; }

        .error-inline { font-size:12px; color:#DC2626; padding:0 2px; }

        .version-tag { text-align:center; font-size:12px; color:var(--text-3); padding:8px 0 24px; }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">Ajustes</h1>
      </div>

      {/* ── Perfil ── */}
      <div className="ajustes-section">
        <div className="ajustes-section-title">Tu perfil</div>

        <div
          className="ajustes-row clickable"
          onClick={() => { setNuevoNombre(perfil?.nombre ?? ''); setEditandoNombre(true) }}
        >
          <div className="ajustes-icon" style={{ background:'#EEF2FF' }}>
            <User size={18} color="#4F46E5" />
          </div>
          <div style={{ flex:1 }}>
            <div className="ajustes-label">{perfil?.nombre ?? '—'}</div>
            <div className="ajustes-value">Nombre</div>
          </div>
          <ChevronRight size={16} className="ajustes-chevron" />
        </div>

        <div className="ajustes-row">
          <div className="ajustes-icon" style={{ background:'#F0FDF4' }}>
            <span>✉️</span>
          </div>
          <div style={{ flex:1 }}>
            <div className="ajustes-label">{user?.email}</div>
            <div className="ajustes-value">Email</div>
          </div>
        </div>

        {editandoNombre && (
          <div className="inline-form">
            <input
              autoFocus
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              placeholder="Tu nombre"
              onKeyDown={e => e.key === 'Enter' && guardarNombre.mutate()}
            />
            {guardarNombre.error && <p className="error-inline">{guardarNombre.error.message}</p>}
            <div className="inline-btns">
              <button className="btn btn-primary btn-sm" onClick={() => guardarNombre.mutate()} disabled={guardarNombre.isPending}>
                {guardarNombre.isPending ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditandoNombre(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Hogar ── */}
      <div className="ajustes-section">
        <div className="ajustes-section-title">Tu hogar</div>

        <div
          className="ajustes-row clickable"
          onClick={() => { setNuevoNombreHogar(hogar?.nombre ?? ''); setNuevosComensales(hogar?.num_comensales ?? 2); setEditandoHogar(true) }}
        >
          <div className="ajustes-icon" style={{ background:'var(--brand-pale)' }}>
            <Home size={18} color="var(--brand)" />
          </div>
          <div style={{ flex:1 }}>
            <div className="ajustes-label">{hogar?.nombre ?? '—'}</div>
            <div className="ajustes-value">{hogar?.num_comensales} {hogar?.num_comensales === 1 ? 'comensal' : 'comensales'}</div>
          </div>
          <ChevronRight size={16} className="ajustes-chevron" />
        </div>

        {editandoHogar && (
          <div className="inline-form">
            <input
              autoFocus
              value={nuevoNombreHogar}
              onChange={e => setNuevoNombreHogar(e.target.value)}
              placeholder="Nombre del hogar"
            />
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>Comensales habituales</div>
              <div className="counter-row">
                <button className="cnt-btn" disabled={nuevosComensales <= 1} onClick={() => setNuevosComensales(c => c - 1)}><Minus size={14} /></button>
                <span className="cnt-num">{nuevosComensales}</span>
                <button className="cnt-btn" onClick={() => setNuevosComensales(c => c + 1)}><Plus size={14} /></button>
              </div>
            </div>
            {guardarHogar.error && <p className="error-inline">{guardarHogar.error.message}</p>}
            <div className="inline-btns">
              <button className="btn btn-primary btn-sm" onClick={() => guardarHogar.mutate()} disabled={guardarHogar.isPending}>
                {guardarHogar.isPending ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditandoHogar(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Código de invitación ── */}
      <div className="ajustes-section">
        <div className="ajustes-section-title">Invitar a alguien</div>
        <div style={{ padding:'8px 0' }}>
          <div className="codigo-box">
            <div>
              <div className="codigo-text">{hogar?.codigo_union}</div>
              <div className="codigo-hint">Comparte este código para unirse a tu hogar</div>
            </div>
            <button className={`btn-copiar${copiado ? ' copiado' : ''}`} onClick={copiarCodigo}>
              {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Miembros ── */}
      <div className="ajustes-section">
        <div className="ajustes-section-title">Miembros del hogar</div>
        {miembros.map(m => (
          <div key={m.id} className="ajustes-row">
            <div className="miembro-avatar">
              {m.nombre?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div className="ajustes-label">
                {m.nombre}
                {m.id === user?.id && <span style={{ fontSize:11, color:'var(--brand)', fontWeight:600, marginLeft:6 }}>Tú</span>}
              </div>
              <div className="ajustes-value">{m.email}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Cuenta ── */}
      <div className="ajustes-section">
        <div className="ajustes-section-title">Cuenta</div>

        <div className="danger-row" onClick={() => signOut()}>
          <div className="ajustes-icon" style={{ background:'#FEF2F2' }}>
            <LogOut size={18} color="#DC2626" />
          </div>
          <div className="danger-label">Cerrar sesión</div>
        </div>

        {miembros.length > 1 && (
          <div
            className="danger-row"
            style={{ borderTop:'1px solid var(--border)' }}
            onClick={() => {
              if (window.confirm('¿Seguro que quieres abandonar el hogar? Perderás acceso al planning y la lista de la compra.')) {
                abandonarHogar.mutate()
              }
            }}
          >
            <div className="ajustes-icon" style={{ background:'#FEF2F2' }}>
              <Users size={18} color="#DC2626" />
            </div>
            <div className="danger-label">Abandonar hogar</div>
          </div>
        )}
      </div>

      <p className="version-tag">La Despensa v0.1</p>
    </>
  )
}