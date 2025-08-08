import React, { useState, useEffect } from 'react'

function AdminCompetence() {
  const [competencesN3, setCompetencesN3] = useState([])
  const [newCompetenceN3, setNewCompetenceN3] = useState({
    parent_code: '',
    code: '',
    nom: ''
  })
  const [editingCompetenceId, setEditingCompetenceId] = useState(null)
  const [editingCompetence, setEditingCompetence] = useState({
    parent_code: '',
    code: '',
    nom: ''
  })

  // Chargement initial des compétences N3
  useEffect(() => {
    fetch(`http://${window.location.hostname}:3001/competences-n3`)
      .then(res => res.json())
      .then(setCompetencesN3)
  }, [])

  // Ajout compétence N3
  const ajouterCompetenceN3 = async () => {
    if (!newCompetenceN3.parent_code.trim() || !newCompetenceN3.code.trim() || !newCompetenceN3.nom.trim()) {
      alert('Tous les champs sont requis')
      return
    }
    
    const res = await fetch(`http://${window.location.hostname}:3001/competences-n3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCompetenceN3),
    })
    
    if (res.ok) {
      const data = await res.json()
      setCompetencesN3([...competencesN3, data])
      setNewCompetenceN3({ parent_code: '', code: '', nom: '' })
    } else {
      alert('Erreur lors de l\'ajout de la compétence')
    }
  }

  // Modifier compétence N3
  const updateCompetenceN3 = async () => {
    if (!editingCompetence.parent_code.trim() || !editingCompetence.code.trim() || !editingCompetence.nom.trim()) {
      alert('Tous les champs sont requis')
      return
    }
    
    const res = await fetch(`http://${window.location.hostname}:3001/competences-n3/${editingCompetenceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingCompetence),
    })
    
    if (res.ok) {
      const updated = await res.json()
      setCompetencesN3(competencesN3.map(c => c.id === editingCompetenceId ? updated : c))
      setEditingCompetenceId(null)
      setEditingCompetence({ parent_code: '', code: '', nom: '' })
    } else {
      alert('Erreur lors de la modification de la compétence')
    }
  }

  // Supprimer compétence N3
  const supprimerCompetenceN3 = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette compétence ?')) return
    
    const res = await fetch(`http://${window.location.hostname}:3001/competences-n3/${id}`, {
      method: 'DELETE',
    })
    
    if (res.ok) {
      setCompetencesN3(competencesN3.filter(c => c.id !== id))
    } else {
      alert('Erreur lors de la suppression de la compétence')
    }
  }

  return (
    <div>
      <h2>Gestion des compétences N3</h2>

      {/* Liste des compétences */}
      <div>
        <h3>Compétences N3 existantes ({competencesN3.length})</h3>
        {competencesN3.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6c757d', fontStyle: 'italic' }}>
            Aucune compétence N3 trouvée
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {competencesN3.map(c => (
              <div key={c.id} style={{ 
                padding: '15px', 
                backgroundColor: '#ffffff', 
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                {editingCompetenceId === c.id ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto auto', gap: '10px', alignItems: 'end' }}>
                    <input
                      type="text"
                      value={editingCompetence.parent_code}
                      onChange={e => setEditingCompetence({...editingCompetence, parent_code: e.target.value})}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <input
                      type="text"
                      value={editingCompetence.code}
                      onChange={e => setEditingCompetence({...editingCompetence, code: e.target.value})}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <input
                      type="text"
                      value={editingCompetence.nom}
                      onChange={e => setEditingCompetence({...editingCompetence, nom: e.target.value})}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <button 
                      onClick={updateCompetenceN3}
                      style={{
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ✅ Valider
                    </button>
                    <button 
                      onClick={() => setEditingCompetenceId(null)}
                      style={{
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ❌ Annuler
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ 
                          backgroundColor: '#007bff', 
                          color: 'white', 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {c.parent_code}
                        </span>
                        <span style={{ 
                          backgroundColor: '#28a745', 
                          color: 'white', 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {c.code}
                        </span>
                        <span style={{ fontSize: '16px', fontWeight: '500' }}>{c.nom}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        onClick={() => {
                          setEditingCompetenceId(c.id)
                          setEditingCompetence({
                            parent_code: c.parent_code,
                            code: c.code,
                            nom: c.nom
                          })
                        }}
                        style={{
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Modifier
                      </button>
                      <button 
                        onClick={() => supprimerCompetenceN3(c.id)}
                        style={{
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminCompetence
