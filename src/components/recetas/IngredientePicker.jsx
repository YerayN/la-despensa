// src/components/recetas/IngredientePicker.jsx
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Search, X, ChevronLeft, Check } from 'lucide-react'

const UNIDADES = ['g','kg','ml','l','unidad','cucharada','cucharadita','taza','al gusto']

export default function IngredientePicker({ onAñadir, onCerrar }) {
  const [busqueda,      setBusqueda]      = useState('')
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [seleccionado,  setSeleccionado]  = useState(null) // ingrediente elegido
  const [cantidad,      setCantidad]      = useState('')
  const [unidad,        setUnidad]        = useState('g')
  const busqRef = useRef()

  useEffect(() => busqRef.current?.focus(), [])

  // ── Categorías ───────────────────────────────────────────
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categorias_ingredientes')
        .select('id, nombre, icono, orden')
        .order('orden')
      return data ?? []
    },
    staleTime: Infinity,
  })

  // ── Ingredientes de la categoría activa ──────────────────
  const { data: ingsPorCategoria = [], isLoading: loadingCat } = useQuery({
    queryKey: ['ings-categoria', categoriaActiva],
    queryFn: async () => {
      const { data } = await supabase
        .from('ingredientes')
        .select('id, nombre, unidad_base')
        .eq('categoria_id', categoriaActiva)
        .eq('aprobado', true)
        .order('nombre')
      return data ?? []
    },
    enabled: !!categoriaActiva && !busqueda,
  })

  // ── Búsqueda en tiempo real ───────────────────────────────
  const { data: ingsBusqueda = [], isLoading: loadingBusq } = useQuery({
    queryKey: ['ings-busqueda', busqueda],
    queryFn: async () => {
      if (busqueda.length < 2) return []
      const { data } = await supabase
        .from('ingredientes')
        .select('id, nombre, unidad_base, categorias_ingredientes(icono)')
        .ilike('nombre', `%${busqueda}%`)
        .eq('aprobado', true)
        .limit(24)
      return data ?? []
    },
    enabled: busqueda.length >= 2,
  })

  const modosBusqueda = busqueda.length >= 2
  const loading = modosBusqueda ? loadingBusq : loadingCat

  const seleccionar = (ing) => {
    setSeleccionado(ing)
    setUnidad(ing.unidad_base ?? 'g')
    setCantidad('')
  }

  const confirmar = () => {
    if (!cantidad || parseFloat(cantidad) <= 0) return
    onAñadir({
      ingrediente_id: seleccionado.id,
      nombre:         seleccionado.nombre,
      cantidad:       parseFloat(cantidad),
      unidad,
      notas:          '',
    })
    setSeleccionado(null)
    setCantidad('')
  }

  return (
    <>
      <style>{`
        .picker-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.45);
          z-index:300; display:flex; align-items:flex-end; justify-content:center;
        }
        @media(min-width:600px) { .picker-overlay { align-items:center; padding:24px; } }

        .picker-box {
          background:var(--surface); width:100%; max-width:520px;
          border-radius:20px 20px 0 0; max-height:88dvh;
          display:flex; flex-direction:column;
          box-shadow:0 -4px 40px rgba(0,0,0,0.15);
          overflow:hidden;
        }
        @media(min-width:600px) { .picker-box { border-radius:var(--radius); max-height:75dvh; } }

        /* Header */
        .picker-header {
          padding:16px 16px 0; flex-shrink:0;
        }
        .picker-header-row {
          display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;
        }
        .picker-titulo { font-family:var(--font-display); font-size:17px; font-weight:700; color:var(--text); }
        .picker-close {
          width:30px; height:30px; border-radius:8px; border:none;
          background:var(--surface-2); display:flex; align-items:center;
          justify-content:center; cursor:pointer; color:var(--text-2);
          transition:background var(--transition);
        }
        .picker-close:hover { background:var(--border); }

        /* Buscador */
        .picker-busq {
          position:relative; margin-bottom:14px;
        }
        .picker-busq-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-3); pointer-events:none; }
        .picker-busq input {
          width:100%; padding:10px 36px 10px 36px;
          border:1.5px solid var(--border); border-radius:var(--radius-sm);
          font-family:var(--font-body); font-size:14px; color:var(--text);
          background:var(--surface-2); outline:none;
          transition:border-color var(--transition), background var(--transition);
          -webkit-appearance:none;
        }
        .picker-busq input:focus { border-color:var(--brand); background:var(--surface); box-shadow:0 0 0 3px rgba(45,106,79,0.08); }
        .picker-busq input::placeholder { color:var(--text-3); }
        .picker-busq-clear {
          position:absolute; right:10px; top:50%; transform:translateY(-50%);
          width:20px; height:20px; border-radius:50%; border:none;
          background:var(--text-3); color:white; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:background var(--transition);
        }
        .picker-busq-clear:hover { background:var(--text-2); }

        /* Breadcrumb categoría */
        .picker-breadcrumb {
          display:flex; align-items:center; gap:6px; padding:0 0 12px;
          font-size:13px; color:var(--text-3);
        }
        .picker-breadcrumb button {
          background:none; border:none; cursor:pointer; color:var(--brand);
          font-family:var(--font-body); font-size:13px; font-weight:600;
          display:flex; align-items:center; gap:4px; padding:0;
          transition:opacity var(--transition);
        }
        .picker-breadcrumb button:hover { opacity:0.7; }
        .picker-breadcrumb span { color:var(--text-2); font-weight:600; }

        /* Scroll body */
        .picker-body { overflow-y:auto; flex:1; padding:0 16px 16px; }

        /* Grid categorías */
        .cat-grid {
          display:grid; grid-template-columns:repeat(3,1fr); gap:8px;
        }
        @media(min-width:400px) { .cat-grid { grid-template-columns:repeat(4,1fr); } }

        .cat-card {
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:5px; padding:12px 6px; border-radius:12px;
          border:1.5px solid var(--border); background:var(--surface);
          cursor:pointer; transition:all var(--transition);
          text-align:center;
        }
        .cat-card:hover { border-color:var(--brand-pale2); background:var(--brand-pale); transform:translateY(-1px); }
        .cat-card:active { transform:scale(0.97); }
        .cat-card-emoji { font-size:22px; }
        .cat-card-nombre { font-size:10px; font-weight:600; color:var(--text-2); line-height:1.2; }

        /* Grid ingredientes */
        .ing-grid {
          display:grid; grid-template-columns:repeat(2,1fr); gap:8px;
        }
        @media(min-width:400px) { .ing-grid { grid-template-columns:repeat(3,1fr); } }

        .ing-card {
          display:flex; align-items:center; gap:8px; padding:10px 12px;
          border-radius:10px; border:1.5px solid var(--border);
          background:var(--surface); cursor:pointer;
          transition:all var(--transition);
        }
        .ing-card:hover { border-color:var(--brand-pale2); background:var(--brand-pale); }
        .ing-card:active { transform:scale(0.97); }
        .ing-card-icono { font-size:16px; flex-shrink:0; }
        .ing-card-nombre { font-size:12px; font-weight:600; color:var(--text); line-height:1.3;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

        /* Skeleton */
        .ing-skeleton { border-radius:10px; height:48px; }

        /* Mini modal cantidad */
        .cantidad-modal-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.5);
          z-index:400; display:flex; align-items:center; justify-content:center; padding:24px;
        }
        .cantidad-modal {
          background:var(--surface); border-radius:var(--radius);
          padding:20px; width:100%; max-width:300px;
          box-shadow:var(--shadow-lg);
          display:flex; flex-direction:column; gap:14px;
        }
        .cantidad-modal-titulo {
          font-family:var(--font-display); font-size:16px; font-weight:700; color:var(--text);
        }
        .cantidad-modal-ing {
          display:flex; align-items:center; gap:8px;
          background:var(--surface-2); border-radius:var(--radius-sm); padding:10px 12px;
          font-size:14px; font-weight:600; color:var(--text);
        }
        .cantidad-row { display:grid; grid-template-columns:110px 1fr; gap:8px; align-items:end; }
        .cantidad-field { display:flex; flex-direction:column; gap:5px; }
        .cantidad-field label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-3); }
        .cantidad-field input, .cantidad-field select {
          padding:9px 11px; border:1.5px solid var(--border); border-radius:var(--radius-sm);
          font-family:var(--font-body); font-size:14px; color:var(--text);
          background:var(--surface); outline:none; -webkit-appearance:none;
          transition:border-color var(--transition);
        }
        .cantidad-field input:focus, .cantidad-field select:focus {
          border-color:var(--brand); box-shadow:0 0 0 3px rgba(45,106,79,0.1);
        }
        .cantidad-btns { display:flex; gap:8px; }
      `}</style>

      {/* Overlay picker */}
      <div className="picker-overlay" onClick={onCerrar}>
        <div className="picker-box" onClick={e => e.stopPropagation()}>

          <div className="picker-header">
            <div className="picker-header-row">
              <span className="picker-titulo">
                {modosBusqueda ? 'Resultados' : categoriaActiva ? categorias.find(c => c.id === categoriaActiva)?.nombre : 'Añadir ingrediente'}
              </span>
              <button className="picker-close" onClick={onCerrar}><X size={16} /></button>
            </div>

            {/* Buscador */}
            <div className="picker-busq">
              <Search size={15} className="picker-busq-icon" />
              <input
                ref={busqRef}
                placeholder="Buscar ingrediente..."
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setCategoriaActiva(null) }}
              />
              {busqueda && (
                <button className="picker-busq-clear" onClick={() => setBusqueda('')}>
                  <X size={10} />
                </button>
              )}
            </div>

            {/* Breadcrumb si hay categoría activa */}
            {categoriaActiva && !modosBusqueda && (
              <div className="picker-breadcrumb">
                <button onClick={() => setCategoriaActiva(null)}>
                  <ChevronLeft size={13} /> Categorías
                </button>
                <span>›</span>
                <span>{categorias.find(c => c.id === categoriaActiva)?.nombre}</span>
              </div>
            )}
          </div>

          <div className="picker-body">
            {/* Vista: categorías */}
            {!modosBusqueda && !categoriaActiva && (
              <div className="cat-grid">
                {categorias.map(cat => (
                  <div key={cat.id} className="cat-card" onClick={() => setCategoriaActiva(cat.id)}>
                    <span className="cat-card-emoji">{cat.icono}</span>
                    <span className="cat-card-nombre">{cat.nombre}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Vista: ingredientes de categoría */}
            {!modosBusqueda && categoriaActiva && (
              loading
                ? <div className="ing-grid">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton ing-skeleton" />)}</div>
                : ingsPorCategoria.length === 0
                  ? <div className="empty-state"><div className="empty-state-icon">🔍</div><p>Sin ingredientes en esta categoría</p></div>
                  : <div className="ing-grid">
                      {ingsPorCategoria.map(ing => (
                        <div key={ing.id} className="ing-card" onClick={() => seleccionar(ing)}>
                          <span className="ing-card-nombre">{ing.nombre}</span>
                        </div>
                      ))}
                    </div>
            )}

            {/* Vista: resultados búsqueda */}
            {modosBusqueda && (
              loading
                ? <div className="ing-grid">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton ing-skeleton" />)}</div>
                : ingsBusqueda.length === 0
                  ? <div className="empty-state"><div className="empty-state-icon">🔍</div><p>Sin resultados para "{busqueda}"</p></div>
                  : <div className="ing-grid">
                      {ingsBusqueda.map(ing => (
                        <div key={ing.id} className="ing-card" onClick={() => seleccionar(ing)}>
                          <span className="ing-card-icono">{ing.categorias_ingredientes?.icono ?? '🥘'}</span>
                          <span className="ing-card-nombre">{ing.nombre}</span>
                        </div>
                      ))}
                    </div>
            )}
          </div>
        </div>
      </div>

      {/* Mini modal cantidad */}
      {seleccionado && (
        <div className="cantidad-modal-overlay" onClick={() => setSeleccionado(null)}>
          <div className="cantidad-modal" onClick={e => e.stopPropagation()}>
            <div className="cantidad-modal-titulo">¿Cuánto necesitas?</div>
            <div className="cantidad-modal-ing">
              <span>{seleccionado.nombre}</span>
            </div>
            <div className="cantidad-row">
              <div className="cantidad-field">
                <label>Cantidad</label>
                <input
                  type="number" min="0.1" step="0.1"
                  autoFocus
                  placeholder="200"
                  value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmar()}
                />
              </div>
              <div className="cantidad-field">
                <label>Unidad</label>
                <select value={unidad} onChange={e => setUnidad(e.target.value)}>
                  {UNIDADES.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="cantidad-btns">
              <button className="btn btn-primary btn-sm" style={{ flex:1 }}
                onClick={confirmar} disabled={!cantidad || parseFloat(cantidad) <= 0}>
                <Check size={14} /> Añadir
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSeleccionado(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}