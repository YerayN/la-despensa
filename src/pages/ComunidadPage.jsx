import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Heart, Bookmark, Clock, Users, Search } from 'lucide-react'

const TIPOS_FILTRO = [
  { key: null,       label: 'Todas'      },
  { key: 'desayuno', label: '🌅 Desayuno' },
  { key: 'almuerzo', label: '🥗 Almuerzo' },
  { key: 'comida',   label: '🍽️ Comida'   },
  { key: 'merienda', label: '🍎 Merienda' },
  { key: 'cena',     label: '🌙 Cena'     },
]

const DIF_COLOR = { facil:'badge-green', media:'badge-orange', dificil:'badge-red' }
const DIF_LABEL = { facil:'Fácil', media:'Media', dificil:'Difícil' }
const TIPO_EMOJI = { desayuno:'🌅', almuerzo:'🥗', comida:'🍽️', merienda:'🍎', cena:'🌙' }

export default function ComunidadPage() {
  const { user, hogar } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [busqueda, setBusqueda] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState(null)
  const [orden, setOrden] = useState('recientes') // 'recientes' | 'likes'

  // ── Recetas públicas ─────────────────────────────────────
  const { data: recetas = [], isLoading } = useQuery({
    queryKey: ['comunidad', orden],
    queryFn: async () => {
      const { data } = await supabase
        .from('recetas')
        .select(`
          id, titulo, tipo_comida, dificultad, tiempo_coccion,
          comensales_base, likes, imagen_url, created_at,
          perfiles!recetas_autor_id_fkey(nombre),
          hogar:hogares(nombre)
        `)
        .eq('publica', true)
        .neq('hogar_id', hogar.id)   // excluir las propias
        .order(orden === 'likes' ? 'likes' : 'created_at', { ascending: false })
        .limit(50)
      return data ?? []
    },
    enabled: !!hogar?.id,
    staleTime: 1000 * 60 * 3,
  })

  // ── Mis likes ────────────────────────────────────────────
  const { data: misLikes = [] } = useQuery({
    queryKey: ['mis-likes', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('recetas_likes')
        .select('receta_id')
        .eq('usuario_id', user.id)
      return data?.map(l => l.receta_id) ?? []
    },
    enabled: !!user?.id,
  })

  // ── Mis guardadas ────────────────────────────────────────
  const { data: misGuardadas = [] } = useQuery({
    queryKey: ['mis-guardadas-ids', hogar?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('recetas_guardadas')
        .select('receta_id')
        .eq('hogar_id', hogar.id)
      return data?.map(g => g.receta_id) ?? []
    },
    enabled: !!hogar?.id,
  })

  // ── Toggle like ──────────────────────────────────────────
  const toggleLike = useMutation({
    mutationFn: async (recetaId) => {
      if (misLikes.includes(recetaId)) {
        await supabase.from('recetas_likes').delete()
          .eq('receta_id', recetaId).eq('usuario_id', user.id)
      } else {
        await supabase.from('recetas_likes').insert({ receta_id: recetaId, usuario_id: user.id })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['mis-likes', user?.id])
      qc.invalidateQueries(['comunidad'])
    },
  })

  // ── Toggle guardar ───────────────────────────────────────
  const toggleGuardar = useMutation({
    mutationFn: async (recetaId) => {
      if (misGuardadas.includes(recetaId)) {
        await supabase.from('recetas_guardadas').delete()
          .eq('receta_id', recetaId).eq('hogar_id', hogar.id)
      } else {
        await supabase.from('recetas_guardadas').insert({
          receta_id:   recetaId,
          hogar_id:    hogar.id,
          guardada_por: user.id,
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['mis-guardadas-ids', hogar?.id])
      qc.invalidateQueries(['recetas-guardadas', hogar?.id])
    },
  })

  // ── Filtrado local ───────────────────────────────────────
  const filtradas = recetas.filter(r => {
    const matchTipo = !tipoFiltro || r.tipo_comida === tipoFiltro
    const matchBusq = !busqueda   || r.titulo.toLowerCase().includes(busqueda.toLowerCase())
    return matchTipo && matchBusq
  })

  return (
    <>
      <style>{`
        .com-toolbar { display:flex; flex-direction:column; gap:10px; margin-bottom:16px; width:100%; box-sizing:border-box; overflow:hidden; }

        .busq-wrap { position:relative; }
        .busq-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-3); pointer-events:none; }
        .busq-input {
          width:100%; padding:10px 14px 10px 36px;
          border:1.5px solid var(--border); border-radius:var(--radius-sm);
          font-family:var(--font-body); font-size:14px; color:var(--text);
          background:var(--surface); outline:none;
          transition:border-color var(--transition);
          -webkit-appearance:none;
          box-sizing:border-box;
        }
        .busq-input:focus { border-color:var(--brand); box-shadow:0 0 0 3px rgba(45,106,79,0.1); }
        .busq-input::placeholder { color:var(--text-3); }

        .filtros-row { display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0; overflow:hidden; }
        .filtros-scroll { display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; flex:1; min-width:0; -webkit-overflow-scrolling:touch; }
        .filtros-scroll::-webkit-scrollbar { display:none; }
        .filtro-chip {
          flex-shrink:0; padding:5px 12px; border-radius:100px;
          border:1.5px solid var(--border); font-family:var(--font-body);
          font-size:12px; font-weight:600; color:var(--text-2);
          background:var(--surface); cursor:pointer; transition:all var(--transition);
          white-space:nowrap;
        }
        .filtro-chip.active { background:var(--brand-pale); border-color:var(--brand-pale2); color:var(--brand-dark); }

        .orden-select {
          padding:6px 10px; border:1.5px solid var(--border); border-radius:var(--radius-sm);
          font-family:var(--font-body); font-size:12px; font-weight:600;
          color:var(--text-2); background:var(--surface); outline:none; cursor:pointer;
          flex-shrink:0; -webkit-appearance:none;
        }

        /* Grid de cards */
        .com-grid { display:grid; grid-template-columns:1fr; gap:10px; width:100%; box-sizing:border-box; }
        @media(min-width:500px)  { .com-grid { grid-template-columns:1fr 1fr; } }
        @media(min-width:768px)  { .com-grid { grid-template-columns:repeat(3,1fr); } }
        @media(min-width:1024px) { .com-grid { grid-template-columns:repeat(4,1fr); } }

        .com-card {
          background:var(--surface); border:1px solid var(--border);
          border-radius:var(--radius); overflow:hidden; cursor:pointer;
          transition:all var(--transition); display:flex; flex-direction:row;
          align-items:stretch; min-width:0; box-sizing:border-box;
        }
        .com-card:hover { box-shadow:var(--shadow-md); transform:translateY(-1px); border-color:var(--brand-pale2); }
        @media(min-width:500px) { .com-card { flex-direction:column; } }

        .com-card-img {
          width:80px; height:80px; object-fit:cover; object-position:center;
          background:var(--surface-2); display:block; flex-shrink:0;
        }
        .com-card-emoji-placeholder {
          width:80px; height:80px; background:var(--surface-2);
          display:flex; align-items:center; justify-content:center;
          font-size:24px; flex-shrink:0;
        }
        @media(min-width:500px) {
          .com-card-img { width:100%; height:auto; aspect-ratio:4/3; }
          .com-card-emoji-placeholder { width:100%; height:auto; aspect-ratio:4/3; font-size:36px; }
        }
        .com-card-body { padding:12px; flex:1; display:flex; flex-direction:column; gap:6px; }
        .com-card-titulo { font-size:13px; font-weight:700; color:var(--text); line-height:1.3;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .com-card-autor { font-size:11px; color:var(--text-3); }
        .com-card-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:2px; }
        .com-card-info { display:flex; align-items:center; gap:3px; font-size:11px; color:var(--text-3); }

        .com-card-actions {
          display:flex; align-items:center; justify-content:space-between;
          padding:8px 12px; border-top:1px solid var(--border); margin-top:auto;
        }
        @media(max-width:499px) {
          .com-card-actions { border-top:none; border-left:1px solid var(--border); flex-direction:column; justify-content:center; gap:8px; padding:8px; flex-shrink:0; }
          .com-card-body { padding:10px 10px 4px; min-width:0; flex:1; }
        }
        .com-card-likes { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:600; color:var(--text-3); }

        .btn-like, .btn-save {
          width:32px; height:32px; border-radius:9px; border:1.5px solid var(--border);
          background:var(--surface); display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:all var(--transition); color:var(--text-3);
        }
        .btn-like:hover { border-color:#FCA5A5; color:#DC2626; background:#FEF2F2; }
        .btn-like.liked { border-color:#FCA5A5; color:#DC2626; background:#FEE2E2; }
        .btn-save:hover { border-color:var(--brand-pale2); color:var(--brand); background:var(--brand-pale); }
        .btn-save.saved { border-color:var(--brand-pale2); color:var(--brand); background:var(--brand-pale); }

        /* Skeleton */
        .com-skeleton { border-radius:var(--radius); overflow:hidden; }
        .com-skeleton-img { width:100%; aspect-ratio:4/3; }
        .com-skeleton-body { padding:12px; display:flex; flex-direction:column; gap:8px; }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">Comunidad</h1>
        <p className="page-subtitle">Descubre recetas de otros hogares</p>
      </div>

      {/* Toolbar */}
      <div className="com-toolbar">
        <div className="busq-wrap">
          <Search size={15} className="busq-icon" />
          <input
            className="busq-input"
            placeholder="Buscar en la comunidad..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        <div className="filtros-row">
          <div className="filtros-scroll">
            {TIPOS_FILTRO.map(t => (
              <button
                key={String(t.key)}
                className={`filtro-chip${tipoFiltro === t.key ? ' active' : ''}`}
                onClick={() => setTipoFiltro(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select className="orden-select" value={orden} onChange={e => setOrden(e.target.value)}>
            <option value="recientes">Recientes</option>
            <option value="likes">Más likes</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="com-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="com-skeleton card">
              <div className="skeleton com-skeleton-img" />
              <div className="com-skeleton-body">
                <div className="skeleton" style={{ height:13, width:'80%' }} />
                <div className="skeleton" style={{ height:11, width:'50%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🌍</div>
            <h3>{busqueda ? `Sin resultados para "${busqueda}"` : 'Aún no hay recetas públicas'}</h3>
            <p>Cuando otros hogares publiquen recetas aparecerán aquí</p>
          </div>
        </div>
      ) : (
        <div className="com-grid">
          {filtradas.map(r => {
            const liked  = misLikes.includes(r.id)
            const saved  = misGuardadas.includes(r.id)
            return (
              <div key={r.id} className="com-card" onClick={() => navigate(`/recetas/${r.id}`)}>
                {/* Imagen o placeholder */}
                <div onClick={e => e.stopPropagation()}>
                  {r.imagen_url
                    ? <img className="com-card-img" src={r.imagen_url} alt={r.titulo} loading="lazy" />
                    : <div className="com-card-emoji-placeholder">{TIPO_EMOJI[r.tipo_comida] ?? '🍽️'}</div>
                  }
                </div>

                <div className="com-card-body">
                  <div className="com-card-titulo">{r.titulo}</div>
                  <div className="com-card-autor">
                    {r.perfiles?.nombre ?? 'Anónimo'}
                    {r.hogar?.nombre && <> · {r.hogar.nombre}</>}
                  </div>
                  <div className="com-card-meta">
                    {r.dificultad && (
                      <span className={`badge ${DIF_COLOR[r.dificultad] ?? 'badge-gray'}`}
                        style={{ fontSize:10, padding:'1px 7px' }}>
                        {DIF_LABEL[r.dificultad] ?? r.dificultad}
                      </span>
                    )}
                    {r.tiempo_coccion > 0 && (
                      <span className="com-card-info"><Clock size={11} /> {r.tiempo_coccion}m</span>
                    )}
                    {r.comensales_base > 0 && (
                      <span className="com-card-info"><Users size={11} /> {r.comensales_base}</span>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="com-card-actions">
                  <div className="com-card-likes">
                    <Heart size={13} fill={liked ? '#DC2626' : 'none'} color={liked ? '#DC2626' : 'currentColor'} />
                    {r.likes > 0 && r.likes}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button
                      className={`btn-like${liked ? ' liked' : ''}`}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleLike.mutate(r.id) }}
                      title="Me gusta"
                    >
                      <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      className={`btn-save${saved ? ' saved' : ''}`}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleGuardar.mutate(r.id) }}
                      title={saved ? 'Guardada' : 'Guardar'}
                    >
                      <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}