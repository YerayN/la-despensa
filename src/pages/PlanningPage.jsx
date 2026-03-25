import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ChevronLeft, ChevronRight, X, Search, Plus, Minus, ArrowUpRight } from 'lucide-react'
import { syncListaConPlanning } from '../lib/syncLista'

const TIPOS = [
  { key:'desayuno', emoji:'🌅', label:'Desayuno', bg:'#FFF7ED', border:'#FED7AA', accent:'#EA580C', text:'#7C2D12' },
  { key:'almuerzo', emoji:'🥗', label:'Almuerzo', bg:'#F0FDF4', border:'#86EFAC', accent:'#16A34A', text:'#14532D' },
  { key:'comida',   emoji:'🍽️', label:'Comida',   bg:'#EFF6FF', border:'#93C5FD', accent:'#2563EB', text:'#1E3A8A' },
  { key:'merienda', emoji:'🍎', label:'Merienda', bg:'#FDF4FF', border:'#D8B4FE', accent:'#9333EA', text:'#581C87' },
  { key:'cena',     emoji:'🌙', label:'Cena',     bg:'#F8FAFC', border:'#CBD5E1', accent:'#475569', text:'#0F172A' },
]

const DIAS_LARGO = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const MESES      = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function getLunes(f) {
  const d = new Date(f), dia = d.getDay()
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1))
  d.setHours(0,0,0,0); return d
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function toStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function PlanningPage() {
  const { hogar, user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [semana,  setSemana]  = useState(() => getLunes(new Date()))
  const [slot,    setSlot]    = useState(null)
  const [busq,    setBusq]    = useState('')
  const [slotCom, setSlotCom] = useState({})

  const dias   = Array.from({ length:7 }, (_,i) => addDays(semana, i))
  const semKey = toStr(semana)
  const hoyStr = toStr(new Date())

  const mismoMes    = dias[0].getMonth() === dias[6].getMonth()
  const tituloSem   = mismoMes
    ? `${dias[0].getDate()}–${dias[6].getDate()} de ${MESES[dias[0].getMonth()]} ${dias[0].getFullYear()}`
    : `${dias[0].getDate()} ${MESES[dias[0].getMonth()]} – ${dias[6].getDate()} ${MESES[dias[6].getMonth()]}`

  const { data: planning = [] } = useQuery({
    queryKey: ['planning', hogar?.id, semKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('planning_semanal')
        .select('id, fecha, tipo_comida, receta_id, comensales, recetas(id, titulo, tiempo_coccion)')
        .eq('hogar_id', hogar.id).gte('fecha', toStr(dias[0])).lte('fecha', toStr(dias[6]))
      return data ?? []
    },
    enabled: !!hogar?.id,
  })

  const { data: recetas = [] } = useQuery({
    queryKey: ['recetas-planning', hogar?.id],
    queryFn: async () => {
      // Recetas propias del hogar
      const { data: propias } = await supabase
        .from('recetas')
        .select('id, titulo, tipo_comida, tiempo_coccion')
        .eq('hogar_id', hogar.id)

      // Recetas guardadas de otros hogares
      const { data: rels } = await supabase
        .from('recetas_guardadas')
        .select('receta_id')
        .eq('hogar_id', hogar.id)

      let guardadas = []
      if (rels?.length) {
        const ids = rels.map(r => r.receta_id)
        const { data } = await supabase
          .from('recetas')
          .select('id, titulo, tipo_comida, tiempo_coccion')
          .in('id', ids)
        guardadas = data ?? []
      }

      // Combinar, deduplicar y ordenar
      const todas = [...(propias ?? []), ...guardadas]
      const unicas = todas.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i)
      return unicas.sort((a, b) => a.titulo.localeCompare(b.titulo))
    },
    enabled: !!hogar?.id,
  })

  const filtradas = recetas.filter(r => !busq || r.titulo.toLowerCase().includes(busq.toLowerCase()))
  const getSlot   = (d, t) => { const s = typeof d === 'string' ? d : toStr(d); return planning.find(p => p.fecha === s && p.tipo_comida === t) }
  const getCom    = (s)    => s ? (slotCom[`${s.fecha}_${s.tipo_comida}`] ?? s.comensales ?? hogar?.num_comensales ?? 2) : hogar?.num_comensales ?? 2
  const setCom    = (s, n) => setSlotCom(p => ({ ...p, [`${s.fecha}_${s.tipo_comida}`]: n }))

  const asignar = useMutation({
    mutationFn: async (recetaId) => {
      const fechaStr = typeof slot.fecha === 'string' ? slot.fecha : toStr(slot.fecha)
      const com  = slotCom[`${fechaStr}_${slot.tipo}`] ?? hogar?.num_comensales ?? 2
      const prev = planning.find(p => p.fecha === fechaStr && p.tipo_comida === slot.tipo)
      const ant  = prev ? { recetaId: prev.receta_id, comensales: getCom(prev) } : null
      const { error } = await supabase.from('planning_semanal').upsert(
        { hogar_id: hogar.id, fecha: fechaStr, tipo_comida: slot.tipo, receta_id: recetaId, created_by: user.id, comensales: com },
        { onConflict: 'hogar_id,fecha,tipo_comida' }
      )
      if (error) throw new Error(error.message)
      await syncListaConPlanning({ supabase, hogarId: hogar.id, recetaId, comensales: com, anterior: ant })
    },
    onSuccess: () => {
      qc.invalidateQueries(['planning', hogar?.id, semKey])
      qc.invalidateQueries(['planning-hoy', hogar?.id])
      qc.invalidateQueries(['lista', hogar?.id])
      setSlot(null); setBusq('')
    },
  })

  const borrar = useMutation({
    mutationFn: async ({ d, t }) => {
      const fechaStr = typeof d === 'string' ? d : toStr(d)
      const s = planning.find(p => p.fecha === fechaStr && p.tipo_comida === t)
      if (s) await syncListaConPlanning({ supabase, hogarId: hogar.id, recetaId: null, comensales: 0, anterior: { recetaId: s.receta_id, comensales: getCom(s) } })
      await supabase.from('planning_semanal').delete().eq('hogar_id', hogar.id).eq('fecha', fechaStr).eq('tipo_comida', t)
    },
    onSuccess: () => {
      qc.invalidateQueries(['planning', hogar?.id, semKey])
      qc.invalidateQueries(['planning-hoy', hogar?.id])
      qc.invalidateQueries(['lista', hogar?.id])
    },
  })

  const camCom = useMutation({
    mutationFn: async ({ s, n }) => {
      const ant = getCom(s)
      if (ant === n) return
      await syncListaConPlanning({ supabase, hogarId: hogar.id, recetaId: s.receta_id, comensales: n, anterior: { recetaId: s.receta_id, comensales: ant } })
      await supabase.from('planning_semanal').update({ comensales: n }).eq('id', s.id)
      setCom(s, n)
    },
    onSuccess: () => {
      qc.invalidateQueries(['planning', hogar?.id, semKey])
      qc.invalidateQueries(['lista', hogar?.id])
    },
  })

  const slotTipo = slot ? TIPOS.find(t => t.key === slot.tipo) : null
  const slotDiaIdx = slot ? dias.findIndex(d => toStr(d) === (typeof slot.fecha === 'string' ? slot.fecha : toStr(slot.fecha))) : -1

  return (
    <>
      <style>{`
        .page-wrapper { max-width:100% !important; padding:20px 20px 40px !important; }
        @media(min-width:768px) { .page-wrapper { padding:24px 28px 48px !important; } }

        /* ── Nav semana ── */
        .pln-nav {
          display:flex; align-items:center; gap:10px; margin-bottom:24px;
        }
        .pln-btn {
          width:42px; height:42px; border-radius:12px;
          border:1.5px solid var(--border); background:var(--surface);
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; color:var(--text-2); flex-shrink:0;
          transition:all var(--transition);
        }
        .pln-btn:hover { background:var(--brand-pale); border-color:var(--brand); color:var(--brand); }
        .pln-titulo {
          flex:1; text-align:center;
          font-family:var(--font-display); font-size:20px; font-weight:700;
          color:var(--text); letter-spacing:-0.3px;
        }
        .pln-hoy {
          padding:9px 18px; border-radius:12px;
          border:1.5px solid var(--border); background:var(--surface);
          color:var(--text-2); font-size:13px; font-weight:700;
          cursor:pointer; font-family:var(--font-body); letter-spacing:0.04em;
          transition:all var(--transition); white-space:nowrap;
        }
        .pln-hoy:hover { background:var(--brand); border-color:var(--brand); color:white; }

        /* ── Grid días ── */
        .pln-grid {
          display:grid;
          grid-template-columns:1fr;
          gap:16px;
        }
        @media(min-width:600px)  { .pln-grid { grid-template-columns:repeat(2,1fr); gap:16px; } }
        @media(min-width:1000px) { .pln-grid { grid-template-columns:repeat(3,1fr); gap:20px; } }

        /* ── Tarjeta día ── */
        .pln-dia {
          background:var(--surface);
          border:1.5px solid var(--border);
          border-radius:20px;
          overflow:hidden;
          transition:box-shadow var(--transition);
        }
        .pln-dia:hover { box-shadow:var(--shadow-md); }
        .pln-dia.hoy {
          border-color:var(--brand);
          box-shadow:0 0 0 4px rgba(45,106,79,0.1);
        }

        /* Cabecera de la tarjeta */
        .pln-dia-head {
          padding:16px 18px 14px;
          display:flex; align-items:center; justify-content:space-between;
          border-bottom:1.5px solid var(--border);
          background:var(--surface-2);
        }
        .pln-dia.hoy .pln-dia-head {
          background:var(--brand-pale);
        }
        .pln-dia-left { display:flex; flex-direction:column; gap:1px; }
        .pln-dia-nombre {
          font-family:var(--font-display); font-size:20px; font-weight:700;
          color:var(--text); line-height:1;
        }
        .pln-dia.hoy .pln-dia-nombre { color:var(--brand-dark); }
        .pln-dia-fecha {
          font-size:13px; color:var(--text-3); margin-top:3px;
        }
        .pln-dia-num {
          width:40px; height:40px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          font-family:var(--font-display); font-size:20px; font-weight:700;
          color:var(--text); background:var(--surface); border:1.5px solid var(--border);
        }
        .pln-dia.hoy .pln-dia-num {
          background:var(--brand); color:white; border-color:var(--brand);
        }

        /* Slots */
        .pln-dia-body {
          padding:12px; display:flex; flex-direction:column; gap:8px;
        }

        /* Slot vacío */
        .pln-slot-vacio {
          display:flex; align-items:center; gap:12px;
          padding:14px 16px; border-radius:14px;
          border:1.5px dashed var(--border-strong);
          cursor:pointer; transition:all var(--transition);
          background:transparent;
        }
        .pln-slot-vacio:hover {
          border-color:var(--brand); background:var(--brand-pale);
          border-style:solid;
        }
        .pln-sv-emoji { font-size:20px; flex-shrink:0; }
        .pln-sv-txt {
          flex:1; display:flex; flex-direction:column; gap:1px;
        }
        .pln-sv-tipo {
          font-size:13px; font-weight:700; color:var(--text-2);
        }
        .pln-slot-vacio:hover .pln-sv-tipo { color:var(--brand); }
        .pln-sv-add {
          font-size:12px; color:var(--text-3);
        }
        .pln-slot-vacio:hover .pln-sv-add { color:var(--brand-light); }
        .pln-sv-icon {
          width:32px; height:32px; border-radius:9px;
          background:var(--surface-2); border:1.5px solid var(--border);
          display:flex; align-items:center; justify-content:center;
          color:var(--text-3); flex-shrink:0; transition:all var(--transition);
        }
        .pln-slot-vacio:hover .pln-sv-icon {
          background:var(--brand); border-color:var(--brand); color:white;
        }

        /* Slot lleno */
        .pln-slot-lleno {
          border-radius:14px; border:1.5px solid; overflow:hidden;
        }
        .pln-sl-head {
          display:flex; align-items:flex-start; gap:10px; padding:14px 14px 8px;
        }
        .pln-sl-emoji { font-size:20px; flex-shrink:0; }
        .pln-sl-info  { flex:1; min-width:0; }
        .pln-sl-tipo  {
          font-size:11px; font-weight:800; text-transform:uppercase;
          letter-spacing:0.08em; margin-bottom:3px;
        }
        .pln-sl-titulo {
          font-size:15px; font-weight:700; line-height:1.35;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
        }
        .pln-sl-del {
          width:28px; height:28px; flex-shrink:0; border-radius:8px;
          border:none; background:rgba(255,255,255,0.5); cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:all var(--transition);
        }
        .pln-sl-del:hover { background:white; color:#DC2626 !important; }

        /* Footer slot lleno */
        .pln-sl-foot {
          display:flex; align-items:center; padding:4px 14px 12px; gap:8px;
          border-top:1px solid rgba(0,0,0,0.06); margin-top:4px;
        }
        .pln-sl-ver {
          display:flex; align-items:center; gap:5px;
          padding:7px 12px; border-radius:8px;
          border:1.5px solid rgba(0,0,0,0.12); background:rgba(255,255,255,0.6);
          font-family:var(--font-body); font-size:12px; font-weight:700;
          cursor:pointer; transition:all var(--transition);
        }
        .pln-sl-ver:hover { background:white; }

        /* Control comensales */
        .pln-com {
          display:flex; align-items:center; gap:6px; margin-left:auto;
        }
        .pln-com-btn {
          width:30px; height:30px; border-radius:8px;
          border:1.5px solid rgba(0,0,0,0.12); background:rgba(255,255,255,0.6);
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          transition:all var(--transition);
        }
        .pln-com-btn:hover { background:white; }
        .pln-com-val {
          font-size:14px; font-weight:700; min-width:28px; text-align:center;
          display:flex; align-items:center; justify-content:center; gap:3px;
        }

        /* ── Modal ── */
        .pln-ov {
          position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:300;
          display:flex; align-items:flex-end; justify-content:center;
        }
        @media(min-width:600px) { .pln-ov { align-items:center; padding:24px; } }
        .pln-modal {
          background:var(--surface); border-radius:22px 22px 0 0;
          width:100%; max-width:500px; max-height:88dvh;
          display:flex; flex-direction:column;
          box-shadow:0 -8px 50px rgba(0,0,0,0.2);
        }
        @media(min-width:600px) { .pln-modal { border-radius:20px; max-height:74dvh; } }
        .pln-modal-top {
          padding:20px 20px 0;
          display:flex; align-items:flex-start; justify-content:space-between; flex-shrink:0;
        }
        .pln-modal-chip {
          display:inline-flex; align-items:center; gap:7px;
          padding:6px 14px; border-radius:100px;
          font-size:13px; font-weight:700; margin-bottom:6px; border:1.5px solid;
        }
        .pln-modal-titulo { font-family:var(--font-display); font-size:20px; font-weight:700; color:var(--text); }
        .pln-modal-sub    { font-size:14px; color:var(--text-3); margin-top:3px; }
        .pln-modal-cls {
          width:34px; height:34px; border-radius:10px; border:none;
          background:var(--surface-2); display:flex; align-items:center;
          justify-content:center; cursor:pointer; color:var(--text-2);
          flex-shrink:0; margin-left:12px; transition:background var(--transition);
        }
        .pln-modal-cls:hover { background:var(--border); }
        .pln-modal-busq {
          padding:16px 18px 12px; flex-shrink:0; position:relative;
        }
        .pln-modal-busq input {
          width:100%; padding:11px 16px 11px 38px;
          border:1.5px solid var(--border); border-radius:12px;
          font-family:var(--font-body); font-size:14px; color:var(--text);
          background:var(--surface-2); outline:none; -webkit-appearance:none;
          transition:all var(--transition);
        }
        .pln-modal-busq input:focus { border-color:var(--brand); background:var(--surface); box-shadow:0 0 0 3px rgba(45,106,79,0.1); }
        .pln-modal-busq input::placeholder { color:var(--text-3); }
        .pln-modal-busq-ico { position:absolute; left:30px; top:50%; transform:translateY(-50%); color:var(--text-3); pointer-events:none; }
        .pln-modal-list { overflow-y:auto; flex:1; border-top:1px solid var(--border); }
        .pln-modal-row {
          display:flex; align-items:center; gap:14px; padding:10px 12px;
          border-bottom:1px solid var(--border); cursor:pointer; transition:background var(--transition);
        }
        .pln-modal-row:last-child { border-bottom:none; }
        .pln-modal-list { padding:6px; }
        .pln-modal-row { border-radius:12px; border-bottom:none !important; }
        .pln-modal-row:hover { background:var(--surface-2); }
        .pln-modal-ico {
          width:44px; height:44px; border-radius:13px;
          display:flex; align-items:center; justify-content:center;
          font-size:22px; flex-shrink:0; border:1.5px solid;
        }
        .pln-modal-tit { font-size:15px; font-weight:600; color:var(--text); }
        .pln-modal-sub-r { font-size:13px; color:var(--text-3); margin-top:2px; }
      `}</style>

      {/* Nav */}
      <div className="pln-nav">
        <button className="pln-btn" onClick={() => setSemana(d => addDays(d, -7))}>
          <ChevronLeft size={20} />
        </button>
        <span className="pln-titulo">{tituloSem}</span>
        <button className="pln-hoy" onClick={() => setSemana(getLunes(new Date()))}>HOY</button>
        <button className="pln-btn" onClick={() => setSemana(d => addDays(d, 7))}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Grid */}
      <div className="pln-grid">
        {dias.map((d, i) => {
          const esHoy = toStr(d) === hoyStr
          return (
            <div key={i} className={`pln-dia${esHoy ? ' hoy' : ''}`}>
              {/* Cabecera */}
              <div className="pln-dia-head">
                <div className="pln-dia-left">
                  <span className="pln-dia-nombre">{DIAS_LARGO[i]}</span>
                  <span className="pln-dia-fecha">{d.getDate()} de {MESES[d.getMonth()]}</span>
                </div>
                <div className="pln-dia-num">{d.getDate()}</div>
              </div>

              {/* Slots */}
              <div className="pln-dia-body">
                {TIPOS.map(tipo => {
                  const s   = getSlot(d, tipo.key)
                  const com = getCom(s)

                  if (!s) return (
                    <div key={tipo.key} className="pln-slot-vacio"
                      onClick={() => setSlot({ fecha: toStr(d), tipo: tipo.key })}>
                      <span className="pln-sv-emoji">{tipo.emoji}</span>
                      <div className="pln-sv-txt">
                        <span className="pln-sv-tipo">{tipo.label}</span>
                        <span className="pln-sv-add">Toca para añadir</span>
                      </div>
                      <div className="pln-sv-icon">
                        <Plus size={16} />
                      </div>
                    </div>
                  )

                  return (
                    <div key={tipo.key} className="pln-slot-lleno"
                      style={{ background: tipo.bg, borderColor: tipo.border }}>
                      <div className="pln-sl-head">
                        <span className="pln-sl-emoji">{tipo.emoji}</span>
                        <div className="pln-sl-info">
                          <div className="pln-sl-tipo" style={{ color: tipo.accent }}>{tipo.label}</div>
                          <div className="pln-sl-titulo" style={{ color: tipo.text }}>{s.recetas?.titulo}</div>
                        </div>
                        <button className="pln-sl-del" style={{ color: tipo.text }}
                          onClick={() => borrar.mutate({ d: toStr(d), t: tipo.key })}>
                          <X size={14} />
                        </button>
                      </div>
                      <div className="pln-sl-foot">
                        <button className="pln-sl-ver" style={{ color: tipo.accent }}
                          onClick={() => navigate(`/recetas/${s.receta_id}`)}>
                          <ArrowUpRight size={13} /> Ver receta
                        </button>
                        <div className="pln-com">
                          <button className="pln-com-btn" style={{ color: tipo.text }}
                            onClick={() => camCom.mutate({ s, n: Math.max(1, com - 1) })}>
                            <Minus size={12} />
                          </button>
                          <span className="pln-com-val" style={{ color: tipo.text }}>
                            👤 {com}
                          </span>
                          <button className="pln-com-btn" style={{ color: tipo.text }}
                            onClick={() => camCom.mutate({ s, n: com + 1 })}>
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {slot && slotTipo && (
        <div className="pln-ov" onClick={() => setSlot(null)}>
          <div className="pln-modal" onClick={e => e.stopPropagation()}>
            <div className="pln-modal-top">
              <div>
                <div className="pln-modal-chip"
                  style={{ background: slotTipo.bg, color: slotTipo.text, borderColor: slotTipo.border }}>
                  {slotTipo.emoji} {slotTipo.label}
                </div>
                <div className="pln-modal-titulo">¿Qué coméis?</div>
                <div className="pln-modal-sub">
                  {DIAS_LARGO[slotDiaIdx]}, {slot.fecha.split('-')[2]} de {MESES[parseInt(slot.fecha.split('-')[1]) - 1]}
                </div>
              </div>
              <button className="pln-modal-cls" onClick={() => setSlot(null)}><X size={17} /></button>
            </div>
            <div className="pln-modal-busq">
              <Search size={16} className="pln-modal-busq-ico" />
              <input autoFocus placeholder="Buscar entre tus recetas..."
                value={busq} onChange={e => setBusq(e.target.value)} />
            </div>
            <div className="pln-modal-list">
              {filtradas.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📖</div>
                  <p>{busq ? `Sin resultados para "${busq}"` : 'Aún no tienes recetas'}</p>
                </div>
              ) : filtradas.map(r => {
                const t = TIPOS.find(x => x.key === r.tipo_comida)
                return (
                  <div key={r.id} className="pln-modal-row" onClick={() => asignar.mutate(r.id)}>
                    <div className="pln-modal-ico"
                      style={{ background: t?.bg ?? 'var(--surface-2)', borderColor: t?.border ?? 'var(--border)' }}>
                      {t?.emoji ?? '🍽️'}
                    </div>
                    <div>
                      <div className="pln-modal-tit">{r.titulo}</div>
                      {r.tiempo_coccion && <div className="pln-modal-sub-r">⏱ {r.tiempo_coccion} min</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}