import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { syncListaConPlanning } from '../lib/syncLista'
import IngredientePicker from '../components/recetas/IngredientePicker'
import {
  ArrowLeft, Plus, Trash2, Camera, X, Loader
} from 'lucide-react'

const TIPOS = ['desayuno','almuerzo','comida','merienda','cena']
const DIFS  = ['facil','media','dificil']
const DIF_LABEL = { facil:'Fácil', media:'Media', dificil:'Difícil' }
const UNIDADES = ['g','kg','ml','l','unidad','cucharada','cucharadita','taza','al gusto']

// ── Comprime imagen en el navegador antes de subir ───────────
async function comprimirImagen(file, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale  = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = img.width  * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/jpeg', quality)
    }
    img.src = url
  })
}

export default function RecetaForm() {
  const { id } = useParams()          // si existe → modo edición
  const navigate  = useNavigate()
  const { user, hogar } = useAuth()
  const qc = useQueryClient()
  const fileRef = useRef()

  const esEdicion = !!id

  // ── Campos del formulario ────────────────────────────────
  const [titulo,      setTitulo]      = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo,        setTipo]        = useState('comida')
  const [dificultad,  setDificultad]  = useState('facil')
  const [tiempoPrep,  setTiempoPrep]  = useState('')
  const [tiempoCoc,   setTiempoCoc]   = useState('')
  const [comensales,  setComensales]  = useState(2)
  const [publica,     setPublica]     = useState(false)
  const [pasos,       setPasos]       = useState([''])
  const [tags,        setTags]        = useState('')
  const [ingredientes,setIngredientes]= useState([
    { ingrediente_id:'', nombre:'', cantidad:'', unidad:'g', notas:'' }
  ])

  // ── Imagen ───────────────────────────────────────────────
  const [imagenPreview, setImagenPreview] = useState(null) // URL preview local
  const [imagenFile,    setImagenFile]    = useState(null) // File a subir
  const [imagenUrl,     setImagenUrl]     = useState(null) // URL ya guardada (edición)
  const [subiendoImg,   setSubiendoImg]   = useState(false)

  // ── Estado general ───────────────────────────────────────
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // ── Picker de ingredientes ───────────────────────────────────────
  const [pickerAbierto, setPickerAbierto] = useState(false)

  // ── Cargar datos en modo edición ─────────────────────────
  const { data: recetaEditar } = useQuery({
    queryKey: ['receta-editar', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('recetas')
        .select('*, receta_ingredientes(cantidad, unidad, notas, ingrediente_id, ingredientes(nombre))')
        .eq('id', id).single()
      return data
    },
    enabled: esEdicion,
    staleTime: Infinity,
  })

  // Poblar formulario cuando llegan los datos (useEffect en vez de onSuccess, deprecado en v5)
  useEffect(() => {
    if (!esEdicion || !recetaEditar) return
    setTitulo(recetaEditar.titulo ?? '')
    setDescripcion(recetaEditar.descripcion ?? '')
    setTipo(recetaEditar.tipo_comida ?? 'comida')
    setDificultad(recetaEditar.dificultad ?? 'facil')
    setTiempoPrep(recetaEditar.tiempo_preparacion ?? '')
    setTiempoCoc(recetaEditar.tiempo_coccion ?? '')
    setComensales(recetaEditar.comensales_base ?? 2)
    setPublica(recetaEditar.publica ?? false)
    setTags(recetaEditar.tags?.join(', ') ?? '')
    setPasos(
      Array.isArray(recetaEditar.pasos) && recetaEditar.pasos.length > 0
        ? recetaEditar.pasos.map(p => typeof p === 'string' ? p : p.texto ?? '')
        : ['']
    )
    setIngredientes(
      recetaEditar.receta_ingredientes?.length > 0
        ? recetaEditar.receta_ingredientes.map(ri => ({
            ingrediente_id: ri.ingrediente_id,
            nombre:         ri.ingredientes?.nombre ?? '',
            cantidad:       ri.cantidad ?? '',
            unidad:         ri.unidad ?? 'g',
            notas:          ri.notas ?? '',
          }))
        : []
    )
    if (recetaEditar.imagen_url) {
      setImagenUrl(recetaEditar.imagen_url)
      setImagenPreview(recetaEditar.imagen_url)
    }
  }, [recetaEditar])

  // ── Seleccionar imagen ───────────────────────────────────
  const handleImagenChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Preview inmediato
    setImagenPreview(URL.createObjectURL(file))
    setImagenFile(file)
  }

  const quitarImagen = () => {
    setImagenPreview(null)
    setImagenFile(null)
    setImagenUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Subir imagen a Supabase Storage ─────────────────────
  const subirImagen = async () => {
    if (!imagenFile) return imagenUrl // si no hay archivo nuevo, devuelve la URL existente
    setSubiendoImg(true)
    try {
      const blob     = await comprimirImagen(imagenFile)
      const ext      = 'jpg'
      const path     = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('recetas')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('recetas').getPublicUrl(path)
      return publicUrl
    } finally {
      setSubiendoImg(false)
    }
  }

  // ── Guardar receta ───────────────────────────────────────
  const guardar = useMutation({
    mutationFn: async () => {
      setError('')
      if (!titulo.trim()) throw new Error('El título es obligatorio.')
      const pasosLimpios = pasos.filter(p => p.trim())
      if (pasosLimpios.length === 0) throw new Error('Añade al menos un paso de preparación.')

      // Con el nuevo picker todos los ingredientes tienen id y cantidad garantizados
      const ingsValidos = ingredientes.filter(i => i.ingrediente_id && i.cantidad)

      const tagsArr = tags.split(',').map(t => t.trim()).filter(Boolean)

      const urlFinal = await subirImagen()

      const payload = {
        titulo:             titulo.trim(),
        descripcion:        descripcion.trim() || null,
        tipo_comida:        tipo,
        dificultad,
        tiempo_preparacion: tiempoPrep ? parseInt(tiempoPrep) : null,
        tiempo_coccion:     tiempoCoc  ? parseInt(tiempoCoc)  : null,
        comensales_base:    comensales,
        publica,
        pasos:              pasosLimpios,
        tags:               tagsArr,
        imagen_url:         urlFinal ?? null,
        hogar_id:           hogar.id,
        autor_id:           user.id,
      }

      let recetaId = id

      if (esEdicion) {
        const { error } = await supabase.from('recetas').update(payload).eq('id', id)
        if (error) throw new Error(error.message)
        await supabase.from('receta_ingredientes').delete().eq('receta_id', id)
      } else {
        const { data, error } = await supabase.from('recetas').insert(payload).select('id').single()
        if (error) throw new Error(error.message)
        recetaId = data.id
      }

      if (ingsValidos.length > 0) {
        const { error } = await supabase.from('receta_ingredientes').insert(
          ingsValidos.map(i => ({
            receta_id:      recetaId,
            ingrediente_id: i.ingrediente_id,
            cantidad:       parseFloat(i.cantidad),
            unidad:         i.unidad,
            notas:          i.notas || null,
          }))
        )
        if (error) throw new Error(error.message)
      }

      // Si es edición, recalcular lista para todos los slots del planning
      // que usen esta receta en la semana actual
      if (esEdicion) {
        const hoy = new Date()
        const inicioSemana = new Date(hoy)
        inicioSemana.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
        const finSemana = new Date(inicioSemana)
        finSemana.setDate(inicioSemana.getDate() + 6)

        const toStr = d => d.toISOString().split('T')[0]

        const { data: slotsAfectados } = await supabase
          .from('planning_semanal')
          .select('id, receta_id, comensales, hogar_id')
          .eq('receta_id', recetaId)
          .gte('fecha', toStr(inicioSemana))
          .lte('fecha', toStr(finSemana))

        for (const slot of slotsAfectados ?? []) {
          const comensalesSlot = slot.comensales ?? hogar.num_comensales ?? 2
          // Restar ingredientes antiguos y sumar los nuevos (misma receta, puede haber cambiado)
          await syncListaConPlanning({
            supabase,
            hogarId:    slot.hogar_id,
            recetaId:   recetaId,
            comensales: comensalesSlot,
            anterior: {
              recetaId:   recetaId,
              comensales: comensalesSlot,
            },
          })
        }
      }

      return recetaId
    },
    onSuccess: (recetaId) => {
      qc.invalidateQueries(['recetas-mias'])
      qc.invalidateQueries(['receta', recetaId])
      qc.invalidateQueries(['lista'])
      navigate(`/recetas/${recetaId}`, { replace: true })
    },
    onError: (e) => setError(e.message),
  })


  // ── Helpers pasos ────────────────────────────────────────
  const updatePaso = (idx, val) => setPasos(p => p.map((s,n) => n === idx ? val : s))
  const addPaso    = () => setPasos(p => [...p, ''])
  const removePaso = (idx) => setPasos(p => p.filter((_,n) => n !== idx))

  return (
    <>
      <style>{`
        .form-header { display:flex; align-items:center; gap:12px; margin-bottom:24px; }
        .form-titulo-pag { font-family:var(--font-display); font-size:22px; font-weight:700; color:var(--text); }

        .form-section { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:14px; display:flex; flex-direction:column; gap:16px; }
        .form-section-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-3); margin-bottom:2px; }

        .field { display:flex; flex-direction:column; gap:6px; }
        .field label { font-size:13px; font-weight:600; color:var(--text-2); }
        .field input, .field textarea, .field select {
          width:100%; padding:10px 13px; border:1.5px solid var(--border); border-radius:var(--radius-sm);
          font-family:var(--font-body); font-size:14px; color:var(--text); background:var(--surface);
          outline:none; transition:border-color var(--transition), box-shadow var(--transition);
          -webkit-appearance:none;
        }
        .field input:focus, .field textarea:focus, .field select:focus {
          border-color:var(--brand); box-shadow:0 0 0 3px rgba(45,106,79,0.1);
        }
        .field textarea { resize:vertical; min-height:80px; line-height:1.5; }

        .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .grid-3 { display:grid; grid-template-columns:80px 100px 1fr; gap:8px; align-items:end; }

        .chip-group { display:flex; flex-wrap:wrap; gap:8px; }
        .chip {
          padding:7px 14px; border-radius:100px; border:1.5px solid var(--border);
          font-family:var(--font-body); font-size:13px; font-weight:600;
          color:var(--text-2); background:var(--surface); cursor:pointer;
          transition:all var(--transition);
        }
        .chip.active { background:var(--brand-pale); border-color:var(--brand-pale2); color:var(--brand-dark); }

        /* Toggle público */
        .toggle-row { display:flex; align-items:center; justify-content:space-between; }
        .toggle-info p { font-size:14px; font-weight:600; color:var(--text); margin-bottom:2px; }
        .toggle-info span { font-size:12px; color:var(--text-3); }
        .toggle-btn {
          position:relative; width:44px; height:24px; border-radius:100px;
          border:none; cursor:pointer; transition:background var(--transition);
          flex-shrink:0;
        }
        .toggle-btn.on { background:var(--brand); }
        .toggle-btn.off { background:var(--border-strong); }
        .toggle-knob {
          position:absolute; top:3px; width:18px; height:18px;
          border-radius:50%; background:white;
          transition:left var(--transition);
          box-shadow:0 1px 4px rgba(0,0,0,0.15);
        }
        .toggle-btn.on .toggle-knob  { left:23px; }
        .toggle-btn.off .toggle-knob { left:3px; }

        /* Imagen */
        .img-upload {
          border:2px dashed var(--border); border-radius:var(--radius);
          cursor:pointer; transition:border-color var(--transition); overflow:hidden;
        }
        .img-upload:hover { border-color:var(--brand-pale2); }
        .img-placeholder {
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:8px; padding:32px; color:var(--text-3); text-align:center;
        }
        .img-placeholder span { font-size:13px; font-weight:500; }
        .img-placeholder small { font-size:11px; color:var(--text-3); }
        .img-preview { position:relative; }
        .img-preview img { width:100%; height:200px; object-fit:cover; object-position:center; display:block; }
        .img-quitar {
          position:absolute; top:8px; right:8px;
          width:30px; height:30px; border-radius:50%;
          background:rgba(0,0,0,0.55); border:none; color:white;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:background var(--transition);
        }
        .img-quitar:hover { background:rgba(0,0,0,0.75); }

        /* Ingredientes */
        .ing-item { display:flex; flex-direction:column; gap:8px; padding:14px; background:var(--surface-2); border-radius:var(--radius-sm); position:relative; }
        .ing-busq-wrap { position:relative; }
        .ing-dropdown {
          position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:50;
          background:var(--surface); border:1.5px solid var(--border); border-radius:var(--radius-sm);
          box-shadow:var(--shadow-md); max-height:200px; overflow-y:auto;
        }
        .ing-option {
          display:flex; align-items:center; gap:10px; padding:10px 12px;
          cursor:pointer; transition:background var(--transition); font-size:14px;
        }
        .ing-option:hover { background:var(--surface-2); }
        .ing-remove {
          position:absolute; top:10px; right:10px; width:24px; height:24px;
          border-radius:6px; border:none; background:transparent; color:var(--text-3);
          display:flex; align-items:center; justify-content:center; cursor:pointer;
        }
        .ing-remove:hover { background:var(--border); color:var(--text); }

        /* Pasos */
        .paso-item { display:flex; gap:10px; align-items:flex-start; }
        .paso-num-badge {
          width:28px; height:28px; border-radius:50%; background:var(--brand-pale);
          color:var(--brand-dark); font-size:13px; font-weight:700;
          display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:8px;
        }
        .btn-add-item {
          display:flex; align-items:center; gap:7px; padding:10px 14px;
          border:1.5px dashed var(--border); border-radius:var(--radius-sm);
          background:transparent; color:var(--text-3); font-family:var(--font-body);
          font-size:13px; font-weight:600; cursor:pointer; width:100%;
          transition:all var(--transition);
        }
        .btn-add-item:hover { border-color:var(--brand); color:var(--brand); background:var(--brand-pale); }

        .error-box { background:#FEF2F2; border:1.5px solid #FCA5A5; border-radius:var(--radius-sm); padding:12px 14px; font-size:13px; color:#DC2626; }

        .contador-comensales { display:flex; align-items:center; gap:12px; }
        .cnt-btn {
          width:34px; height:34px; border-radius:9px; border:1.5px solid var(--border);
          background:var(--surface); font-size:18px; display:flex; align-items:center;
          justify-content:center; cursor:pointer; color:var(--text-2); transition:all var(--transition);
        }
        .cnt-btn:hover { border-color:var(--brand); color:var(--brand); background:var(--brand-pale); }
        .cnt-btn:disabled { opacity:0.35; cursor:not-allowed; }
        .cnt-num { font-family:var(--font-display); font-size:22px; font-weight:700; color:var(--brand); min-width:28px; text-align:center; }
      `}</style>

      {/* Header */}
      <div className="form-header">
        <button className="btn-back" style={{ width:38, height:38, borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-2)', cursor:'pointer', flexShrink:0 }}
          onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="form-titulo-pag">{esEdicion ? 'Editar receta' : 'Nueva receta'}</h1>
      </div>

      {/* ── Imagen ── */}
      <div className="form-section">
        <div className="form-section-title">Foto</div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImagenChange} />

        {imagenPreview ? (
          <div className="img-preview">
            <img src={imagenPreview} alt="preview" />
            <button className="img-quitar" onClick={quitarImagen}><X size={15} /></button>
          </div>
        ) : (
          <div className="img-upload" onClick={() => fileRef.current?.click()}>
            <div className="img-placeholder">
              <Camera size={28} strokeWidth={1.5} />
              <span>Añadir foto</span>
              <small>JPG o PNG · se comprime automáticamente</small>
            </div>
          </div>
        )}
      </div>

      {/* ── Info básica ── */}
      <div className="form-section">
        <div className="form-section-title">Información básica</div>

        <div className="field">
          <label>Título *</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Paella valenciana" />
        </div>

        <div className="field">
          <label>Descripción</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Breve descripción del plato..." />
        </div>

        <div className="field">
          <label>Tipo de comida</label>
          <div className="chip-group">
            {TIPOS.map(t => (
              <button key={t} className={`chip${tipo === t ? ' active' : ''}`} onClick={() => setTipo(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Dificultad</label>
          <div className="chip-group">
            {DIFS.map(d => (
              <button key={d} className={`chip${dificultad === d ? ' active' : ''}`} onClick={() => setDificultad(d)}>
                {DIF_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Prep. (min)</label>
            <input type="number" min="0" value={tiempoPrep} onChange={e => setTiempoPrep(e.target.value)} placeholder="15" />
          </div>
          <div className="field">
            <label>Cocción (min)</label>
            <input type="number" min="0" value={tiempoCoc} onChange={e => setTiempoCoc(e.target.value)} placeholder="30" />
          </div>
        </div>

        <div className="field">
          <label>Comensales base</label>
          <div className="contador-comensales">
            <button className="cnt-btn" disabled={comensales <= 1} onClick={() => setComensales(c => c - 1)}>−</button>
            <span className="cnt-num">{comensales}</span>
            <button className="cnt-btn" onClick={() => setComensales(c => c + 1)}>+</button>
          </div>
        </div>

        <div className="toggle-row">
          <div className="toggle-info">
            <p>Receta pública</p>
            <span>Visible para otros usuarios en la comunidad</span>
          </div>
          <button className={`toggle-btn ${publica ? 'on' : 'off'}`} onClick={() => setPublica(p => !p)}>
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      {/* ── Ingredientes ── */}
      <div className="form-section">
        <div className="form-section-title">Ingredientes</div>

        {ingredientes.filter(i => i.ingrediente_id).length === 0 && (
          <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:8 }}>
            Aún no has añadido ningún ingrediente
          </p>
        )}

        {/* Lista de ingredientes añadidos */}
        {ingredientes.filter(i => i.ingrediente_id).map((ing, idx) => (
          <div key={ing.ingrediente_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{ing.nombre}</div>
              <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{ing.cantidad} {ing.unidad}</div>
            </div>
            <button style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:4 }}
              onClick={() => setIngredientes(prev => prev.filter(i => i.ingrediente_id !== ing.ingrediente_id))}>
              <X size={15} />
            </button>
          </div>
        ))}

        <button className="btn-add-item" style={{ marginTop: ingredientes.filter(i=>i.ingrediente_id).length > 0 ? 12 : 0 }}
          onClick={() => setPickerAbierto(true)}>
          <Plus size={15} /> Añadir ingrediente
        </button>
      </div>

      {/* Picker de ingredientes */}
      {pickerAbierto && (
        <IngredientePicker
          onCerrar={() => setPickerAbierto(false)}
          onAñadir={(nuevo) => {
            setIngredientes(prev => {
              // Si ya existe, actualizamos cantidad
              const existe = prev.find(i => i.ingrediente_id === nuevo.ingrediente_id)
              if (existe) return prev.map(i => i.ingrediente_id === nuevo.ingrediente_id ? { ...i, ...nuevo } : i)
              return [...prev.filter(i => i.ingrediente_id), nuevo]
            })
            setPickerAbierto(false)
          }}
        />
      )}

      {/* ── Pasos ── */}
      <div className="form-section">
        <div className="form-section-title">Preparación *</div>

        {pasos.map((paso, idx) => (
          <div key={idx} className="paso-item">
            <div className="paso-num-badge">{idx + 1}</div>
            <textarea
              className="input-field"
              style={{ flex:1, minHeight:72, resize:'vertical' }}
              placeholder={`Paso ${idx + 1}...`}
              value={paso}
              onChange={e => updatePaso(idx, e.target.value)}
            />
            {pasos.length > 1 && (
              <button style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:4, marginTop:8 }}
                onClick={() => removePaso(idx)}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}

        <button className="btn-add-item" onClick={addPaso}>
          <Plus size={15} /> Añadir paso
        </button>
      </div>

      {/* ── Tags ── */}
      <div className="form-section">
        <div className="form-section-title">Etiquetas</div>
        <div className="field">
          <label>Tags separados por coma</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="italiana, pasta, fácil..." />
        </div>
      </div>

      {/* ── Error y guardar ── */}
      {error && <div className="error-box">{error}</div>}

      <button
        className="btn btn-primary btn-full btn-lg"
        style={{ marginTop:8, marginBottom:40 }}
        onClick={() => guardar.mutate()}
        disabled={guardar.isPending || subiendoImg}
      >
        {(guardar.isPending || subiendoImg)
          ? <><Loader size={16} style={{ animation:'spin 0.7s linear infinite' }} /> Guardando...</>
          : esEdicion ? 'Guardar cambios' : 'Crear receta'
        }
      </button>
    </>
  )
}