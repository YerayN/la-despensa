import { useAuth } from '../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, CalendarDays, ShoppingCart,
  Users, ChefHat, Plus, ArrowRight, Clock
} from 'lucide-react'

const TIPOS_COMIDA = [
  { key: 'desayuno',  emoji: '🌅', label: 'Desayuno'  },
  { key: 'almuerzo',  emoji: '🥗', label: 'Almuerzo'  },
  { key: 'comida',    emoji: '🍽️', label: 'Comida'    },
  { key: 'merienda',  emoji: '🍎', label: 'Merienda'  },
  { key: 'cena',      emoji: '🌙', label: 'Cena'      },
]

const DIAS  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fechaHoy() {
  const d = new Date()
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`
}

function toDateStr(d) {
  return d.toISOString().split('T')[0]
}

const DIF_COLOR = { facil: 'badge-green', media: 'badge-orange', dificil: 'badge-red' }
const DIF_LABEL = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' }

export default function DashboardPage() {
  const { perfil, hogar } = useAuth()
  const navigate = useNavigate()
  const nombre = perfil?.nombre?.split(' ')[0] ?? ''

  // ── Planning de hoy ──────────────────────────────────────
  const { data: planHoy = [], isLoading: loadingPlan } = useQuery({
    queryKey: ['planning-hoy', hogar?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('planning_semanal')
        .select('tipo_comida, recetas(id, titulo, tiempo_coccion, dificultad)')
        .eq('hogar_id', hogar.id)
        .eq('fecha', toDateStr(new Date()))
      return data ?? []
    },
    enabled: !!hogar?.id,
    staleTime: 1000 * 60 * 5,
  })

  // ── Estadísticas ─────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', hogar?.id],
    queryFn: async () => {
      const [recetas, guardadas, lista, miembros] = await Promise.all([
        supabase.from('recetas').select('id', { count: 'exact', head: true }).eq('hogar_id', hogar.id),
        supabase.from('recetas_guardadas').select('id', { count: 'exact', head: true }).eq('hogar_id', hogar.id),
        supabase.from('lista_compra').select('id', { count: 'exact', head: true }).eq('hogar_id', hogar.id).eq('comprado', false),
        supabase.from('perfiles').select('id', { count: 'exact', head: true }).eq('hogar_id', hogar.id),
      ])
      return {
        recetas:   recetas.count   ?? 0,
        guardadas: guardadas.count ?? 0,
        lista:     lista.count     ?? 0,
        miembros:  miembros.count  ?? 0,
      }
    },
    enabled: !!hogar?.id,
    staleTime: 1000 * 60 * 5,
  })

  // ── Últimas recetas del hogar ────────────────────────────
  const { data: ultimasRecetas = [] } = useQuery({
    queryKey: ['ultimas-recetas', hogar?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('recetas')
        .select('id, titulo, tipo_comida, tiempo_coccion, dificultad')
        .eq('hogar_id', hogar.id)
        .order('created_at', { ascending: false })
        .limit(4)
      return data ?? []
    },
    enabled: !!hogar?.id,
    staleTime: 1000 * 60 * 5,
  })

  return (
    <>
      <style>{`
        .dash-grid { display: flex; flex-direction: column; gap: 28px; }

        /* Saludo */
        .saludo-fecha  { font-size: 13px; color: var(--text-3); font-weight: 500; text-transform: capitalize; margin-bottom: 4px; }
        .saludo-row    { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .saludo-titulo { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--text); letter-spacing: -0.5px; line-height: 1.15; }
        .saludo-hogar  { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-3); margin-top: 6px; flex-wrap: wrap; }
        .saludo-hogar strong { color: var(--brand); font-weight: 600; }

        .codigo-badge {
          display: inline-flex; align-items: center; gap: 5px;
          background: var(--brand-pale); color: var(--brand-dark);
          font-size: 11px; font-weight: 700; padding: 5px 12px;
          border-radius: 100px; letter-spacing: 0.06em;
          cursor: pointer; transition: background var(--transition);
          white-space: nowrap; border: 1px solid var(--brand-pale2);
          user-select: none;
        }
        .codigo-badge:hover { background: var(--brand-pale2); }
        .codigo-badge:active { transform: scale(0.97); }

        /* Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        @media (min-width: 500px) { .stats-grid { grid-template-columns: repeat(4, 1fr); } }

        .stat-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px 14px;
          display: flex; flex-direction: column; gap: 10px;
          cursor: pointer; transition: all var(--transition);
        }
        .stat-card:hover { border-color: var(--brand-pale2); box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .stat-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-value { font-family: var(--font-display); font-size: 30px; font-weight: 700; color: var(--text); line-height: 1; }
        .stat-label { font-size: 12px; color: var(--text-3); font-weight: 500; }

        /* Section header */
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .section-title  { font-family: var(--font-display); font-size: 19px; font-weight: 700; color: var(--text); }
        .section-link   {
          display: flex; align-items: center; gap: 4px;
          font-size: 13px; color: var(--brand); font-weight: 600;
          background: none; border: none; cursor: pointer; padding: 4px 0;
          font-family: var(--font-body); text-decoration: none;
        }
        .section-link:hover { opacity: 0.7; }

        /* Menú hoy */
        .menu-hoy { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }

        .menu-slot {
          display: flex; align-items: center; gap: 14px;
          padding: 13px 18px; border-bottom: 1px solid var(--border);
          transition: background var(--transition);
        }
        .menu-slot:last-child { border-bottom: none; }
        .menu-slot.clickable:hover { background: var(--surface-2); cursor: pointer; }

        .menu-slot-emoji { font-size: 20px; width: 28px; text-align: center; flex-shrink: 0; }
        .menu-slot-tipo  { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-3); margin-bottom: 2px; }
        .menu-slot-receta { font-size: 14px; font-weight: 600; color: var(--text); }
        .menu-slot-vacio  { font-size: 13px; color: var(--text-3); }
        .menu-slot-meta   { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
        .menu-slot-tiempo { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--text-3); }

        .menu-skeleton { padding: 13px 18px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid var(--border); }
        .menu-skeleton:last-child { border-bottom: none; }

        /* Recetas grid */
        .recetas-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 580px) { .recetas-grid { grid-template-columns: repeat(4, 1fr); } }

        .receta-mini {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px 14px;
          cursor: pointer; transition: all var(--transition);
          display: flex; flex-direction: column; gap: 8px;
        }
        .receta-mini:hover { border-color: var(--brand-pale2); box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .receta-mini-emoji  { font-size: 26px; }
        .receta-mini-titulo { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .receta-mini-meta   { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--text-3); margin-top: auto; }

        /* CTA */
        .cta-nueva {
          background: linear-gradient(135deg, var(--brand-dark) 0%, var(--brand) 100%);
          border-radius: var(--radius); padding: 22px 20px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          cursor: pointer; transition: opacity var(--transition);
          box-shadow: 0 4px 20px rgba(45,106,79,0.2);
        }
        .cta-nueva:hover { opacity: 0.93; }
        .cta-nueva:active { transform: scale(0.99); }
        .cta-nueva h3 { font-family: var(--font-display); font-size: 18px; color: white; font-weight: 700; margin-bottom: 3px; }
        .cta-nueva p  { font-size: 13px; color: rgba(255,255,255,0.65); line-height: 1.4; }
        .cta-nueva-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: rgba(255,255,255,0.15); border: 1.5px solid rgba(255,255,255,0.25);
          display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;
        }

        @media (min-width: 768px) { .saludo-titulo { font-size: 34px; } }
      `}</style>

      <div className="dash-grid">

        {/* ── Saludo ── */}
        <div>
          <p className="saludo-fecha">{fechaHoy()}</p>
          <div className="saludo-row">
            <div>
              <h1 className="saludo-titulo">¡Hola, {nombre}! 👋</h1>
              <div className="saludo-hogar">
                🏠 <strong>{hogar?.nombre}</strong>
                <span>· {hogar?.num_comensales} {hogar?.num_comensales === 1 ? 'comensal' : 'comensales'}</span>
              </div>
            </div>
            {hogar?.codigo_union && (
              <div
                className="codigo-badge"
                title="Haz clic para copiar el código de invitación"
                onClick={() => {
                  navigator.clipboard?.writeText(hogar.codigo_union)
                }}
              >
                🔑 {hogar.codigo_union}
              </div>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="stats-grid">
          {[
            { label: 'Mis recetas', value: stats?.recetas   ?? '—', icon: BookOpen,    bg: '#D8F3DC', fg: '#2D6A4F', to: '/recetas'  },
            { label: 'Guardadas',   value: stats?.guardadas ?? '—', icon: ChefHat,     bg: '#FEF0E8', fg: '#C4622D', to: '/recetas'  },
            { label: 'Por comprar', value: stats?.lista     ?? '—', icon: ShoppingCart,bg: '#E8F0FE', fg: '#1A5FAB', to: '/lista'    },
            { label: 'En el hogar', value: stats?.miembros  ?? '—', icon: Users,       bg: '#F3E8FE', fg: '#7B3FA0', to: '/ajustes'  },
          ].map(({ label, value, icon: Icon, bg, fg, to }) => (
            <div key={label} className="stat-card" onClick={() => navigate(to)}>
              <div className="stat-icon" style={{ background: bg }}>
                <Icon size={18} color={fg} />
              </div>
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Menú de hoy ── */}
        <div>
          <div className="section-header">
            <h2 className="section-title">Menú de hoy</h2>
            <button className="section-link" onClick={() => navigate('/planning')}>
              Planning <ArrowRight size={14} />
            </button>
          </div>

          <div className="menu-hoy">
            {loadingPlan
              ? TIPOS_COMIDA.map(t => (
                  <div key={t.key} className="menu-skeleton">
                    <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <div className="skeleton" style={{ width: 55, height: 9 }} />
                      <div className="skeleton" style={{ width: '60%', height: 13 }} />
                    </div>
                  </div>
                ))
              : TIPOS_COMIDA.map(tipo => {
                  const slot = planHoy.find(p => p.tipo_comida === tipo.key)
                  return (
                    <div
                      key={tipo.key}
                      className={`menu-slot${slot ? ' clickable' : ''}`}
                      onClick={() => slot && navigate('/planning')}
                    >
                      <span className="menu-slot-emoji">{tipo.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div className="menu-slot-tipo">{tipo.label}</div>
                        {slot?.recetas
                          ? <>
                              <div className="menu-slot-receta">{slot.recetas.titulo}</div>
                              <div className="menu-slot-meta">
                                {slot.recetas.tiempo_coccion && (
                                  <span className="menu-slot-tiempo">
                                    <Clock size={11} /> {slot.recetas.tiempo_coccion} min
                                  </span>
                                )}
                                {slot.recetas.dificultad && (
                                  <span className={`badge ${DIF_COLOR[slot.recetas.dificultad] ?? 'badge-gray'}`}
                                    style={{ fontSize: 10, padding: '1px 7px' }}>
                                    {DIF_LABEL[slot.recetas.dificultad] ?? slot.recetas.dificultad}
                                  </span>
                                )}
                              </div>
                            </>
                          : <div className="menu-slot-vacio">Sin planificar</div>
                        }
                      </div>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* ── Últimas recetas ── */}
        <div>
          <div className="section-header">
            <h2 className="section-title">Mis recetas</h2>
            <button className="section-link" onClick={() => navigate('/recetas')}>
              Ver todas <ArrowRight size={14} />
            </button>
          </div>

          {ultimasRecetas.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📖</div>
                <h3>Sin recetas todavía</h3>
                <p>Crea tu primera receta y aparecerá aquí</p>
              </div>
            </div>
          ) : (
            <div className="recetas-grid">
              {ultimasRecetas.map(r => {
                const emoji = TIPOS_COMIDA.find(t => t.key === r.tipo_comida)?.emoji ?? '🍽️'
                return (
                  <div key={r.id} className="receta-mini" onClick={() => navigate(`/recetas/${r.id}`)}>
                    <div className="receta-mini-emoji">{emoji}</div>
                    <div className="receta-mini-titulo">{r.titulo}</div>
                    {r.tiempo_coccion && (
                      <div className="receta-mini-meta">
                        <Clock size={11} /> {r.tiempo_coccion} min
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── CTA nueva receta ── */}
        <div className="cta-nueva" onClick={() => navigate('/recetas/nueva')}>
          <div>
            <h3>Añade una receta nueva</h3>
            <p>Guarda tus platos favoritos y planifica la semana</p>
          </div>
          <div className="cta-nueva-icon">
            <Plus size={22} />
          </div>
        </div>

      </div>
    </>
  )
}
