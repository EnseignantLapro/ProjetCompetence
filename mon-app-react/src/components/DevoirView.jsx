import React, { useState, useEffect } from 'react'
import { apiFetch } from '../utils/api'

const couleurs = {
  rouge: { label: 'Non acquis', hex: '#e74c3c' },
  jaune: { label: 'En progression', hex: '#f1c40f' },
  bleu: { label: 'Acquis', hex: '#3498db' },
  vert: { label: 'Maîtrisé', hex: '#2ecc71' },
}

function DevoirView({ devoirKey, onClose, teacherInfo }) {
  const [devoirData, setDevoirData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [eleves, setEleves] = useState([])
  const [competences, setCompetences] = useState([])

  useEffect(() => {
    const chargerDevoir = async () => {
      try {
        setLoading(true)
        
        // Charger les données du devoir
        const response = await apiFetch(`/devoirs/${devoirKey}`)
        const data = await response.json()
        setDevoirData(data)

        if (data.length > 0) {
          // Extraire les élèves uniques
          const elevesUniques = data.reduce((acc, note) => {
            const eleveId = note.eleve_id
            if (!acc.find(e => e.id === eleveId)) {
              acc.push({
                id: eleveId,
                prenom: note.prenom,
                nom: note.nom,
                classe_id: note.classe_id
              })
            }
            return acc
          }, [])
          setEleves(elevesUniques)

          // Extraire les compétences uniques
          const competencesUniques = [...new Set(data.map(note => note.competence_code))]
          setCompetences(competencesUniques)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (devoirKey) {
      chargerDevoir()
    }
  }, [devoirKey])

  const obtenirNote = (eleveId, competenceCode) => {
    return devoirData.find(note => note.eleve_id === eleveId && note.competence_code === competenceCode)
  }

  const ajouterOuModifierNote = async (eleveId, competenceCode, couleur, commentaire = '') => {
    try {
      const noteExistante = obtenirNote(eleveId, competenceCode)
      
      if (noteExistante) {
        // Modifier la note existante
        const response = await apiFetch(`/notes/${noteExistante.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            couleur,
            commentaire: commentaire.trim() || null
          })
        })
        
        if (response.ok) {
          // Recharger les données
          const newResponse = await apiFetch(`/devoirs/${devoirKey}`)
          const newData = await newResponse.json()
          setDevoirData(newData)
        }
      } else {
        // Créer une nouvelle note
        const noteData = devoirData.find(n => n.eleve_id === eleveId) || devoirData[0]
        
        const response = await apiFetch('/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eleve_id: eleveId,
            competence_code: competenceCode,
            couleur,
            date: new Date().toISOString(),
            prof_id: teacherInfo?.id,
            commentaire: commentaire.trim() || null,
            devoirKey: devoirKey,
            devoir_label: noteData?.devoir_label || 'Devoir'
          })
        })
        
        if (response.ok) {
          // Recharger les données
          const newResponse = await apiFetch(`/devoirs/${devoirKey}`)
          const newData = await newResponse.json()
          setDevoirData(newData)
        }
      }
    } catch (err) {
      console.error('Erreur lors de la modification de la note:', err)
    }
  }

  const retirerCompetence = async (competenceCode) => {
    if (!confirm(`Êtes-vous sûr de vouloir retirer la compétence "${competenceCode}" de ce devoir ?`)) {
      return
    }

    try {
      const response = await apiFetch(`/devoirs/${devoirKey}/remove-competence`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competence_code: competenceCode })
      })

      if (response.ok) {
        // Recharger les données
        const newResponse = await apiFetch(`/devoirs/${devoirKey}`)
        const newData = await newResponse.json()
        setDevoirData(newData)
        
        // Mettre à jour les compétences
        const competencesUniques = [...new Set(newData.map(note => note.competence_code))]
        setCompetences(competencesUniques)
      }
    } catch (err) {
      console.error('Erreur lors de la suppression de la compétence:', err)
    }
  }

  if (loading) return <div>Chargement...</div>
  if (error) return <div>Erreur: {error}</div>
  if (devoirData.length === 0) return <div>Aucune donnée trouvée pour ce devoir</div>

  const devoirInfo = devoirData[0]

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📋 {devoirInfo.devoir_label}</h2>
        <button 
          onClick={onClose}
          style={{
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ← Retour
        </button>
      </div>

      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <p><strong>Date :</strong> {new Date(devoirInfo.date).toLocaleDateString()}</p>
        <p><strong>Compétences :</strong> {competences.join(', ')}</p>
        <p><strong>Élèves :</strong> {eleves.length}</p>
      </div>

      {/* Tableau de notation */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Élève</th>
              {competences.map(comp => (
                <th key={comp} style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                  <div>
                    {comp}
                    <button
                      onClick={() => retirerCompetence(comp)}
                      style={{
                        marginLeft: '5px',
                        background: 'none',
                        border: 'none',
                        color: '#dc3545',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      title="Retirer cette compétence du devoir"
                    >
                      ❌
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eleves.map(eleve => (
              <tr key={eleve.id}>
                <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                  {eleve.prenom} {eleve.nom}
                </td>
                {competences.map(comp => {
                  const note = obtenirNote(eleve.id, comp)
                  return (
                    <td key={comp} style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {Object.entries(couleurs).map(([couleurCode, couleurInfo]) => (
                          <button
                            key={couleurCode}
                            onClick={() => ajouterOuModifierNote(eleve.id, comp, couleurCode)}
                            style={{
                              backgroundColor: note?.couleur === couleurCode ? couleurInfo.hex : '#f8f9fa',
                              color: note?.couleur === couleurCode ? 'white' : '#333',
                              border: `2px solid ${couleurInfo.hex}`,
                              borderRadius: '50%',
                              width: '30px',
                              height: '30px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}
                            title={couleurInfo.label}
                          >
                            {couleurCode.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                      {note?.commentaire && (
                        <div style={{ 
                          fontSize: '11px', 
                          color: '#666', 
                          marginTop: '3px',
                          maxWidth: '100px',
                          wordWrap: 'break-word'
                        }}>
                          {note.commentaire}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p><strong>Légende :</strong></p>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {Object.entries(couleurs).map(([code, info]) => (
            <div key={code} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div 
                style={{ 
                  width: '20px', 
                  height: '20px', 
                  backgroundColor: info.hex, 
                  borderRadius: '50%' 
                }}
              ></div>
              <span>{info.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DevoirView
