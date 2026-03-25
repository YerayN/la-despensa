import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Search, Clock, Users, BookOpen, Bookmark } from 'lucide-react'

const TIPOS = [
  { key: null,        label: 'Todas'    },
  { key: 'desayuno',  label: '🌅 Desayuno'  },
  { key: 'almuerzo',  label: '🥗 Almuerzo'  },
  { key: 'comida',    label: '🍽️ Comida'    },
  { key: 'merienda',  label: '🍎 Merienda'  },
  { key: 'cena',      label: '🌙 Cena'      },
]

const TABS = [
  { key: 'mias',      label: 'Mis recetas',  icon: BookOpen  },
  { key: 'guardadas', label: 'Guardadas',    icon: Bookmark  },
]

const DIF_COLOR = { facil: 'badge-green', media: 'badge-orange', dificil: 'badge-red' }
const DIF_LABEL = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' }
const TIPO_EMOJI = { desayuno:'🌅', almuerzo:'🥗', comida:'🍽️', merienda:'🍎', cena:'🌙' }

export default function RecetasPage() {
  const navigate  = useNavigate()
  const { hogar, perfil } = useAuth()
  const [tab,     setTab]     = useState('mias')
  const [tipo,    setTipo]    = useState(null)
  const [busqueda,setBusqueda]= useState('')

  // ── Mis recetas ──────────────────────────────────────────
  const { data: misRecetas = [], isLoading: loadingMias } = useQuery({
    queryKey: ['recetas-mias', hogar?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('recetas')
        .select('id, titulo, tipo_comida, dificultad, tiempo_coccion, tiempo_preparacion, comensales_base, publica')
        .eq('hogar_id', hogar.id)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!hogar?.id,
  })

  // ── Recetas guardadas ────────────────────────────────────
  const { data: guardadas = [], isLoading: loadingGuardadas } = useQuery({
    queryKey: ['recetas-guardadas', hogar?.id],
    queryFn: async () => {
      // Paso 1: obtener IDs guardados
      const { data: rels } = await supabase
        .from('recetas_guardadas')
        .select('receta_id')
        .eq('hogar_id', hogar.id)
        .order('created_at', { ascending: false })
      if (!rels?.length) return []
      // Paso 2: traer recetas por ID (funciona bien con RLS para recetas públicas)
      const ids = rels.map(r => r.receta_id)
      const { data } = await supabase
        .from('recetas')
        .select('id, titulo, tipo_comida, dificultad, tiempo_coccion, tiempo_preparacion, comensales_base, publica')
        .in('id', ids)
      return data ?? []
    },
    enabled: !!hogar?.id,
  })

  const lista   = tab === 'mias' ? misRecetas : guardadas
  const loading = tab === 'mias' ? loadingMias : loadingGuardadas

  const filtradas = lista.filter(r => {
    const matchTipo = !tipo || r.tipo_comida === tipo
    const matchBusq = !busqueda || r.titulo.toLowerCase().includes(busqueda.toLowerCase())
    return matchTipo && matchBusq
  })

  return (
    <>
      <style>{`
        .recetas-tabs {
          display: flex;
          gap: 4px;
          background: var(--surface-2);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 16px;
        }
        .recetas-tab {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 9px 12px; border-radius: 9px; border: none; cursor: pointer;
          font-family: var(--font-body); font-size: 13px; font-weight: 600;
          color: var(--text-3); background: transparent;
          transition: all var(--transition);
        }
        .recetas-tab.active { background: var(--surface); color: var(--brand); box-shadow: var(--shadow); }

        .busqueda-wrap { position: relative; margin-bottom: 14px; }
        .busqueda-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .busqueda-input {
          width: 100%; padding: 10px 14px 10px 38px;
          border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          font-family: var(--font-body); font-size: 14px; color: var(--text);
          background: var(--surface); outline: none;
          transition: border-color var(--transition), box-shadow var(--transition);
          -webkit-appearance: none;
        }
        .busqueda-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(45,106,79,0.1); }
        .busqueda-input::placeholder { color: var(--text-3); }

        .filtros-scroll {
          display: flex; gap: 8px; overflow-x: auto;
          padding-bottom: 4px; margin-bottom: 20px;
          scrollbar-width: none;
        }
        .filtros-scroll::-webkit-scrollbar { display: none; }
        .filtro-btn {
          flex-shrink: 0; padding: 6px 14px;
          border-radius: 100px; border: 1.5px solid var(--border);
          font-family: var(--font-body); font-size: 12px; font-weight: 600;
          color: var(--text-2); background: var(--surface); cursor: pointer;
          transition: all var(--transition); white-space: nowrap;
        }
        .filtro-btn.active {
          background: var(--brand-pale); border-color: var(--brand-pale2); color: var(--brand-dark);
        }

        .recetas-list { display: flex; flex-direction: column; gap: 10px; }

        .receta-row {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px;
          display: flex; align-items: center; gap: 14px;
          cursor: pointer; transition: all var(--transition);
          text-decoration: none;
        }
        .receta-row:hover { border-color: var(--brand-pale2); box-shadow: var(--shadow-md); transform: translateX(2px); }

        .receta-row-emoji {
          width: 46px; height: 46px; flex-shrink: 0;
          background: var(--surface-2); border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
        }
        .receta-row-titulo { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
        .receta-row-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .receta-row-info { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-3); }

        .receta-row-indicator {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
          margin-left: auto;
        }

        .fab {
          position: fixed; bottom: calc(var(--nav-h) + 16px); right: 16px;
          width: 52px; height: 52px; border-radius: 16px;
          background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
          border: none; color: white; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 20px rgba(45,106,79,0.35);
          transition: all var(--transition); z-index: 50;
          -webkit-tap-highlight-color: transparent;
        }
        .fab:hover { transform: scale(1.07); box-shadow: 0 6px 24px rgba(45,106,79,0.4); }
        .fab:active { transform: scale(0.96); }

        @media (min-width: 768px) {
          .fab { bottom: 24px; right: 28px; }
        }

        .skeleton-row {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px;
          display: flex; align-items: center; gap: 14px;
        }
      `}</style>

      {/* Header */}
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">Recetas</h1>
          <p className="page-subtitle">{misRecetas.length} recetas en tu hogar</p>
        </div>
        {/* Botón añadir en escritorio */}
        <button
          className="btn btn-primary"
          onClick={() => navigate('/recetas/nueva')}
          style={{ display:'none' }}
          id="btn-nueva-desktop"
        >
          <Plus size={16} /> Nueva receta
        </button>
      </div>

      {/* Tabs */}
      <div className="recetas-tabs">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`recetas-tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="busqueda-wrap">
        <Search size={15} className="busqueda-icon" />
        <input
          className="busqueda-input"
          placeholder="Buscar receta..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {/* Filtros por tipo */}
      <div className="filtros-scroll">
        {TIPOS.map(t => (
          <button
            key={String(t.key)}
            className={`filtro-btn${tipo === t.key ? ' active' : ''}`}
            onClick={() => setTipo(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="recetas-list">
          {[1,2,3].map(i => (
            <div key={i} className="skeleton-row">
              <div className="skeleton" style={{ width:46, height:46, borderRadius:12, flexShrink:0 }} />
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                <div className="skeleton" style={{ width:'55%', height:14 }} />
                <div className="skeleton" style={{ width:'35%', height:11 }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">{tab === 'mias' ? '📖' : '🔖'}</div>
            <h3>{busqueda ? 'Sin resultados' : tab === 'mias' ? 'Sin recetas todavía' : 'Nada guardado aún'}</h3>
            <p>
              {busqueda
                ? `No encontramos "${busqueda}"`
                : tab === 'mias'
                  ? 'Crea tu primera receta con el botón +'
                  : 'Guarda recetas de la comunidad para tenerlas aquí'
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="recetas-list">
          {filtradas.map(r => {
            const tiempo = (r.tiempo_preparacion ?? 0) + (r.tiempo_coccion ?? 0)
            return (
              <div
                key={r.id}
                className="receta-row"
                onClick={() => navigate(`/recetas/${r.id}`)}
              >
                <div className="receta-row-emoji">
                  {TIPO_EMOJI[r.tipo_comida] ?? '🍽️'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="receta-row-titulo">{r.titulo}</div>
                  <div className="receta-row-meta">
                    {tiempo > 0 && (
                      <span className="receta-row-info">
                        <Clock size={12} /> {tiempo} min
                      </span>
                    )}
                    {r.comensales_base && (
                      <span className="receta-row-info">
                        <Users size={12} /> {r.comensales_base}p
                      </span>
                    )}
                    {r.dificultad && (
                      <span className={`badge ${DIF_COLOR[r.dificultad] ?? 'badge-gray'}`}
                        style={{ fontSize:11, padding:'2px 8px' }}>
                        {DIF_LABEL[r.dificultad] ?? r.dificultad}
                      </span>
                    )}
                    {tab === 'mias' && r.publica && (
                      <span className="badge badge-gray" style={{ fontSize:11, padding:'2px 8px' }}>
                        Pública
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className="receta-row-indicator"
                  style={{ background: r.publica ? 'var(--brand-pale2)' : 'var(--border)' }}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* FAB móvil */}
      <button className="fab" onClick={() => navigate('/recetas/nueva')} title="Nueva receta">
        <Plus size={24} />
      </button>

      {/* Botón escritorio (via CSS) */}
      <style>{`
        @media (min-width: 768px) { #btn-nueva-desktop { display: flex !important; } .fab { display: none; } }
      `}</style>
    </>
  )
}