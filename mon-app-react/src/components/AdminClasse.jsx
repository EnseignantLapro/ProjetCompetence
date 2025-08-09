import React, { useState, useEffect } from 'react'

function AdminClasse({ teacherInfo = null, isSuperAdmin = false, isTeacherReferent = false }) {
  const [classesWithCounts, setClassesWithCounts] = useState([])
  const [newClasse, setNewClasse] = useState('')
  const [editingClasseId, setEditingClasseId] = useState(null)
  const [editingClasseNom, setEditingClasseNom] = useState('')

  // Chargement des classes avec le nombre d'élèves
  useEffect(() => {
    let url = null;
    if (isSuperAdmin) {
      url = `http://${window.location.hostname}:3001/classes/with-counts`;
    } else if (isTeacherReferent && teacherInfo && teacherInfo.token) {
      url = `http://${window.location.hostname}:3001/classes/by-token/${teacherInfo.token}`;
    }
    if (url) {
      fetch(url)
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
  }, [isSuperAdmin, isTeacherReferent, teacherInfo])

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
    const res = await fetch(`http://${window.location.hostname}:3001/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: newClasse, idReferent, creatorTeacherId }),
    })
    const data = await res.json()
    // Rafraîchir la liste des classes avec les comptes
    let url = `http://${window.location.hostname}:3001/classes/by-token/${teacherInfo?.token}`;
    if (isSuperAdmin) {
      url = `http://${window.location.hostname}:3001/classes/with-counts`;
    }
    fetch(url)
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
    setNewClasse('')
    alert('Classe ajoutée ! Rechargez la page pour voir les changements dans le menu principal.')
  }

  // Modifier classe
  const updateClasse = async () => {
    if (!editingClasseNom.trim()) return
    
    // Récupérer l'ID du référent actuel de la classe
    const currentClasse = classesWithCounts.find(c => c.id === editingClasseId)
    const idReferent = currentClasse ? currentClasse.idReferent : null
    
    const res = await fetch(`http://${window.location.hostname}:3001/classes/${editingClasseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: editingClasseNom, idReferent }),
    })
    const updated = await res.json()
    // Rafraîchir la liste des classes avec les comptes
    let url = `http://${window.location.hostname}:3001/classes/by-token/${teacherInfo?.token}`;
    if (isSuperAdmin) {
      url = `http://${window.location.hostname}:3001/classes/with-counts`;
    }
    fetch(url)
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
    setEditingClasseId(null)
    setEditingClasseNom('')
    alert('Classe modifiée ! Rechargez la page pour voir les changements dans le menu principal.')
  }

  // Supprimer classe
  const supprimerClasse = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette classe ?')) return
    
    try {
      // Tentative de suppression normale
      const res = await fetch(`http://${window.location.hostname}:3001/classes/${id}`, {
        method: 'DELETE',
      })
      
      if (res.ok) {
        const data = await res.json()
        alert(data.message || 'Classe supprimée !')
        // Rafraîchir la liste des classes avec les comptes
        let url = `http://${window.location.hostname}:3001/classes/by-token/${teacherInfo?.token}`;
        if (isSuperAdmin) {
          url = `http://${window.location.hostname}:3001/classes/with-counts`;
        }
        fetch(url)
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
        alert('Classe supprimée ! Rechargez la page pour voir les changements.')
      } else if (res.status === 400) {
        // La classe contient des élèves
        const errorData = await res.json()
        const forceDelete = confirm(
          `${errorData.message}\n\n` +
          `⚠️ ATTENTION : Si vous continuez, tous les élèves de cette classe seront également supprimés !\n\n` +
          `Voulez-vous vraiment supprimer cette classe ET ses ${errorData.studentCount} élève(s) ?`
        )
        
        if (forceDelete) {
          // Suppression forcée
          const forceRes = await fetch(`http://${window.location.hostname}:3001/classes/${id}?forceDelete=true`, {
            method: 'DELETE',
          })
          
          if (forceRes.ok) {
            const forceData = await forceRes.json()
            alert(`✅ ${forceData.message}`)
            // Rafraîchir la liste des classes avec les comptes
            let url = `http://${window.location.hostname}:3001/classes/by-token/${teacherInfo?.token}`;
            if (isSuperAdmin) {
              url = `http://${window.location.hostname}:3001/classes/with-counts`;
            }
            fetch(url)
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
            alert('Classe et élèves supprimés ! Rechargez la page pour voir les changements.')
          } else {
            alert('Erreur lors de la suppression forcée')
          }
        }
      } else {
        alert('Erreur lors de la suppression de la classe')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur de connexion lors de la suppression')
    }
  }

  return (
    <div>
      <h2>Gestion des classes</h2>
      
      {/* Message informatif pour les enseignants référents */}
      {isTeacherReferent && !isSuperAdmin && (
        <div style={{
          backgroundColor: '#e7f3ff',
          border: '1px solid #b3d7ff',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0066cc' }}>👨‍💼 Mode Enseignant Référent - Gestion des Classes</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#004499' }}>
            <li>Les classes que vous créez vous seront automatiquement attribuées</li>
            <li>Vous gérez les élèves et les évaluations de vos classes</li>
            <li>Les classes créées par d'autres référents ne peuvent pas être modifiées</li>
          </ul>
        </div>
      )}
      
      {/* Formulaire d'ajout */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #dee2e6'
      }}>
        <h3>Ajouter une nouvelle classe</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom de la classe</label>
            <input
              type="text"
              value={newClasse}
              onChange={e => setNewClasse(e.target.value)}
              placeholder="Nom de la nouvelle classe"
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
            />
          </div>
          <button 
            onClick={ajouterClasse}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              height: 'fit-content'
            }}
          >
            Ajouter
          </button>
        </div>
      </div>

      {/* Liste des classes */}
      <div>
        <h3>Classes existantes ({classesWithCounts.length})</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {classesWithCounts.map(c => (
            <div key={c.id} style={{ 
              padding: '15px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              border: '1px solid #dee2e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              {editingClasseId === c.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                  <input
                    type="text"
                    value={editingClasseNom}
                    onChange={e => setEditingClasseNom(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
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
                    Valider
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
                    Annuler
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '500' }}>{c.nom}</span>
                      <span style={{ 
                        backgroundColor: c.student_count > 0 ? '#17a2b8' : '#6c757d', 
                        color: 'white', 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {c.student_count} élève{c.student_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {c.referent_nom && (
                      <div style={{ 
                        fontSize: '13px', 
                        color: '#666',
                        fontStyle: 'italic'
                      }}>
                        Référent : {c.referent_nom}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {(isSuperAdmin) || (teacherInfo && c.idReferent === teacherInfo.id) ? (
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
