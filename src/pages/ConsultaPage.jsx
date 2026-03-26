import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Users, Plus, Loader, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function ConsultaPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [creando, setCreando] = useState(false)

  // Traemos la lista de MIS pacientes
  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['pacientes', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    }
  })

  // Añadir un paciente nuevo
  const añadirPaciente = useMutation({
    mutationFn: async () => {
      if (!nombre.trim()) throw new Error('Ponle un nombre')
      const { error } = await supabase.from('pacientes').insert({
        nutricionista_id: user.id,
        nombre: nombre.trim(),
        email: email.trim() || null
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries(['pacientes'])
      setNombre('')
      setEmail('')
      setCreando(false)
    }
  })

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Mi Consulta</h1>
        <p className="page-subtitle">Gestiona a tus pacientes y crea sus dietas</p>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div className="card" style={{ flex: '1 1 300px', padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--brand-dark)', marginBottom: 16 }}>
            Añadir nuevo paciente
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input 
              className="input-field" 
              placeholder="Nombre del paciente" 
              value={nombre} 
              onChange={e => setNombre(e.target.value)} 
            />
            <input 
              className="input-field" 
              placeholder="Email (opcional)" 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
            <button 
              className="btn btn-primary" 
              disabled={añadirPaciente.isPending || !nombre.trim()}
              onClick={() => añadirPaciente.mutate()}
            >
              {añadirPaciente.isPending ? <Loader size={16} className="spinner-sm" /> : <Plus size={16} />}
              Dar de alta
            </button>
          </div>
        </div>

        <div className="card" style={{ flex: '2 1 400px', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Users size={20} color="var(--brand)" />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--brand-dark)' }}>
              Tus Pacientes ({pacientes.length})
            </h3>
          </div>

          {isLoading ? (
            <p style={{ color: 'var(--text-3)' }}>Cargando...</p>
          ) : pacientes.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <Users size={32} opacity={0.5} />
              <p>Aún no tienes pacientes dados de alta.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pacientes.map(p => (
                <div 
                  key={p.id} 
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                    padding: '12px 16px', background: 'var(--surface-2)', 
                    borderRadius: '12px', cursor: 'pointer', border: '1px solid var(--border)' 
                  }}
                  // En el próximo paso haremos que este botón abra SU planning
                  onClick={() => alert(`En el siguiente paso abriremos la ficha de ${p.nombre}`)}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.nombre}</div>
                    {p.email && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{p.email}</div>}
                  </div>
                  <ArrowRight size={18} color="var(--text-3)" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}