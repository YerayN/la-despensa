import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ChevronLeft, ChevronRight, X, Search, Plus, Minus, ArrowUpRight, Printer, ArrowLeft } from 'lucide-react'

const TIPOS = [
  { key:'desayuno', emoji:'🌅', label:'Desayuno', bg:'#FFF7ED', border:'#FED7AA', accent:'#EA580C', text:'#7C2D12' },
  { key:'almuerzo', emoji:'🥗', label:'Almuerzo', bg:'#F0FDF4', border:'#86EFAC', accent:'#16A34A', text:'#14532D' },
  { key:'comida',   emoji:'🍽️', label:'Comida',   bg:'#EFF6FF', border:'#93C5FD', accent:'#2563EB', text:'#1E3A8A' },
  { key:'merienda', emoji:'🍎', label:'Merienda', bg:'#FDF4FF', border:'#D8B4FE', accent:'#9333EA', text:'#581C87' },
  { key:'cena',     emoji:'🌙', label:'Cena',     bg:'#F8FAFC', border:'#CBD5E1', accent:'#475569', text:'#0F172A' },
]

const DIAS_LARGO = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const MESES      = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function getLunes(f) { const d = new Date(f), dia = d.getDay(); d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1)); d.setHours(0,0,0,0); return d }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function toStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export default function PlanningPacientePage() {
  const { id: pacienteId } = useParams()
  const { hogar, user, perfil } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [semana,  setSemana]  = useState(() => getLunes(new Date()))
  const [slot,    setSlot]    = useState(null)
  const [busq,    setBusq]    = useState('')
  const [slotCom, setSlotCom] = useState({})
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printComensales, setPrintComensales] = useState(1)

  const dias   = Array.from({ length:7 }, (_,i) => addDays(semana, i))
  const semKey = toStr(semana)
  const hoyStr = toStr(new Date())

  const mismoMes  = dias[0].getMonth() === dias[6].getMonth()
  const tituloSem = mismoMes
    ? `${dias[0].getDate()}–${dias[6].getDate()} de ${MESES[dias[0].getMonth()]} ${dias[0].getFullYear()}`
    : `${dias[0].getDate()} ${MESES[dias[0].getMonth()]} – ${dias[6].getDate()} ${MESES[dias[6].getMonth()]}`

  // ── TRAER DATOS DEL PACIENTE ──
  const { data: paciente } = useQuery({
    queryKey: ['paciente', pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from('pacientes').select('*').eq('id', pacienteId).single()
      return data
    }
  })

  // ── TRAER PLANNING DEL PACIENTE ──
  const { data: planning = [] } = useQuery({
    queryKey: ['planning_paciente', pacienteId, semKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('planning_pacientes')
        .select(`
          id, fecha, tipo_comida, receta_id, comensales, 
          recetas(id, titulo, tiempo_coccion, tiempo_preparacion, dificultad, pasos, comensales_base,
            receta_ingredientes(cantidad, unidad, notas, ingredientes(nombre))
          )
        `)
        .eq('paciente_id', pacienteId).gte('fecha', toStr(dias[0])).lte('fecha', toStr(dias[6]))
      return data ?? []
    },
    enabled: !!pacienteId,
  })

  // ── TRAER RECETAS (LAS DEL NUTRICIONISTA) ──
  const { data: recetas = [] } = useQuery({
    queryKey: ['recetas-planning', hogar?.id],
    queryFn: async () => {
      const { data: propias } = await supabase.from('recetas').select('id, titulo, tipo_comida, tiempo_coccion').eq('hogar_id', hogar.id)
      const { data: rels } = await supabase.from('recetas_guardadas').select('receta_id').eq('hogar_id', hogar.id)
      let guardadas = []
      if (rels?.length) {
        const ids = rels.map(r => r.receta_id)
        const { data } = await supabase.from('recetas').select('id, titulo, tipo_comida, tiempo_coccion').in('id', ids)
        guardadas = data ?? []
      }
      const todas = [...(propias ?? []), ...guardadas]
      return todas.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i).sort((a, b) => a.titulo.localeCompare(b.titulo))
    },
    enabled: !!hogar?.id,
  })

  const filtradas = recetas.filter(r => !busq || r.titulo.toLowerCase().includes(busq.toLowerCase()))
  const getSlot   = (d, t) => { const s = typeof d === 'string' ? d : toStr(d); return planning.find(p => p.fecha === s && p.tipo_comida === t) }
  const getCom    = (s)    => s ? (slotCom[`${s.fecha}_${s.tipo_comida}`] ?? s.comensales ?? 1) : 1
  const setCom    = (s, n) => setSlotCom(p => ({ ...p, [`${s.fecha}_${s.tipo_comida}`]: n }))

  const asignar = useMutation({
    mutationFn: async (recetaId) => {
      const fechaStr = typeof slot.fecha === 'string' ? slot.fecha : toStr(slot.fecha)
      const com = slotCom[`${fechaStr}_${slot.tipo}`] ?? 1
      const { error } = await supabase.from('planning_pacientes').upsert(
        { paciente_id: pacienteId, fecha: fechaStr, tipo_comida: slot.tipo, receta_id: recetaId, created_by: user.id, comensales: com },
        { onConflict: 'paciente_id,fecha,tipo_comida' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries(['planning_paciente', pacienteId, semKey])
      setSlot(null); setBusq('')
    },
  })

  const borrar = useMutation({
    mutationFn: async ({ d, t }) => {
      const fechaStr = typeof d === 'string' ? d : toStr(d)
      await supabase.from('planning_pacientes').delete().eq('paciente_id', pacienteId).eq('fecha', fechaStr).eq('tipo_comida', t)
    },
    onSuccess: () => qc.invalidateQueries(['planning_paciente', pacienteId, semKey]),
  })

  const camCom = useMutation({
    mutationFn: async ({ s, n }) => {
      if (getCom(s) === n) return
      await supabase.from('planning_pacientes').update({ comensales: n }).eq('id', s.id)
      setCom(s, n)
    },
    onSuccess: () => qc.invalidateQueries(['planning_paciente', pacienteId, semKey]),
  })

  const slotTipo = slot ? TIPOS.find(t => t.key === slot.tipo) : null
  const slotDiaIdx = slot ? dias.findIndex(d => toStr(d) === (typeof slot.fecha === 'string' ? slot.fecha : toStr(slot.fecha))) : -1

  const recetasImprimir = []
  const idsVistos = new Set()
  planning.forEach(p => {
    if (p.recetas && !idsVistos.has(p.receta_id)) {
      idsVistos.add(p.receta_id)
      recetasImprimir.push(p.recetas)
    }
  })

  return (
    <>
      <style>{`
        .page-wrapper { max-width:100% !important; padding:20px 20px 40px !important; }
        @media(min-width:768px) { .page-wrapper { padding:24px 28px 48px !important; } }
        .pln-nav { display:flex; align-items:center; gap:10px; margin-bottom:24px; flex-wrap: wrap; }
        .pln-btn { width:42px; height:42px; border-radius:12px; border:1.5px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-2); flex-shrink:0; transition:all var(--transition); }
        .pln-btn:hover:not(:disabled) { background:var(--brand-pale); border-color:var(--brand); color:var(--brand); }
        .pln-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pln-titulo { flex:1; text-align:center; font-family:var(--font-display); font-size:20px; font-weight:700; color:var(--text); letter-spacing:-0.3px; min-width: 150px; }
        .pln-hoy { padding:9px 18px; border-radius:12px; border:1.5px solid var(--border); background:var(--surface); color:var(--text-2); font-size:13px; font-weight:700; cursor:pointer; transition:all var(--transition); white-space:nowrap; }
        .pln-hoy:hover { background:var(--brand); border-color:var(--brand); color:white; }
        .pln-print-btn { padding:9px 14px; border-radius:12px; border:none; background:linear-gradient(135deg, var(--brand), var(--brand-light)); color:white; font-size:13px; font-weight:700; display:flex; align-items:center; gap:6px; cursor:pointer; transition:opacity var(--transition); }
        .pln-print-btn:hover { opacity:0.9; }
        .pln-grid { display:grid; grid-template-columns:1fr; gap:16px; }
        @media(min-width:600px)  { .pln-grid { grid-template-columns:repeat(2,1fr); gap:16px; } }
        @media(min-width:1000px) { .pln-grid { grid-template-columns:repeat(3,1fr); gap:20px; } }
        .pln-dia { background:var(--surface); border:1.5px solid var(--border); border-radius:20px; overflow:hidden; transition:box-shadow var(--transition); }
        .pln-dia:hover { box-shadow:var(--shadow-md); }
        .pln-dia.hoy { border-color:var(--brand); box-shadow:0 0 0 4px rgba(45,106,79,0.1); }
        .pln-dia-head { padding:16px 18px 14px; display:flex; align-items:center; justify-content:space-between; border-bottom:1.5px solid var(--border); background:var(--surface-2); }
        .pln-dia.hoy .pln-dia-head { background:var(--brand-pale); }
        .pln-dia-left { display:flex; flex-direction:column; gap:1px; }
        .pln-dia-nombre { font-family:var(--font-display); font-size:20px; font-weight:700; color:var(--text); line-height:1; }
        .pln-dia.hoy .pln-dia-nombre { color:var(--brand-dark); }
        .pln-dia-fecha { font-size:13px; color:var(--text-3); margin-top:3px; }
        .pln-dia-num { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-size:20px; font-weight:700; color:var(--text); background:var(--surface); border:1.5px solid var(--border); }
        .pln-dia.hoy .pln-dia-num { background:var(--brand); color:white; border-color:var(--brand); }
        .pln-dia-body { padding:12px; display:flex; flex-direction:column; gap:8px; }
        .pln-slot-vacio { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:14px; border:1.5px dashed var(--border-strong); cursor:pointer; transition:all var(--transition); background:transparent; }
        .pln-slot-vacio:hover { border-color:var(--brand); background:var(--brand-pale); border-style:solid; }
        .pln-sv-emoji { font-size:20px; flex-shrink:0; }
        .pln-sv-txt { flex:1; display:flex; flex-direction:column; gap:1px; }
        .pln-sv-tipo { font-size:13px; font-weight:700; color:var(--text-2); }
        .pln-sv-add { font-size:12px; color:var(--text-3); }
        .pln-sv-icon { width:32px; height:32px; border-radius:9px; background:var(--surface-2); border:1.5px solid var(--border); display:flex; align-items:center; justify-content:center; color:var(--text-3); flex-shrink:0; }
        .pln-slot-lleno { border-radius:14px; border:1.5px solid; overflow:hidden; }
        .pln-sl-head { display:flex; align-items:flex-start; gap:10px; padding:14px 14px 8px; }
        .pln-sl-emoji { font-size:20px; flex-shrink:0; }
        .pln-sl-info  { flex:1; min-width:0; }
        .pln-sl-tipo  { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:3px; }
        .pln-sl-titulo { font-size:15px; font-weight:700; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .pln-sl-del { width:28px; height:28px; flex-shrink:0; border-radius:8px; border:none; background:rgba(255,255,255,0.5); cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .pln-sl-foot { display:flex; align-items:center; padding:4px 14px 12px; gap:8px; border-top:1px solid rgba(0,0,0,0.06); margin-top:4px; }
        .pln-sl-ver { display:flex; align-items:center; gap:5px; padding:7px 12px; border-radius:8px; border:1.5px solid rgba(0,0,0,0.12); background:rgba(255,255,255,0.6); font-family:var(--font-body); font-size:12px; font-weight:700; cursor:pointer; }
        .pln-com { display:flex; align-items:center; gap:6px; margin-left:auto; }
        .pln-com-btn { width:30px; height:30px; border-radius:8px; border:1.5px solid rgba(0,0,0,0.12); background:rgba(255,255,255,0.6); cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .pln-com-val { font-size:14px; font-weight:700; min-width:28px; text-align:center; display:flex; align-items:center; justify-content:center; gap:3px; }
        
        /* Modal General */
        .pln-ov { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:300; display:flex; align-items:flex-end; justify-content:center; }
        @media(min-width:600px) { .pln-ov { align-items:center; padding:24px; } }
        .pln-modal { background:var(--surface); border-radius:22px 22px 0 0; width:100%; max-width:500px; max-height:88dvh; display:flex; flex-direction:column; box-shadow:0 -8px 50px rgba(0,0,0,0.2); }
        @media(min-width:600px) { .pln-modal { border-radius:20px; max-height:74dvh; } }
        .pln-modal-top { padding:20px 20px 0; display:flex; align-items:flex-start; justify-content:space-between; flex-shrink:0; }
        .pln-modal-chip { display:inline-flex; align-items:center; gap:7px; padding:6px 14px; border-radius:100px; font-size:13px; font-weight:700; margin-bottom:6px; border:1.5px solid; }
        .pln-modal-titulo { font-family:var(--font-display); font-size:20px; font-weight:700; color:var(--text); }
        .pln-modal-sub { font-size:14px; color:var(--text-3); margin-top:3px; }
        .pln-modal-cls { width:34px; height:34px; border-radius:10px; border:none; background:var(--surface-2); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-2); flex-shrink:0; margin-left:12px; }
        .pln-modal-busq { padding:16px 18px 12px; flex-shrink:0; position:relative; }
        .pln-modal-busq input { width:100%; padding:11px 16px 11px 38px; border:1.5px solid var(--border); border-radius:12px; font-family:var(--font-body); font-size:14px; color:var(--text); background:var(--surface-2); outline:none; }
        .pln-modal-busq-ico { position:absolute; left:30px; top:50%; transform:translateY(-50%); color:var(--text-3); pointer-events:none; }
        .pln-modal-list { overflow-y:auto; flex:1; border-top:1px solid var(--border); padding:6px; }
        .pln-modal-row { display:flex; align-items:center; gap:14px; padding:10px 12px; border-radius:12px; cursor:pointer; }
        .pln-modal-ico { width:44px; height:44px; border-radius:13px; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; border:1.5px solid; }
        .pln-modal-tit { font-size:15px; font-weight:600; color:var(--text); }
        .pln-modal-sub-r { font-size:13px; color:var(--text-3); margin-top:2px; }

        /* ── PDF PACIENTE ── */
        @media screen { .print-only { display: none !important; } }
        @media print {
          .no-print, .sidebar, .bottom-nav, nav, footer { display: none !important; }
          html, body, #root, .app-shell, .main-content, .page-wrapper {
            height: auto !important; min-height: auto !important; overflow: visible !important; overflow-x: visible !important; display: block !important;
          }
          .main-content { margin-left: 0 !important; padding-bottom: 0 !important; }
          .page-wrapper { padding: 0 !important; max-width: 100% !important; }
          
          .print-only { display: block !important; width: 100%; font-family: 'DM Sans', sans-serif; }
          .pr-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2D6A4F; padding-bottom: 15px; margin-bottom: 25px; }
          .pr-logo-box { display: flex; align-items: center; gap: 12px; }
          .pr-logo-box img { width: 55px; height: 55px; object-fit: contain; border-radius: 8px; }
          .pr-logo-box h1 { font-family: 'Fraunces', serif; font-size: 26px; margin: 0; color: #2D6A4F; }
          .pr-nutri { text-align: right; font-size: 13px; color: #5A7366; }
          
          .pr-titulo-sem { text-align: center; font-family: 'Fraunces', serif; font-size: 22px; margin-bottom: 5px; color: #1A2E22; }
          .pr-sub-sem { text-align: center; font-size: 14px; color: #5A7366; margin-bottom: 20px; }

          .pr-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; page-break-inside: avoid; }
          .pr-table th, .pr-table td { border: 1px solid #E2EBE4; padding: 12px; text-align: left; font-size: 12px; }
          .pr-table th { background: #F8FAF8 !important; font-weight: 700; color: #2D6A4F; text-transform: uppercase; letter-spacing: 0.05em; }
          .pr-table td { vertical-align: top; line-height: 1.4; }
          .pr-dia-celda { font-weight: bold; background: #F8FAF8 !important; width: 120px; }
          .pr-receta-txt { font-weight: 600; color: #1A2E22; display: block; }
          
          .pr-seccion-titulo { font-family: 'Fraunces', serif; font-size: 24px; color: #2D6A4F; border-bottom: 1px solid #E2EBE4; padding-bottom: 10px; margin-bottom: 20px; page-break-before: always; }
          .pr-receta { page-break-inside: avoid; border: 1px solid #E2EBE4; border-radius: 12px; padding: 24px; margin-bottom: 24px; background: #F8FAF8 !important; }
          .pr-receta h3 { font-family: 'Fraunces', serif; font-size: 20px; margin: 0 0 12px 0; color: #2D6A4F; }
          .pr-meta { display: flex; gap: 20px; font-size: 12px; color: #5A7366; margin-bottom: 16px; font-weight: bold; }
          .pr-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 24px; }
          .pr-receta h4 { font-size: 13px; text-transform: uppercase; color: #1A2E22; margin: 0 0 12px 0; letter-spacing: 0.05em; }
          .pr-ing-list { list-style: none; padding: 0; margin: 0; font-size: 12px; line-height: 1.6; }
          .pr-ing-list li { border-bottom: 1px solid #E2EBE4; padding-bottom: 6px; margin-bottom: 6px; }
          .pr-pasos-list { padding-left: 16px; margin: 0; font-size: 12px; line-height: 1.6; color: #1A2E22; }
          .pr-pasos-list li { margin-bottom: 8px; text-align: justify; }
        }
      `}</style>

      <div className="no-print">
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: 16 }}>
          <button className="pln-btn" style={{ width: 36, height: 36 }} onClick={() => navigate('/consulta')}><ArrowLeft size={18} /></button>
          <div>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize: 22, color:'var(--text)', margin:0 }}>{paciente?.nombre || 'Cargando...'}</h2>
            <p style={{ fontSize:13, color:'var(--text-3)', margin:0 }}>Diseñando menú personalizado</p>
          </div>
        </div>

        <div className="pln-nav">
          <button className="pln-btn" onClick={() => setSemana(d => addDays(d, -7))}><ChevronLeft size={20} /></button>
          <button className="pln-hoy" onClick={() => setSemana(getLunes(new Date()))}>HOY</button>
          <button className="pln-btn" onClick={() => setSemana(d => addDays(d, 7))}><ChevronRight size={20} /></button>
          
          <span className="pln-titulo">{tituloSem}</span>
          
          <button className="pln-print-btn" onClick={() => setShowPrintModal(true)}>
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>

        <div className="pln-grid">
          {dias.map((d, i) => {
            const esHoy = toStr(d) === hoyStr
            return (
              <div key={i} className={`pln-dia${esHoy ? ' hoy' : ''}`}>
                <div className="pln-dia-head">
                  <div className="pln-dia-left">
                    <span className="pln-dia-nombre">{DIAS_LARGO[i]}</span>
                    <span className="pln-dia-fecha">{d.getDate()} de {MESES[d.getMonth()]}</span>
                  </div>
                  <div className="pln-dia-num">{d.getDate()}</div>
                </div>

                <div className="pln-dia-body">
                  {TIPOS.map(tipo => {
                    const s   = getSlot(d, tipo.key)
                    const com = getCom(s)

                    if (!s) return (
                      <div key={tipo.key} className="pln-slot-vacio" onClick={() => setSlot({ fecha: toStr(d), tipo: tipo.key })}>
                        <span className="pln-sv-emoji">{tipo.emoji}</span>
                        <div className="pln-sv-txt"><span className="pln-sv-tipo">{tipo.label}</span></div>
                        <div className="pln-sv-icon"><Plus size={16} /></div>
                      </div>
                    )

                    return (
                      <div key={tipo.key} className="pln-slot-lleno" style={{ background: tipo.bg, borderColor: tipo.border }}>
                        <div className="pln-sl-head">
                          <span className="pln-sl-emoji">{tipo.emoji}</span>
                          <div className="pln-sl-info">
                            <div className="pln-sl-tipo" style={{ color: tipo.accent }}>{tipo.label}</div>
                            <div className="pln-sl-titulo" style={{ color: tipo.text }}>{s.recetas?.titulo}</div>
                          </div>
                          <button className="pln-sl-del" style={{ color: tipo.text }} onClick={() => borrar.mutate({ d: toStr(d), t: tipo.key })}><X size={14} /></button>
                        </div>
                        <div className="pln-sl-foot">
                          <button className="pln-sl-ver" style={{ color: tipo.accent }} onClick={() => navigate(`/recetas/${s.receta_id}`)}><ArrowUpRight size={13} /> Ver</button>
                          <div className="pln-com">
                            <button className="pln-com-btn" style={{ color: tipo.text }} onClick={() => camCom.mutate({ s, n: Math.max(1, com - 1) })}><Minus size={12} /></button>
                            <span className="pln-com-val" style={{ color: tipo.text }}>👤 {com}</span>
                            <button className="pln-com-btn" style={{ color: tipo.text }} onClick={() => camCom.mutate({ s, n: com + 1 })}><Plus size={12} /></button>
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

        {slot && slotTipo && (
          <div className="pln-ov" onClick={() => setSlot(null)}>
            <div className="pln-modal" onClick={e => e.stopPropagation()}>
              <div className="pln-modal-top">
                <div>
                  <div className="pln-modal-titulo">¿Qué toca hoy?</div>
                </div>
                <button className="pln-modal-cls" onClick={() => setSlot(null)}><X size={17} /></button>
              </div>
              <div className="pln-modal-busq">
                <Search size={16} className="pln-modal-busq-ico" />
                <input autoFocus placeholder="Buscar entre tus recetas..." value={busq} onChange={e => setBusq(e.target.value)} />
              </div>
              <div className="pln-modal-list">
                {filtradas.map(r => {
                  const t = TIPOS.find(x => x.key === r.tipo_comida)
                  return (
                    <div key={r.id} className="pln-modal-row" onClick={() => asignar.mutate(r.id)}>
                      <div className="pln-modal-ico" style={{ background: t?.bg ?? 'var(--surface-2)', borderColor: t?.border ?? 'var(--border)' }}>{t?.emoji ?? '🍽️'}</div>
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

        {showPrintModal && (
          <div className="pln-ov" onClick={() => setShowPrintModal(false)}>
            <div className="pln-modal" style={{ maxWidth: 420, height: 'auto', paddingBottom: 24 }} onClick={e => e.stopPropagation()}>
              <div className="pln-modal-top">
                <div>
                  <div className="pln-modal-titulo">Imprimir Dieta</div>
                  <div className="pln-modal-sub">Ajusta las cantidades del PDF</div>
                </div>
                <button className="pln-modal-cls" onClick={() => setShowPrintModal(false)}><X size={17} /></button>
              </div>
              <div style={{ padding: '24px 20px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Raciones a calcular para {paciente?.nombre}:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button className="pln-btn" style={{ width: 44, height: 44 }} disabled={printComensales <= 1} onClick={() => setPrintComensales(c => c - 1)}><Minus size={18} /></button>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--brand)', minWidth: 40, textAlign: 'center' }}>{printComensales}</span>
                    <button className="pln-btn" style={{ width: 44, height: 44 }} onClick={() => setPrintComensales(c => c + 1)}><Plus size={18} /></button>
                  </div>
                </div>
                <button className="pln-print-btn" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15 }} onClick={() => { window.print(); setShowPrintModal(false); }}>
                  <Printer size={18} /> Generar PDF para {paciente?.nombre}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="print-only">
        <div className="pr-header">
          <div className="pr-logo-box">
            {/* 🟢 MAGIA: Si el nutri tiene logo, usa el suyo. Si no, usa el de la app 🟢 */}
            <img src={perfil?.logo_url || "/logo.png"} alt="Logo Profesional" />
            <h1>{perfil?.logo_url ? '' : 'La Despensa'}</h1>
          </div>
          <div className="pr-nutri">
            <div style={{fontSize: 14, marginBottom: 4, color: '#1A2E22'}}>Paciente: <strong>{paciente?.nombre}</strong></div>
            Dieta pautada por: <strong style={{fontSize: 14}}>{perfil?.nombre || user?.user_metadata?.nombre}</strong>
          </div>
        </div>

        <h2 className="pr-titulo-sem">Menú Semanal: {tituloSem}</h2>
        <p className="pr-sub-sem">Cantidades ajustadas a <strong>{printComensales} {printComensales === 1 ? 'ración' : 'raciones'}</strong> por comida</p>

        <table className="pr-table">
          <thead>
            <tr>
              <th className="pr-dia-celda">Día</th>
              {TIPOS.map(t => <th key={t.key}>{t.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {dias.map((d, i) => (
              <tr key={i}>
                <td className="pr-dia-celda">{DIAS_LARGO[i]} <br/><span style={{fontWeight: 'normal', color: '#5A7366'}}>{d.getDate()} {MESES[d.getMonth()]}</span></td>
                {TIPOS.map(t => {
                  const slot = getSlot(d, t.key)
                  return <td key={t.key}>{slot ? <span className="pr-receta-txt">{slot.recetas?.titulo}</span> : <span style={{color: '#8FA89A'}}>—</span>}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {recetasImprimir.length > 0 && (
          <>
            <h2 className="pr-seccion-titulo">Detalles de las recetas</h2>
            {recetasImprimir.map(receta => (
              <div key={receta.id} className="pr-receta">
                <h3>{receta.titulo}</h3>
                <div className="pr-meta">
                  {receta.tiempo_preparacion && <span>Prep: {receta.tiempo_preparacion} min</span>}
                  {receta.tiempo_coccion && <span>Cocción: {receta.tiempo_coccion} min</span>}
                </div>
                <div className="pr-grid">
                  <div>
                    <h4>Ingredientes</h4>
                    <ul className="pr-ing-list">
                      {receta.receta_ingredientes?.length > 0 
                        ? receta.receta_ingredientes.map((ing, idx) => {
                            const comBase = receta.comensales_base || 2; 
                            let cantidadAjustada = Math.round(((ing.cantidad / comBase) * printComensales) * 100) / 100;
                            return (
                              <li key={idx}><strong>{cantidadAjustada} {ing.unidad}</strong> de {ing.ingredientes?.nombre}{ing.notas && <span style={{color:'#5A7366'}}> ({ing.notas})</span>}</li>
                            )
                          })
                        : <li>Sin ingredientes especificados.</li>
                      }
                    </ul>
                  </div>
                  <div>
                    <h4>Preparación</h4>
                    <ol className="pr-pasos-list">
                      {Array.isArray(receta.pasos) && receta.pasos.length > 0
                        ? receta.pasos.map((paso, idx) => <li key={idx}>{typeof paso === 'string' ? paso : paso.texto}</li>)
                        : <li>Sin pasos de preparación.</li>
                      }
                    </ol>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}