import React, { useState, useEffect } from 'react'
import { getApiUrl, apiFetch } from '../utils/api'

function AdminClasse({ teacherInfo = null, isSuperAdmin = false, isTeacherReferent = false }) {
  const [classesWithCounts, setClassesWithCounts] = useState([])
  const [newClasse, setNewClasse] = useState('')
  const [editingClasseId, setEditingClasseId] = useState(null)
  const [editingClasseNom, setEditingClasseNom] = useState('')
  const [enseignants, setEnseignants] = useState([])
  const [assigningTeacher, setAssigningTeacher] = useState(null) // ID de la classe pour laquelle on assigne un prof
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [classTeachers, setClassTeachers] = useState({}) // Enseignants assignés par classe

  // Chargement des classes avec le nombre d'élèves
  useEffect(() => {
    let url = null;
    if (isSuperAdmin) {
      url = `/classes/with-counts`;
    } else if (isTeacherReferent && teacherInfo && teacherInfo.token) {
      url = `/classes/by-token/${teacherInfo.token}`;
    }
    if (url) {
  apiFetch(url)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setClassesWithCounts(data)
          } else {
            setClassesWithCounts([])
          }
        })
        .catch(err => {
          setClassesWithCounts([])
          console.error('Erreur lors du chargement des classes:', err)
        })
    } else {
      setClassesWithCounts([])
    }
  }, [isSuperAdmin, isTeacherReferent, teacherInfo?.token, teacherInfo?.id]) // ✅ Propriétés spécifiques

  // Chargement des enseignants du même établissement
  useEffect(() => {
    let url = `/enseignants`;
    
    // Si c'est un enseignant référent (pas super admin), filtrer par établissement
    if (isTeacherReferent && !isSuperAdmin && teacherInfo && teacherInfo.etablissement) {
      url = `/enseignants?etablissement=${encodeURIComponent(teacherInfo.etablissement)}`;
    }
    
  apiFetch(url)
      .then(res => res.json())
      .then(setEnseignants)
      .catch(err => console.error('Erreur lors du chargement des enseignants:', err))
  }, [isSuperAdmin, isTeacherReferent, teacherInfo?.etablissement]) // ✅ Propriété spécifique

  // Charger les enseignants assignés pour chaque classe
  useEffect(() => {
    if (classesWithCounts.length > 0) {
      console.log('📋 Chargement enseignants pour', classesWithCounts.length, 'classes')
      
      const teachersPromises = classesWithCounts.map(classe => 
        apiFetch(`/classes/${classe.id}/enseignants`)
          .then(res => {
            if (!res.ok) {
              if (res.status === 404) {
                console.warn(`⚠️ Classe ${classe.id} non trouvée (probablement supprimée)`)
                return { classeId: classe.id, teachers: [] }
              }
              throw new Error(`HTTP ${res.status}`)
            }
            return res.json()
          })
          .then(teachers => ({ classeId: classe.id, teachers }))
          .catch(err => {
            console.error(`❌ Erreur enseignants classe ${classe.id}:`, err.message)
            return { classeId: classe.id, teachers: [] }
          })
      )

      Promise.all(teachersPromises).then(results => {
        const teachersByClass = {}
        results.forEach(({ classeId, teachers }) => {
          teachersByClass[classeId] = teachers
        })
        setClassTeachers(teachersByClass)
        console.log('✅ Enseignants chargés pour toutes les classes')
      }).catch(err => {
        console.error('❌ Erreur Promise.all enseignants:', err)
        // Cette erreur ne devrait pas se produire car on gère les erreurs individuelles
      })
    } else {
      // Si plus de classes, vider les enseignants
      setClassTeachers({})
      console.log('🧹 Enseignants vidés (pas de classes)')
    }
  }, [classesWithCounts]) // Dépendre de classesWithCounts pour se re-déclencher après suppression

  // Fonction pour recharger les classes
  const rechargerClasses = () => {
    let url = `/classes/by-token/${teacherInfo?.token}`;
    if (isSuperAdmin) {
      url = `/classes/with-counts`;
    }
    return apiFetch(url)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setClassesWithCounts(data)
        } else {
          setClassesWithCounts([])
        }
      })
      .catch(err => {
        setClassesWithCounts([])
        console.error('Erreur lors du chargement des classes:', err)
        throw err // Re-lancer l'erreur pour que l'appelant puisse la gérer
      })
  }

  // Ajout classe
  const ajouterClasse = async () => {
    if (!newClasse.trim()) return
    // Correction : garantir que l'idReferent est bien transmis si enseignant référent
    let idReferent = null
    let creatorTeacherId = null
    if (isTeacherReferent) {
      // On tente d'utiliser teacherInfo.id, sinon on demande à l'utilisateur
      if (teacherInfo && teacherInfo.id) {
        idReferent = teacherInfo.id
        creatorTeacherId = teacherInfo.id
      } else {
        // Fallback : demander à l'utilisateur ou afficher une erreur
        alert("Impossible de déterminer l'ID de l'enseignant référent. Veuillez vous reconnecter ou contacter l'administrateur.")
        return
      }
    }
    const res = await apiFetch(`/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: newClasse, idReferent, creatorTeacherId }),
    })
    const data = await res.json()
    // Rafraîchir la liste des classes avec les comptes
    rechargerClasses()
    setNewClasse('')
    alert('Classe ajoutée ! Rechargez la page pour voir les changements dans le menu principal.')
  }

  // Modifier classe
  const updateClasse = async () => {
    if (!editingClasseNom.trim()) return
    
    // Récupérer l'ID du référent actuel de la classe
    const currentClasse = classesWithCounts.find(c => c.id === editingClasseId)
    const idReferent = currentClasse ? currentClasse.idReferent : null
    
    const res = await apiFetch(`/classes/${editingClasseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: editingClasseNom, idReferent }),
    })
    const updated = await res.json()
    // Rafraîchir la liste des classes avec les comptes
    rechargerClasses()
    setEditingClasseId(null)
    setEditingClasseNom('')
    alert('Classe modifiée ! Rechargez la page pour voir les changements dans le menu principal.')
  }

  // Assigner un professeur à une classe
  const assignerProfesseur = async () => {
    if (!selectedTeacherId || !assigningTeacher) return

    try {
      const res = await apiFetch(`/classes/${assigningTeacher}/assign-teacher`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: selectedTeacherId }),
      })

      if (res.ok) {
        alert('Professeur assigné à la classe avec succès !')
        // Rafraîchir la liste des classes
        rechargerClasses()
        
        setAssigningTeacher(null)
        setSelectedTeacherId('')
        
        // Recharger les enseignants assignés
        apiFetch(`/classes/${assigningTeacher}/enseignants`)
          .then(res => res.json())
          .then(teachers => {
            setClassTeachers(prev => ({
              ...prev,
              [assigningTeacher]: teachers
            }))
          })
      } else {
        const error = await res.text()
        alert(`Erreur : ${error}`)
      }
    } catch (err) {
      console.error('Erreur lors de l assignation du professeur:', err)
      alert('Erreur lors de l assignation du professeur')
    }
  }

  // Supprimer classe
  const supprimerClasse = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette classe ?')) return
    
    console.log('🗑️ Début suppression classe ID:', id)
    
    try {
      const res = await apiFetch(`/classes/${id}`, {
        method: 'DELETE',
      })
      
      console.log('📡 Réponse suppression:', res.status, res.ok)
      
      if (res.ok) {
        const data = await res.json()
        console.log('✅ Données de suppression:', data)
        
        alert(data.message || 'Classe supprimée !')
        
        // Nettoyer les états liés à cette classe
        if (assigningTeacher === id) {
          setAssigningTeacher(null)
          setSelectedTeacherId('')
        }
        if (editingClasseId === id) {
          setEditingClasseId(null)
          setEditingClasseNom('')
        }
        
        // Rafraîchir la liste
        console.log('🔄 Début rechargement des classes...')
        try {
          await rechargerClasses()
          console.log('✅ Rechargement réussi')
        } catch (reloadErr) {
          console.error('❌ Erreur lors du rechargement des classes:', reloadErr)
          // Ne pas afficher d'erreur à l'utilisateur car la suppression a réussi
        }
      } else if (res.status === 400) {
        const errorData = await res.json()
        const forceDelete = confirm(
          `${errorData.message}\n\nATTENTION : Si vous continuez, tous les élèves de cette classe seront également supprimés !\n\nVoulez-vous vraiment supprimer cette classe ET ses ${errorData.studentCount} élève(s) ?`
        )
        
        if (forceDelete) {
          const forceRes = await apiFetch(`/classes/${id}?forceDelete=true`, {
            method: 'DELETE',
          })
          
          if (forceRes.ok) {
            const forceData = await forceRes.json()
            alert(`✅ ${forceData.message}`)
            
            // Nettoyer les états liés à cette classe
            if (assigningTeacher === id) {
              setAssigningTeacher(null)
              setSelectedTeacherId('')
            }
            if (editingClasseId === id) {
              setEditingClasseId(null)
              setEditingClasseNom('')
            }
            
            // Rafraîchir la liste
            try {
              await rechargerClasses()
            } catch (reloadErr) {
              console.error('Erreur lors du rechargement des classes:', reloadErr)
              // Ne pas afficher d'erreur à l'utilisateur car la suppression a réussi
            }
          } else {
            const errorData = await forceRes.json()
            alert(`Erreur lors de la suppression forcée: ${errorData.error || 'Erreur inconnue'}`)
          }
        }
      } else {
        const errorData = await res.json()
        alert(`Erreur lors de la suppression: ${errorData.error || 'Erreur inconnue'}`)
      }
    } catch (err) {
      console.error('❌ Erreur complète:', err)
      alert('Erreur de connexion lors de la suppression')
    }
    
    console.log('🏁 Fin suppression classe ID:', id)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>🏫 Administration des Classes</h2>
      
      {/* Ajout de classe */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>Ajouter une classe à votre établissement : {teacherInfo?.etablissement}</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            value={newClasse}
            onChange={(e) => setNewClasse(e.target.value)}
            placeholder="Nom de la classe"
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <button 
            onClick={ajouterClasse}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ➕ Ajouter
          </button>
        </div>
      </div>

      {/* Liste des classes */}
      <div>
        <h3>Classes existantes ({classesWithCounts.length})</h3>
        <div style={{ display: 'grid', gap: '15px' }}>
          {classesWithCounts.map((c) => (
            <div key={c.id} style={{ 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              padding: '15px',
              backgroundColor: '#f9f9f9'
            }}>
              {editingClasseId === c.id ? (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={editingClasseNom}
                    onChange={(e) => setEditingClasseNom(e.target.value)}
                    style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flex: 1 }}
                  />
                  <button 
                    onClick={updateClasse}
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
                    onClick={() => setEditingClasseId(null)}
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
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '18px' }}>{c.nom}</strong>
                      <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                        👥 {c.student_count || 0} élève(s)
                        {c.referent_nom && (
                          <span style={{ marginLeft: '15px' }}>
                            👨‍🏫 Référent: {c.referent_nom} {c.referent_prenom}
                          </span>
                        )}
                        {classTeachers[c.id] && classTeachers[c.id].length > 0 && (
                          <div style={{ marginTop: '5px' }}>
                            👥 Enseignants assignés: {classTeachers[c.id].map(teacher => 
                              `${teacher.prenom} ${teacher.nom}`
                            ).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section assignation de professeur */}
                  {assigningTeacher === c.id ? (
                    <div style={{ 
                      backgroundColor: '#e3f2fd', 
                      padding: '10px', 
                      borderRadius: '4px', 
                      marginBottom: '10px' 
                    }}>
                      <h4>Assigner un professeur à cette classe</h4>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select
                          value={selectedTeacherId}
                          onChange={(e) => setSelectedTeacherId(e.target.value)}
                          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flex: 1 }}
                        >
                          <option value="">Sélectionner un enseignant</option>
                          {enseignants.map(ens => (
                            <option key={ens.id} value={ens.id}>
                              {ens.prenom} {ens.nom} ({ens.etablissement})
                            </option>
                          ))}
                        </select>
                        <button 
                          onClick={assignerProfesseur}
                          disabled={!selectedTeacherId}
                          style={{
                            backgroundColor: selectedTeacherId ? '#28a745' : '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: selectedTeacherId ? 'pointer' : 'not-allowed'
                          }}
                        >
                          ✅ Assigner
                        </button>
                        <button 
                          onClick={() => {
                            setAssigningTeacher(null)
                            setSelectedTeacherId('')
                          }}
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
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Boutons de gestion pour le référent ou super admin */}
                    {(isSuperAdmin || (isTeacherReferent && c.idReferent === teacherInfo?.id)) ? (
                      <>
                        <button 
                          onClick={() => {
                            setEditingClasseId(c.id)
                            setEditingClasseNom(c.nom)
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
                          onClick={() => {
                            setAssigningTeacher(c.id)
                            setSelectedTeacherId('')
                          }}
                          style={{
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          👨‍🏫 Assigner Prof
                        </button>
                        <button 
                          onClick={() => supprimerClasse(c.id)}
                          style={{
                            backgroundColor: c.student_count > 0 ? '#fd7e14' : '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          title={c.student_count > 0 ? `Attention: ${c.student_count} élève(s) dans cette classe` : 'Supprimer la classe'}
                        >
                          🗑️ Supprimer
                        </button>
                      </>
                    ) : (
                      <span style={{ 
                        fontSize: '13px', 
                        color: '#6c757d',
                        fontStyle: 'italic',
                        padding: '8px'
                      }}>
                        Seul le référent peut modifier cette classe
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AdminClasse
