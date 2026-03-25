import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Clock, Users, Heart, Bookmark, Edit, Trash2, Globe, Lock } from 'lucide-react'

const DIF_COLOR = { facil:'badge-green', media:'badge-orange', dificil:'badge-red' }
const DIF_LABEL = { facil:'Fácil', media:'Media', dificil:'Difícil' }
const TIPO_EMOJI = { desayuno:'🌅', almuerzo:'🥗', comida:'🍽️', merienda:'🍎', cena:'🌙' }

function escalar(cantidad, base, actual) {
  if (!base || base === actual) return cantidad
  const resultado = (cantidad * actual) / base
  return Number.isInteger(resultado) ? resultado : parseFloat(resultado.toFixed(1))
}

export default function RecetaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hogar } = useAuth()
  const qc = useQueryClient()
  const [comensales, setComensales] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: receta, isLoading } = useQuery({
    queryKey: ['receta', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('recetas')
        .select(`*, perfiles!recetas_autor_id_fkey(nombre),
          receta_ingredientes(cantidad, unidad, notas,
            ingredientes(nombre, categorias_ingredientes(icono)))`)
        .eq('id', id).single()
      return data
    },
  })

  const { data: isLiked } = useQuery({
    queryKey: ['like', id, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('recetas_likes')
        .select('receta_id').eq('receta_id', id).eq('usuario_id', user.id).maybeSingle()
      return !!data
    },
    enabled: !!user?.id,
  })

  const { data: isGuardada } = useQuery({
    queryKey: ['guardada', id, hogar?.id],
    queryFn: async () => {
      const { data } = await supabase.from('recetas_guardadas')
        .select('id').eq('receta_id', id).eq('hogar_id', hogar.id).maybeSingle()
      return !!data
    },
    enabled: !!hogar?.id,
  })

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        await supabase.from('recetas_likes').delete().eq('receta_id', id).eq('usuario_id', user.id)
      } else {
        await supabase.from('recetas_likes').insert({ receta_id: id, usuario_id: user.id })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['like', id])
      qc.invalidateQueries(['receta', id])
    },
  })

  const toggleGuardar = useMutation({
    mutationFn: async () => {
      if (isGuardada) {
        await supabase.from('recetas_guardadas').delete().eq('receta_id', id).eq('hogar_id', hogar.id)
      } else {
        await supabase.from('recetas_guardadas').insert({ receta_id: id, hogar_id: hogar.id, guardada_por: user.id })
      }
    },
    onSuccess: () => qc.invalidateQueries(['guardada', id]),
  })

  const eliminar = useMutation({
    mutationFn: async () => {
      await supabase.from('receta_ingredientes').delete().eq('receta_id', id)
      await supabase.from('recetas').delete().eq('id', id)
    },
    onSuccess: () => navigate('/recetas', { replace: true }),
  })

  if (isLoading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {[80,200,120].map((h,i) => <div key={i} className="skeleton" style={{ height:h, borderRadius:16 }} />)}
    </div>
  )

  if (!receta) return (
    <div className="card"><div className="empty-state"><div className="empty-state-icon">🔍</div><h3>Receta no encontrada</h3></div></div>
  )

  const esMia = receta.autor_id === user?.id
  const base   = receta.comensales_base
  const actual = comensales ?? base
  const pasos  = Array.isArray(receta.pasos) ? receta.pasos : (typeof receta.pasos === 'string' ? JSON.parse(receta.pasos) : [])

  return (
    <>
      <style>{`
        .detalle-header { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
        .btn-back {
          width:38px; height:38px; border-radius:10px; border:1.5px solid var(--border);
          background:var(--surface); display:flex; align-items:center; justify-content:center;
          color:var(--text-2); cursor:pointer; flex-shrink:0; transition:all var(--transition);
        }
        .btn-back:hover { border-color:var(--brand-pale2); background:var(--surface-2); }
        .detalle-acciones { display:flex; gap:8px; margin-left:auto; }
        .btn-accion {
          width:38px; height:38px; border-radius:10px; border:1.5px solid var(--border);
          background:var(--surface); display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:all var(--transition); color:var(--text-3);
        }
        .btn-accion:hover { border-color:var(--brand-pale2); color:var(--brand); }
        .btn-accion.active { background:var(--brand-pale); border-color:var(--brand-pale2); color:var(--brand); }
        .btn-accion.liked  { background:#FEE2E2; border-color:#FCA5A5; color:#DC2626; }

        .detalle-hero {
          background:var(--surface); border:1px solid var(--border); border-radius:var(--radius);
          padding:24px; margin-bottom:16px;
        }
        .detalle-emoji  { font-size:48px; margin-bottom:12px; }
        .detalle-titulo { font-family:var(--font-display); font-size:24px; font-weight:700; color:var(--text); margin-bottom:8px; line-height:1.2; }
        .detalle-autor  { font-size:13px; color:var(--text-3); margin-bottom:16px; }
        .detalle-meta   { display:flex; flex-wrap:wrap; gap:8px; }
        .detalle-meta-item { display:flex; align-items:center; gap:5px; font-size:13px; color:var(--text-2); }

        .comensales-ctrl {
          background:var(--surface); border:1px solid var(--border); border-radius:var(--radius);
          padding:16px 18px; margin-bottom:16px;
          display:flex; align-items:center; justify-content:space-between;
        }
        .comensales-label { font-size:14px; font-weight:600; color:var(--text); }
        .comensales-btns  { display:flex; align-items:center; gap:12px; }
        .comensales-btn {
          width:34px; height:34px; border-radius:9px; border:1.5px solid var(--border);
          background:var(--surface); font-size:18px; font-weight:600;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; color:var(--text-2); transition:all var(--transition);
        }
        .comensales-btn:hover { border-color:var(--brand); color:var(--brand); background:var(--brand-pale); }
        .comensales-btn:disabled { opacity:0.35; cursor:not-allowed; }
        .comensales-num { font-family:var(--font-display); font-size:22px; font-weight:700; color:var(--brand); min-width:28px; text-align:center; }

        .seccion { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; margin-bottom:16px; }
        .seccion-titulo { font-family:var(--font-display); font-size:16px; font-weight:700; color:var(--text); padding:16px 18px; border-bottom:1px solid var(--border); }

        .ing-row { display:flex; align-items:center; gap:12px; padding:12px 18px; border-bottom:1px solid var(--border); }
        .ing-row:last-child { border-bottom:none; }
        .ing-icono { width:32px; height:32px; background:var(--surface-2); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
        .ing-nombre   { font-size:14px; font-weight:500; color:var(--text); flex:1; }
        .ing-cantidad { font-size:13px; font-weight:600; color:var(--brand); }
        .ing-notas    { font-size:12px; color:var(--text-3); margin-top:2px; }

        .paso-row { display:flex; gap:14px; padding:14px 18px; border-bottom:1px solid var(--border); }
        .paso-row:last-child { border-bottom:none; }
        .paso-num { width:26px; height:26px; border-radius:50%; background:var(--brand-pale); color:var(--brand-dark); font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
        .paso-texto { font-size:14px; color:var(--text); line-height:1.6; }

        .btn-eliminar {
          width:100%; padding:12px; border-radius:var(--radius-sm);
          border:1.5px solid #FCA5A5; background:#FEF2F2; color:#DC2626;
          font-family:var(--font-body); font-size:14px; font-weight:600;
          cursor:pointer; transition:all var(--transition);
          display:flex; align-items:center; justify-content:center; gap:7px;
          margin-top:24px;
        }
        .btn-eliminar:hover { background:#FEE2E2; }
        .confirm-box { background:#FEF2F2; border:1.5px solid #FCA5A5; border-radius:var(--radius-sm); padding:16px; margin-top:10px; }
        .confirm-box p { font-size:14px; color:#991B1B; margin-bottom:12px; }
        .confirm-btns { display:flex; gap:8px; }
      `}</style>

      {/* Header */}
      <div className="detalle-header">
        <button className="btn-back" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div className="detalle-acciones">
          {!esMia && (
            <>
              <button className={`btn-accion${isLiked ? ' liked' : ''}`} onClick={() => toggleLike.mutate()} title="Me gusta">
                <Heart size={17} fill={isLiked ? 'currentColor' : 'none'} />
              </button>
              <button className={`btn-accion${isGuardada ? ' active' : ''}`} onClick={() => toggleGuardar.mutate()} title="Guardar">
                <Bookmark size={17} fill={isGuardada ? 'currentColor' : 'none'} />
              </button>
            </>
          )}
          {esMia && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(`/recetas/${id}/editar`)}
              style={{ display:'flex', alignItems:'center', gap:6 }}
            >
              <Edit size={15} /> Editar
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="detalle-hero">
        {receta.imagen_url && (
          <img
            src={receta.imagen_url}
            alt={receta.titulo}
            style={{ width:'100%', height:200, objectFit:'cover', objectPosition:'center', borderRadius:10, marginBottom:16, display:'block' }}
          />
        )}
        {!receta.imagen_url && <div className="detalle-emoji">{TIPO_EMOJI[receta.tipo_comida] ?? '🍽️'}</div>}
        <h1 className="detalle-titulo">{receta.titulo}</h1>
        {receta.perfiles?.nombre && <p className="detalle-autor">por {receta.perfiles.nombre}</p>}
        {receta.descripcion && (
          <p style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.6, marginBottom:16 }}>{receta.descripcion}</p>
        )}
        <div className="detalle-meta">
          {receta.dificultad && <span className={`badge ${DIF_COLOR[receta.dificultad]}`}>{DIF_LABEL[receta.dificultad]}</span>}
          {receta.tiempo_preparacion > 0 && <span className="detalle-meta-item"><Clock size={14} /> Prep: {receta.tiempo_preparacion} min</span>}
          {receta.tiempo_coccion > 0     && <span className="detalle-meta-item"><Clock size={14} /> Cocción: {receta.tiempo_coccion} min</span>}
          {receta.likes > 0 && <span className="detalle-meta-item"><Heart size={14} /> {receta.likes}</span>}
          <span className="detalle-meta-item" style={{ marginLeft:'auto' }}>
            {receta.publica
              ? <><Globe size={13} color="var(--brand)" /> <span style={{fontSize:12,color:'var(--brand)'}}>Pública</span></>
              : <><Lock  size={13} color="var(--text-3)" /> <span style={{fontSize:12,color:'var(--text-3)'}}>Privada</span></>
            }
          </span>
        </div>
      </div>

      {/* Control comensales */}
      <div className="comensales-ctrl">
        <span className="comensales-label">Comensales</span>
        <div className="comensales-btns">
          <button className="comensales-btn" disabled={(comensales ?? base) <= 1}
            onClick={() => setComensales(c => Math.max(1, (c ?? base) - 1))}>−</button>
          <span className="comensales-num">{actual}</span>
          <button className="comensales-btn"
            onClick={() => setComensales(c => (c ?? base) + 1)}>+</button>
        </div>
      </div>

      {/* Ingredientes */}
      {receta.receta_ingredientes?.length > 0 && (
        <div className="seccion">
          <div className="seccion-titulo">🛒 Ingredientes</div>
          {receta.receta_ingredientes.map((ri, i) => (
            <div key={i} className="ing-row">
              <div className="ing-icono">{ri.ingredientes?.categorias_ingredientes?.icono ?? '🥘'}</div>
              <div style={{ flex:1 }}>
                <div className="ing-nombre">{ri.ingredientes?.nombre}</div>
                {ri.notas && <div className="ing-notas">{ri.notas}</div>}
              </div>
              <div className="ing-cantidad">{escalar(ri.cantidad, base, actual)} {ri.unidad}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pasos */}
      {pasos.length > 0 && (
        <div className="seccion">
          <div className="seccion-titulo">👨‍🍳 Preparación</div>
          {pasos.map((paso, i) => (
            <div key={i} className="paso-row">
              <div className="paso-num">{i + 1}</div>
              <div className="paso-texto">
                {typeof paso === 'string' ? paso : paso.texto ?? paso.descripcion ?? ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {receta.tags?.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
          {receta.tags.map(tag => <span key={tag} className="badge badge-gray">#{tag}</span>)}
        </div>
      )}

      {/* Eliminar */}
      {esMia && (
        <>
          <button className="btn-eliminar" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} /> Eliminar receta
          </button>
          {confirmDelete && (
            <div className="confirm-box">
              <p>¿Seguro que quieres eliminar <strong>"{receta.titulo}"</strong>? No se puede deshacer.</p>
              <div className="confirm-btns">
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>Cancelar</button>
                <button className="btn btn-sm" style={{ background:'#DC2626', color:'white' }}
                  onClick={() => eliminar.mutate()} disabled={eliminar.isPending}>
                  {eliminar.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}