import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, X, ShoppingCart, CheckCircle2 } from 'lucide-react'
import IngredientePicker from '../components/recetas/IngredientePicker'

export default function ListaPage() {
  const { hogar } = useAuth()
  const qc = useQueryClient()

  const [pickerAbierto, setPickerAbierto] = useState(false)
  const [verComprados, setVerComprados]   = useState(false)
  const [editandoId, setEditandoId]     = useState(null)
  const [editValor,  setEditValor]      = useState('')

  // ── Items de la lista ────────────────────────────────────
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['lista', hogar?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lista_compra')
        .select(`id, cantidad, unidad, comprado, manual, nombre_libre,
          ingredientes(nombre, categorias_ingredientes(nombre, icono, orden))`)
        .eq('hogar_id', hogar.id)
        .order('comprado', { ascending: true })
      return data ?? []
    },
    enabled: !!hogar?.id,
  })

  // ── Marcar/desmarcar comprado ────────────────────────────
  const toggleComprado = useMutation({
    mutationFn: async ({ id, comprado }) =>
      supabase.from('lista_compra').update({ comprado: !comprado }).eq('id', id),
    onSuccess: () => qc.invalidateQueries(['lista', hogar?.id]),
  })

  // ── Añadir item ──────────────────────────────────────────
  const añadir = useMutation({
    mutationFn: async ({ ingrediente_id, cantidad, unidad }) => {
      await supabase.from('lista_compra').upsert({
        hogar_id:       hogar.id,
        ingrediente_id,
        cantidad:       parseFloat(cantidad),
        unidad,
        manual:         true,
        semana_inicio:  null,
      }, { onConflict: 'hogar_id,ingrediente_id,semana_inicio' })
    },
    onSuccess: () => {
      qc.invalidateQueries(['lista', hogar?.id])
      setPickerAbierto(false)
    },
  })

  // ── Eliminar item ────────────────────────────────────────
  const eliminar = useMutation({
    mutationFn: async (id) => supabase.from('lista_compra').delete().eq('id', id),
    onSuccess: () => qc.invalidateQueries(['lista', hogar?.id]),
  })

  // ── Actualizar cantidad ─────────────────────────────────────
  const actualizarCantidad = useMutation({
    mutationFn: async ({ id, cantidad }) => {
      if (parseFloat(cantidad) <= 0) throw new Error('La cantidad debe ser mayor que 0')
      await supabase.from('lista_compra').update({ cantidad: parseFloat(cantidad) }).eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries(['lista', hogar?.id])
      setEditandoId(null)
    },
  })

  // ── Limpiar comprados ────────────────────────────────────
  const limpiarComprados = useMutation({
    mutationFn: async () =>
      supabase.from('lista_compra').delete().eq('hogar_id', hogar.id).eq('comprado', true),
    onSuccess: () => qc.invalidateQueries(['lista', hogar?.id]),
  })

  // ── Agrupar por categoría ────────────────────────────────
  const pendientes = items.filter(i => !i.comprado)
  const comprados  = items.filter(i => i.comprado)

  const agrupar = (lista) => {
    const grupos = {}
    for (const item of lista) {
      const cat    = item.ingredientes?.categorias_ingredientes
      const nombre = cat?.nombre ?? 'Otros'
      const icono  = cat?.icono  ?? '🛒'
      const orden  = cat?.orden  ?? 99
      if (!grupos[nombre]) grupos[nombre] = { icono, orden, items: [] }
      grupos[nombre].items.push(item)
    }
    return Object.entries(grupos).sort((a, b) => a[1].orden - b[1].orden)
  }

  const gruposPendientes = agrupar(pendientes)
  const gruposComprados  = agrupar(comprados)

  const nombreItem = (item) => item.ingredientes?.nombre ?? item.nombre_libre ?? '—'

  return (
    <>
      <style>{`
        .lista-header-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:10px; }
        .lista-resumen { font-size:13px; color:var(--text-3); margin-top:2px; }

        .grupo-label {
          display:flex; align-items:center; gap:8px;
          padding:10px 0 6px;
          font-size:11px; font-weight:700; text-transform:uppercase;
          letter-spacing:0.07em; color:var(--text-3);
        }

        .item-row {
          display:flex; align-items:center; gap:12px;
          background:var(--surface); border:1px solid var(--border);
          border-radius:var(--radius-sm); padding:12px 14px;
          margin-bottom:6px; transition:all var(--transition);
        }
        .item-row.comprado { opacity:0.5; }

        .check-btn {
          width:26px; height:26px; border-radius:50%; border:2px solid var(--border);
          background:transparent; cursor:pointer; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          transition:all var(--transition); color:transparent;
        }
        .check-btn:hover { border-color:var(--brand); }
        .check-btn.checked { background:var(--brand); border-color:var(--brand); color:white; }

        .item-nombre { font-size:14px; font-weight:600; color:var(--text); flex:1; }
        .item-nombre.tachado { text-decoration:line-through; color:var(--text-3); }
        .item-cantidad { font-size:13px; color:var(--text-3); font-weight:500; white-space:nowrap; }

        .item-del { background:none; border:none; color:var(--text-3); cursor:pointer; padding:4px; border-radius:6px; transition:all var(--transition); }
        .item-del:hover { background:var(--surface-2); color:#DC2626; }

        .comprados-toggle {
          display:flex; align-items:center; gap:8px; padding:10px 0;
          cursor:pointer; font-size:13px; font-weight:600; color:var(--text-3);
          background:none; border:none; font-family:var(--font-body);
          transition:color var(--transition);
        }
        .comprados-toggle:hover { color:var(--text-2); }

        .btn-limpiar { font-size:12px; color:#DC2626; }
        .btn-limpiar:hover { opacity:0.75; }


        .fab { position:fixed; bottom:calc(var(--nav-h) + 16px); right:16px; width:52px; height:52px; border-radius:16px; background:linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%); border:none; color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 20px rgba(45,106,79,0.35); transition:all var(--transition); z-index:50; }
        .fab:hover { transform:scale(1.07); }
        .fab:active { transform:scale(0.96); }
        @media(min-width:768px) { .fab { bottom:24px; right:28px; } }
      `}</style>

      {/* Header */}
      <div className="lista-header-row">
        <div>
          <h1 className="page-title">Lista de la compra</h1>
          <p className="lista-resumen">
            {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}
            {comprados.length > 0 && ` · ${comprados.length} comprado${comprados.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {/* Botón escritorio */}
        <button className="btn btn-primary" style={{ display:'none' }} id="btn-add-desktop"
          onClick={() => setPickerAbierto(true)}>
          <Plus size={16} /> Añadir
        </button>
        <style>{`@media(min-width:768px){ #btn-add-desktop{ display:flex !important; } .fab{ display:none; } }`}</style>
      </div>

      {/* ── Lista pendientes ── */}
      {isLoading ? (
        [1,2,3,4].map(i => (
          <div key={i} className="skeleton" style={{ height:52, borderRadius:10, marginBottom:6 }} />
        ))
      ) : pendientes.length === 0 && comprados.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><ShoppingCart size={36} strokeWidth={1.5} /></div>
            <h3>La lista está vacía</h3>
            <p>Añade productos con el botón + o genera la lista desde el Planning</p>
          </div>
        </div>
      ) : (
        <>
          {gruposPendientes.map(([cat, { icono, items: catItems }]) => (
            <div key={cat}>
              <div className="grupo-label">{icono} {cat}</div>
              {catItems.map(item => (
                <div key={item.id} className="item-row">
                  <button
                    className={`check-btn${item.comprado ? ' checked' : ''}`}
                    onClick={() => toggleComprado.mutate({ id: item.id, comprado: item.comprado })}
                  >
                    {item.comprado && <CheckCircle2 size={14} />}
                  </button>
                  <span className={`item-nombre${item.comprado ? ' tachado' : ''}`}>
                    {nombreItem(item)}
                  </span>
                  {editandoId === item.id ? (
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <input
                        type="number" min="0.1" step="0.1"
                        autoFocus
                        value={editValor}
                        onChange={e => setEditValor(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') actualizarCantidad.mutate({ id: item.id, cantidad: editValor })
                          if (e.key === 'Escape') setEditandoId(null)
                        }}
                        style={{ width:64, padding:'4px 7px', border:'1.5px solid var(--brand)', borderRadius:6, fontFamily:'var(--font-body)', fontSize:13, outline:'none', textAlign:'right' }}
                      />
                      <span style={{ fontSize:12, color:'var(--text-3)' }}>{item.unidad}</span>
                      <button style={{ background:'var(--brand)', border:'none', borderRadius:6, color:'white', padding:'4px 8px', cursor:'pointer', fontSize:12, fontWeight:600 }}
                        onClick={() => actualizarCantidad.mutate({ id: item.id, cantidad: editValor })}>✓</button>
                      <button style={{ background:'var(--surface-2)', border:'none', borderRadius:6, color:'var(--text-3)', padding:'4px 7px', cursor:'pointer', fontSize:12 }}
                        onClick={() => setEditandoId(null)}>✕</button>
                    </div>
                  ) : (
                    <span
                      className="item-cantidad"
                      title="Toca para editar"
                      style={{ cursor:'pointer', borderBottom:'1px dashed var(--border)' }}
                      onClick={() => { setEditandoId(item.id); setEditValor(String(item.cantidad)) }}
                    >
                      {item.cantidad} {item.unidad}
                    </span>
                  )}
                  <button className="item-del" onClick={() => eliminar.mutate(item.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ))}

          {/* Comprados */}
          {comprados.length > 0 && (
            <>
              <button className="comprados-toggle" onClick={() => setVerComprados(v => !v)}>
                <CheckCircle2 size={16} />
                {comprados.length} comprado{comprados.length !== 1 ? 's' : ''}
                <span style={{ marginLeft:'auto', fontSize:12 }}>{verComprados ? '▲' : '▼'}</span>
                <button
                  className="btn btn-ghost btn-sm btn-limpiar"
                  onClick={e => { e.stopPropagation(); limpiarComprados.mutate() }}
                >
                  Limpiar
                </button>
              </button>

              {verComprados && gruposComprados.map(([cat, { icono, items: catItems }]) => (
                <div key={cat}>
                  <div className="grupo-label">{icono} {cat}</div>
                  {catItems.map(item => (
                    <div key={item.id} className="item-row comprado">
                      <button
                        className="check-btn checked"
                        onClick={() => toggleComprado.mutate({ id: item.id, comprado: item.comprado })}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <span className="item-nombre tachado">{nombreItem(item)}</span>
                      <span className="item-cantidad">{item.cantidad} {item.unidad}</span>
                      <button className="item-del" onClick={() => eliminar.mutate(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* FAB móvil */}
      <button className="fab" onClick={() => setPickerAbierto(true)}>
        <Plus size={24} />
      </button>

      {/* ── Picker ingredientes ── */}
      {pickerAbierto && (
        <IngredientePicker
          onCerrar={() => setPickerAbierto(false)}
          onAñadir={(ing) => añadir.mutate(ing)}
        />
      )}
    </>
  )
}