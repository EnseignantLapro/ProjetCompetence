import React, { useState, useEffect } from 'react'
import { getApiUrl } from '../utils/api'

function AdminCompetence({ teacherInfo, isSuperAdmin = false, isTeacherReferent = false }) {
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

  // Chargement initial des compétences N3 avec filtrage par établissement
  useEffect(() => {
    let url = `/competences-n3`
    
    // Si c'est un enseignant référent (pas super admin), filtrer par établissement
    if (isTeacherReferent && !isSuperAdmin && teacherInfo) {
      const params = new URLSearchParams()
      params.append('mode', 'admin') // Mode admin : voir toutes les N3 de l'établissement
      if (teacherInfo.etablissement) {
        params.append('etablissement', teacherInfo.etablissement)
      }
      if (teacherInfo.id) {
        params.append('enseignant_id', teacherInfo.id)
      }
      url += `?${params.toString()}`
    }

    fetch(getApiUrl(url))
      .then(res => res.json())
      .then(setCompetencesN3)
      .catch(err => console.error('Erreur lors du chargement des compétences:', err))
  }, [isTeacherReferent, isSuperAdmin, teacherInfo])

  // Ajout compétence N3
  const ajouterCompetenceN3 = async () => {
    if (!newCompetenceN3.parent_code.trim() || !newCompetenceN3.code.trim() || !newCompetenceN3.nom.trim()) {
      alert('Tous les champs sont requis')
      return
    }
    
    // Ajouter l'ID de l'enseignant créateur
    const competenceData = {
      ...newCompetenceN3,
      enseignant_id: teacherInfo?.id || null
    }

    const res = await fetch(getApiUrl(`/competences-n3`) , {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(competenceData),
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
    
    // Conserver l'enseignant créateur original
    const competenceData = {
      ...editingCompetence,
      enseignant_id: editingCompetence.enseignant_id || teacherInfo?.id || null
    }

    const res = await fetch(getApiUrl(`/competences-n3/${editingCompetenceId}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(competenceData),
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

    const res = await fetch(getApiUrl(`/competences-n3/${id}`), {
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
      <h2>Gestion des critères d'évaluations additionnels de votre établissement : {teacherInfo?.etablissement}</h2>

      {/* Liste des compétences */}
      <div>
        <p>
      <small>les critères d'évaluation additionnels se créer automatiquement quand vous choisissez des compétences </small></p>
        {competencesN3.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6c757d', fontStyle: 'italic' }}>
            Aucun critère d'évaluation additionnel n'a été créer lors du choix des compétences.
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
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '8px' }}>
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
                        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                          {c.nom}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>
                        {c.enseignant_prenom && c.enseignant_nom ? (
                          <>👨‍🏫 Créée par: {c.enseignant_prenom} {c.enseignant_nom} ({c.etablissement})</>
                        ) : (
                          <>📚 Compétence du référentiel officiel</>
                        )}
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
