// src/lib/syncLista.js
// Sincroniza la lista de compra cuando cambia un slot del planning.
//
// Parámetros:
//   supabase   — cliente supabase
//   hogarId    — id del hogar
//   recetaId   — id de la receta nueva (null si se está borrando el slot)
//   comensales — comensales del slot nuevo
//   anterior   — { recetaId, comensales } del slot anterior (null si es slot nuevo)

export async function syncListaConPlanning({
  supabase,
  hogarId,
  recetaId,
  comensales,
  anterior = null,
}) {
  // Helper: obtener ingredientes escalados de una receta para N comensales
  async function getIngredientesEscalados(rId, nComensales) {
    const [{ data: ings }, { data: receta }] = await Promise.all([
      supabase.from('receta_ingredientes')
        .select('ingrediente_id, cantidad, unidad')
        .eq('receta_id', rId),
      supabase.from('recetas')
        .select('comensales_base')
        .eq('id', rId)
        .single(),
    ])

    const base = receta?.comensales_base ?? 1
    const result = {}
    for (const ing of ings ?? []) {
      // Escalar: cantidad_receta / comensales_base * comensales_slot
      const cantEscalada = (ing.cantidad / base) * nComensales
      result[ing.ingrediente_id] = {
        cantidad: parseFloat(cantEscalada.toFixed(4)),
        unidad:   ing.unidad,
      }
    }
    return result
  }

  // ── 1. Ingredientes a RESTAR (lo que el slot anterior aportaba) ──
  const restas = anterior?.recetaId
    ? await getIngredientesEscalados(anterior.recetaId, anterior.comensales)
    : {}

  // ── 2. Ingredientes a SUMAR (lo que el slot nuevo aporta) ────────
  const sumas = recetaId
    ? await getIngredientesEscalados(recetaId, comensales)
    : {}

  // ── 3. Lista actual del hogar (solo items del planning) ──────────
  const { data: listaActual } = await supabase
    .from('lista_compra')
    .select('id, ingrediente_id, cantidad')
    .eq('hogar_id', hogarId)
    .eq('manual', false)

  const porIngrediente = {}
  for (const item of listaActual ?? []) {
    porIngrediente[item.ingrediente_id] = { id: item.id, cantidad: parseFloat(item.cantidad) }
  }

  // ── 4. Aplicar diferencia para cada ingrediente afectado ─────────
  const todosIds = new Set([...Object.keys(restas), ...Object.keys(sumas)])

  for (const ingId of todosIds) {
    const resta  = restas[ingId]?.cantidad ?? 0
    const suma   = sumas[ingId]?.cantidad  ?? 0
    const unidad = sumas[ingId]?.unidad ?? restas[ingId]?.unidad ?? 'unidad'
    const actual = porIngrediente[ingId]

    const nuevaCantidad = parseFloat(((actual?.cantidad ?? 0) - resta + suma).toFixed(2))

    if (nuevaCantidad <= 0) {
      if (actual?.id) {
        await supabase.from('lista_compra').delete().eq('id', actual.id)
      }
    } else if (actual?.id) {
      await supabase.from('lista_compra').update({ cantidad: nuevaCantidad }).eq('id', actual.id)
    } else {
      await supabase.from('lista_compra').insert({
        hogar_id:       hogarId,
        ingrediente_id: ingId,
        cantidad:       nuevaCantidad,
        unidad,
        comprado:       false,
        manual:         false,
        semana_inicio:  null,
      })
    }
  }
}