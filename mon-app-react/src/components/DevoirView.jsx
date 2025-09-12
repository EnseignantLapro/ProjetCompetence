import React, { useState, useEffect } from 'react'
import { apiFetch } from '../utils/api'
import { getPhotoUrl } from './TableauNotesUtils'

const couleurs = {
  rouge: { label: 'Non acquis', hex: '#e74c3c' },
  jaune: { label: 'En progression', hex: '#f1c40f' },
  bleu: { label: 'Acquis', hex: '#3498db' },
  vert: { label: 'Maîtrisé', hex: '#2ecc71' },
}

const DevoirView = React.forwardRef(({ devoirKey, onClose, teacherInfo, eleveFiltre }, ref) => {
  const [devoirData, setDevoirData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [eleves, setEleves] = useState([])
  const [competences, setCompetences] = useState([])
  const [commentairesLocaux, setCommentairesLocaux] = useState({})
  const [elevesFiltres, setElevesFiltres] = useState([])
  const [competencesTemporaires, setCompetencesTemporaires] = useState(new Set())

  useEffect(() => {
    const chargerDevoir = async () => {
      try {
        setLoading(true)
        
        // Charger les données du devoir
        const response = await apiFetch(`/devoirs/${devoirKey}`)
        const data = await response.json()
        setDevoirData(data)

        if (data.length > 0) {
          // Récupérer la classe_id depuis les données du devoir
          const classeId = data[0].classe_id
          
          // Charger TOUS les élèves de la classe (pas seulement ceux notés)
          const elevesResponse = await apiFetch(`/eleves?classe_id=${classeId}`)
          const tousLesEleves = await elevesResponse.json()
          setEleves(tousLesEleves)

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

  // Effect pour filtrer les élèves selon eleveFiltre
  useEffect(() => {
    if (!eleveFiltre || eleveFiltre === '') {
      setElevesFiltres(eleves)
    } else {
      const eleveSelectionne = eleves.find(eleve => eleve.id.toString() === eleveFiltre.toString())
      setElevesFiltres(eleveSelectionne ? [eleveSelectionne] : [])
    }
  }, [eleves, eleveFiltre])

  // Fonction pour ajouter une compétence temporaire
  const ajouterCompetenceTemporaire = (competenceCode) => {
    if (!competences.includes(competenceCode) && !competencesTemporaires.has(competenceCode)) {
      setCompetencesTemporaires(prev => new Set([...prev, competenceCode]))
    }
  }

  // Fonction exposée pour que le parent puisse ajouter des compétences
  React.useImperativeHandle(ref, () => ({
    ajouterCompetence: ajouterCompetenceTemporaire
  }))

  // Combiner les compétences permanentes et temporaires pour l'affichage
  const toutesLesCompetences = [...competences, ...Array.from(competencesTemporaires)]

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
          
          // Mettre à jour les compétences permanentes et supprimer la temporaire
          const nouvellesCompetences = [...new Set(newData.map(note => note.competence_code))]
          setCompetences(nouvellesCompetences)
          
          // Supprimer de la liste temporaire si la compétence est maintenant permanente
          if (nouvellesCompetences.includes(competenceCode)) {
            setCompetencesTemporaires(prev => {
              const nouvelles = new Set(prev)
              nouvelles.delete(competenceCode)
              return nouvelles
            })
          }
          
          // Nettoyer le commentaire local après sauvegarde
          const cleCommentaire = `${eleveId}-${competenceCode}`
          setCommentairesLocaux(prev => {
            const newCommentaires = { ...prev }
            delete newCommentaires[cleCommentaire]
            return newCommentaires
          })
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
          
          // Mettre à jour les compétences permanentes et supprimer la temporaire
          const nouvellesCompetences = [...new Set(newData.map(note => note.competence_code))]
          setCompetences(nouvellesCompetences)
          
          // Supprimer de la liste temporaire si la compétence est maintenant permanente
          if (nouvellesCompetences.includes(competenceCode)) {
            setCompetencesTemporaires(prev => {
              const nouvelles = new Set(prev)
              nouvelles.delete(competenceCode)
              return nouvelles
            })
          }
          
          // Nettoyer le commentaire local après sauvegarde
          const cleCommentaire = `${eleveId}-${competenceCode}`
          setCommentairesLocaux(prev => {
            const newCommentaires = { ...prev }
            delete newCommentaires[cleCommentaire]
            return newCommentaires
          })
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
        const result = await response.json()
        
        // Si aucun changement en base (changes: 0), c'était une compétence temporaire
        if (result.changes === 0) {
          // Retirer la compétence des compétences temporaires
          setCompetencesTemporaires(prev => {
            const nouvelles = new Set(prev)
            nouvelles.delete(competenceCode)
            return nouvelles
          })
        } else {
          // Recharger les données si des changements ont été faits en base
          const newResponse = await apiFetch(`/devoirs/${devoirKey}`)
          const newData = await newResponse.json()
          setDevoirData(newData)
          
          // Mettre à jour les compétences
          const competencesUniques = [...new Set(newData.map(note => note.competence_code))]
          setCompetences(competencesUniques)
        }
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
        <p><strong>Élèves :</strong> {elevesFiltres.length}{eleveFiltre ? ` (filtré sur 1 élève)` : ` (${eleves.length} total)`}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <strong>Compétences :</strong>
          {toutesLesCompetences.map(comp => (
            <span key={comp} style={{
              backgroundColor: '#e9ecef',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              {comp}
              <button
                onClick={() => retirerCompetence(comp)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc3545',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '0',
                  lineHeight: '1'
                }}
                title="Retirer cette compétence du devoir"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Interface en cards comme TableauNotes */}
      {elevesFiltres.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#666',
          fontSize: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginTop: '20px'
        }}>
          {eleveFiltre ? 
            `Aucun élève trouvé avec l'ID ${eleveFiltre}` : 
            'Aucun élève dans cette classe'
          }
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '20px',
          marginTop: '20px' 
        }}>
          {elevesFiltres.map(eleve => (
          <div key={eleve.id} style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            {/* Header avec photo et nom */}
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderBottom: '1px solid #ddd',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <img 
                src={getPhotoUrl(eleve.photo)} 
                alt={`${eleve.prenom} ${eleve.nom}`}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #ddd'
                }}
                onError={(e) => {
                  e.target.src = '/default.jpg'
                }}
              />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                  {eleve.prenom} {eleve.nom}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  ID: {eleve.id}
                </div>
              </div>
            </div>

            {/* Compétences et notes */}
            <div style={{ padding: '15px' }}>
              {toutesLesCompetences.map(comp => {
                const note = obtenirNote(eleve.id, comp)
                const isTemporaire = competencesTemporaires.has(comp)
                return (
                  <div key={comp} style={{ 
                    marginBottom: '15px',
                    padding: '10px',
                    backgroundColor: isTemporaire ? '#fff3e0' : '#f8f9fa',
                    borderRadius: '6px',
                    border: isTemporaire ? '2px dashed #ff9800' : 'none'
                  }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      marginBottom: '8px',
                      fontSize: '14px',
                      color: '#333',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      {comp}
                      {isTemporaire && (
                        <span style={{
                          fontSize: '10px',
                          backgroundColor: '#ff9800',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          fontWeight: 'normal'
                        }}>
                          NOUVEAU
                        </span>
                      )}
                    </div>
                    
                    {/* Boutons de notation avec style TableauNotes */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '5px', 
                      marginBottom: '8px',
                      flexWrap: 'wrap' 
                    }}>
                      {Object.entries(couleurs).map(([couleurCode, couleurInfo]) => (
                        <button
                          key={couleurCode}
                          onClick={() => {
                            const cleCommentaire = `${eleve.id}-${comp}`
                            const commentaireLocal = commentairesLocaux[cleCommentaire] || note?.commentaire || ''
                            ajouterOuModifierNote(eleve.id, comp, couleurCode, commentaireLocal)
                          }}
                          style={{
                            backgroundColor: note?.couleur === couleurCode ? couleurInfo.hex : '#fff',
                            color: note?.couleur === couleurCode ? 'white' : '#333',
                            border: `2px solid ${couleurInfo.hex}`,
                            borderRadius: '4px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            minWidth: '70px',
                            transition: 'all 0.2s'
                          }}
                          title={couleurInfo.label}
                          onMouseEnter={(e) => {
                            if (note?.couleur !== couleurCode) {
                              e.target.style.backgroundColor = couleurInfo.hex
                              e.target.style.color = 'white'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (note?.couleur !== couleurCode) {
                              e.target.style.backgroundColor = '#fff'
                              e.target.style.color = '#333'
                            }
                          }}
                        >
                          {couleurCode === 'rouge' ? 'Non acquis' :
                           couleurCode === 'jaune' ? 'En cours' :
                           couleurCode === 'bleu' ? 'Acquis' : 'Maîtrisé'}
                        </button>
                      ))}
                      {!note && (
                        <span style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          color: '#999',
                          fontStyle: 'italic'
                        }}>
                          +Non évalué
                        </span>
                      )}
                    </div>

                    {/* Champ commentaire */}
                    <textarea
                      placeholder="Commentaire..."
                      value={(() => {
                        const cleCommentaire = `${eleve.id}-${comp}`
                        return commentairesLocaux[cleCommentaire] !== undefined 
                          ? commentairesLocaux[cleCommentaire] 
                          : (note?.commentaire || '')
                      })()}
                      onChange={(e) => {
                        const commentaire = e.target.value
                        const cleCommentaire = `${eleve.id}-${comp}`
                        
                        // Mettre à jour le commentaire local immédiatement
                        setCommentairesLocaux(prev => ({
                          ...prev,
                          [cleCommentaire]: commentaire
                        }))
                      }}
                      onBlur={(e) => {
                        // Sauvegarder le commentaire seulement si l'élève a une note
                        const commentaire = e.target.value
                        if (note?.couleur && commentaire.trim() !== (note?.commentaire || '')) {
                          ajouterOuModifierNote(eleve.id, comp, note.couleur, commentaire)
                        }
                      }}
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />

                    {note?.commentaire && (
                      <div style={{ 
                        marginTop: '5px',
                        fontSize: '11px', 
                        color: '#666',
                        fontStyle: 'italic'
                      }}>
                        💬 {note.commentaire}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      )}

     
    </div>
  )
})

export default DevoirView
