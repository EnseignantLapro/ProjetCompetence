import React, { useState, useEffect } from 'react'
import AdminEleve from './AdminEleve'

function AdminPanel({ classeChoisie, classes }) {
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

  const [classesWithCounts, setClassesWithCounts] = useState([])
  const [newClasse, setNewClasse] = useState('')
  const [editingClasseId, setEditingClasseId] = useState(null)
  const [editingClasseNom, setEditingClasseNom] = useState('')

  const [csvFile, setCsvFile] = useState(null)
  const [activeTab, setActiveTab] = useState('competences') // Nouvel état pour les onglets

  // États pour l'onglet évaluations
  const [elevesWithEvaluations, setElevesWithEvaluations] = useState([])
  const [csvEvaluationFile, setCsvEvaluationFile] = useState(null)

  // Chargement initial des compétences N3
  useEffect(() => {
    fetch(`http://${window.location.hostname}:3001/competences-n3`)
      .then(res => res.json())
      .then(setCompetencesN3)
  }, [])

  // Chargement des classes avec le nombre d'élèves
  useEffect(() => {
    if (activeTab === 'classes') {
      fetch(`http://${window.location.hostname}:3001/classes/with-counts`)
        .then(res => res.json())
        .then(setClassesWithCounts)
    }
  }, [activeTab])

  // Chargement des élèves avec leurs évaluations
  useEffect(() => {
    if (activeTab === 'evaluations' && classeChoisie) {
      fetch(`http://${window.location.hostname}:3001/eleves/with-evaluations/${classeChoisie}`)
        .then(res => res.json())
        .then(data => {
          // S'assurer que c'est toujours un tableau
          setElevesWithEvaluations(Array.isArray(data) ? data : [])
        })
        .catch(err => {
          console.error('Erreur lors du chargement des évaluations:', err)
          setElevesWithEvaluations([])
        })
    }
  }, [activeTab, classeChoisie])

  const handleCSVChange = (e) => {
    setCsvFile(e.target.files[0])
  }

  const handleCSVUpload = () => {
    if (!csvFile || !classeChoisie) {
      alert('Sélectionnez une classe et un fichier CSV.')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const lines = e.target.result.split('\n').filter(l => l.trim() !== '')
        let successCount = 0
        let errorCount = 0
        
        // Parcourir les lignes (en sautant l'en-tête ligne 0)
        for (let i = 1; i < lines.length; i++) {
          const [id_moodle, prenom, nom] = lines[i].split(',').map(s => s.trim())
          if (!id_moodle || !prenom || !nom) {
            console.log(`Ligne ${i+1} ignorée: données manquantes`)
            errorCount++
            continue
          }

          try {
            const response = await fetch(`http://${window.location.hostname}:3001/eleves`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nom,
                prenom,
                moodle_id: id_moodle,
                classe_id: parseInt(classeChoisie)
              })
            })
            
            if (response.ok) {
              successCount++
            } else {
              console.error(`Erreur ligne ${i+1}:`, await response.text())
              errorCount++
            }
          } catch (error) {
            console.error(`Erreur ligne ${i+1}:`, error)
            errorCount++
          }
        }

        alert(`Import terminé ! ${successCount} élèves ajoutés, ${errorCount} erreurs.`)
        // Réinitialiser les champs
        setCsvFile(null)
        document.querySelector('input[type="file"]').value = ''
      } catch (error) {
        console.error('Erreur lors de la lecture du fichier:', error)
        alert('Erreur lors de la lecture du fichier CSV')
      }
    }
    reader.readAsText(csvFile)
  }

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

  // Ajout classe
  const ajouterClasse = async () => {
    if (!newClasse.trim()) return
    const res = await fetch(`http://${window.location.hostname}:3001/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: newClasse }),
    })
    const data = await res.json()
    // Rafraîchir la liste des classes avec les comptes
    fetch(`http://${window.location.hostname}:3001/classes/with-counts`)
      .then(res => res.json())
      .then(setClassesWithCounts)
    setNewClasse('')
    alert('Classe ajoutée ! Rechargez la page pour voir les changements dans le menu principal.')
  }

  // Modifier classe
  const updateClasse = async () => {
    if (!editingClasseNom.trim()) return
    const res = await fetch(`http://${window.location.hostname}:3001/classes/${editingClasseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: editingClasseNom }),
    })
    const updated = await res.json()
    // Rafraîchir la liste des classes avec les comptes
    fetch(`http://${window.location.hostname}:3001/classes/with-counts`)
      .then(res => res.json())
      .then(setClassesWithCounts)
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
        fetch(`http://${window.location.hostname}:3001/classes/with-counts`)
          .then(res => res.json())
          .then(setClassesWithCounts)
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
            fetch(`http://${window.location.hostname}:3001/classes/with-counts`)
              .then(res => res.json())
              .then(setClassesWithCounts)
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

  // Fonctions pour gérer les évaluations
  const supprimerToutesEvaluations = async (eleveId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer TOUTES les évaluations de cet élève ?')) return
    
    try {
      const res = await fetch(`http://${window.location.hostname}:3001/eleves/${eleveId}/evaluations`, {
        method: 'DELETE',
      })
      
      if (res.ok) {
        alert('Toutes les évaluations ont été supprimées !')
        // Recharger les données
        if (classeChoisie) {
          fetch(`http://${window.location.hostname}:3001/eleves/with-evaluations/${classeChoisie}`)
            .then(res => res.json())
            .then(data => {
              setElevesWithEvaluations(Array.isArray(data) ? data : [])
            })
            .catch(err => {
              console.error('Erreur lors du rechargement:', err)
              setElevesWithEvaluations([])
            })
        }
      } else {
        alert('Erreur lors de la suppression des évaluations')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur de connexion')
    }
  }

  const handleCSVEvaluationChange = (e) => {
    setCsvEvaluationFile(e.target.files[0])
  }

  const handleCSVEvaluationUpload = () => {
    if (!csvEvaluationFile || !classeChoisie) {
      alert('Sélectionnez une classe et un fichier CSV.')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const lines = e.target.result.split('\n').filter(l => l.trim() !== '')
        if (lines.length < 2) {
          alert('Le fichier CSV doit contenir au moins une ligne d\'en-tête et une ligne de données')
          return
        }

        // Analyser l'en-tête pour extraire les codes de compétences
        const headers = lines[0].split(',').map(s => s.trim())
        if (headers.length < 6) {
          alert('Le fichier doit contenir au moins 6 colonnes : id_moodle,prenom,nom,code1,code2,code3')
          return
        }

        const competenceCodes = headers.slice(3) // Les codes de compétences commencent à la 4ème colonne
        let successCount = 0
        let errorCount = 0
        
        // Parcourir les lignes de données
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(s => s.trim())
          if (values.length < 6) {
            console.log(`Ligne ${i+1} ignorée: pas assez de colonnes`)
            errorCount++
            continue
          }

          const [id_moodle, prenom, nom, ...evaluations] = values
          if (!id_moodle || !prenom || !nom) {
            console.log(`Ligne ${i+1} ignorée: données manquantes`)
            errorCount++
            continue
          }

          try {
            // Importer les évaluations pour cet élève
            const response = await fetch(`http://${window.location.hostname}:3001/evaluations/import`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id_moodle,
                prenom,
                nom,
                classe_id: parseInt(classeChoisie),
                evaluations: competenceCodes.map((code, index) => ({
                  code,
                  couleur: evaluations[index] || ''
                })).filter(e => e.couleur) // Filtrer les évaluations vides
              })
            })
            
            if (response.ok) {
              successCount++
            } else {
              const errorText = await response.text()
              console.error(`Erreur ligne ${i+1}:`, errorText)
              errorCount++
            }
          } catch (error) {
            console.error(`Erreur ligne ${i+1}:`, error)
            errorCount++
          }
        }

        alert(`Import terminé ! ${successCount} élèves traités, ${errorCount} erreurs.`)
        // Réinitialiser les champs et recharger les données
        setCsvEvaluationFile(null)
        document.querySelector('#csv-evaluation-input').value = ''
        if (classeChoisie) {
          fetch(`http://${window.location.hostname}:3001/eleves/with-evaluations/${classeChoisie}`)
            .then(res => res.json())
            .then(data => {
              setElevesWithEvaluations(Array.isArray(data) ? data : [])
            })
            .catch(err => {
              console.error('Erreur lors du rechargement:', err)
              setElevesWithEvaluations([])
            })
        }
      } catch (error) {
        console.error('Erreur lors de la lecture du fichier:', error)
        alert('Erreur lors de la lecture du fichier CSV')
      }
    }
    reader.readAsText(csvEvaluationFile)
  }

  const getClasseName = () => {
    if (!classeChoisie) return 'Aucune classe sélectionnée'
    const classe = classes.find(c => c.id == classeChoisie)
    return classe ? classe.nom : 'Classe introuvable'
  }

  const getClasseObject = () => {
    if (!classeChoisie) return null
    return classes.find(c => c.id == classeChoisie)
  }

  const renderTabButtons = () => (
    <div style={{ 
      display: 'flex', 
      borderBottom: '2px solid #dee2e6', 
      marginBottom: '20px',
      gap: '0'
    }}>
      {[
        { key: 'competences', label: 'Compétences' },
        { key: 'classes', label: 'Classes' },
        { key: 'eleves', label: 'Élèves' },
        { key: 'evaluations', label: 'Évaluations' },
        { key: 'import', label: 'Import CSV' }
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          style={{
            padding: '12px 24px',
            border: 'none',
            backgroundColor: activeTab === tab.key ? '#007bff' : '#f8f9fa',
            color: activeTab === tab.key ? 'white' : '#495057',
            cursor: 'pointer',
            borderTopLeftRadius: tab.key === 'competences' ? '8px' : '0',
            borderTopRightRadius: tab.key === 'import' ? '8px' : '0',
            fontWeight: activeTab === tab.key ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )

  return (
    <div style={{ padding: '20px' }}>
      <h1>Administration</h1>
      
      {renderTabButtons()}

      {activeTab === 'competences' && (
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
      )}

      {activeTab === 'classes' && (
        <div>
          <h2>Gestion des classes</h2>
          
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
                    <div style={{ display: 'flex', gap: '10px' }}>
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
                    </div>
                  </>
                )}
              </div>
            ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'eleves' && (
        <AdminEleve classe={getClasseObject()} />
      )}

      {activeTab === 'evaluations' && (
        <div>
          <h2>Gestion des évaluations</h2>
          
          <div style={{ 
            backgroundColor: '#e7f3ff', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #b8daff'
          }}>
            <p><strong>Classe sélectionnée :</strong> {getClasseName()}</p>
            
            {!classeChoisie && (
              <p style={{ color: '#856404', backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px' }}>
                ⚠️ Sélectionnez d'abord une classe dans le menu principal pour voir les évaluations.
              </p>
            )}
          </div>

          {classeChoisie && (
            <>
              {/* Import CSV des évaluations */}
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '20px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                border: '1px solid #dee2e6'
              }}>
                <h3>Importer des évaluations par CSV</h3>
                <div style={{ marginBottom: '15px' }}>
                  <input 
                    id="csv-evaluation-input"
                    type="file" 
                    accept=".csv" 
                    onChange={handleCSVEvaluationChange} 
                    style={{ marginBottom: '10px' }}
                  />
                  <br />
                  <button 
                    onClick={handleCSVEvaluationUpload} 
                    disabled={!csvEvaluationFile}
                    style={{
                      backgroundColor: !csvEvaluationFile ? '#6c757d' : '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '4px',
                      cursor: !csvEvaluationFile ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Importer les évaluations
                  </button>
                </div>

                <div style={{ 
                  backgroundColor: '#fff3cd', 
                  padding: '10px', 
                  borderRadius: '4px',
                  border: '1px solid #ffeaa7'
                }}>
                  <h4>Format attendu du fichier CSV :</h4>
                  <code style={{ 
                    backgroundColor: '#e9ecef', 
                    padding: '10px', 
                    display: 'block', 
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}>
                    id_moodle,prenom,nom,code1,code2,code3<br />
                    1,Julien,Code,vert,bleu,vert<br />
                    2,Marie,Dupont,rouge,vert,jaune
                  </code>
                  <p style={{ marginTop: '10px', fontSize: '14px', color: '#6c757d' }}>
                    • La première ligne contient les en-têtes<br />
                    • Les colonnes code1, code2, code3... correspondent aux codes des compétences<br />
                    • Les couleurs possibles : vert, jaune, rouge, bleu
                  </p>
                </div>
              </div>

              {/* Liste des élèves avec leurs évaluations */}
              <div>
                <h3>Élèves de la classe ({Array.isArray(elevesWithEvaluations) ? elevesWithEvaluations.length : 0})</h3>
                {!Array.isArray(elevesWithEvaluations) || elevesWithEvaluations.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#6c757d', fontStyle: 'italic' }}>
                    Aucun élève trouvé dans cette classe
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    {elevesWithEvaluations.map(eleve => (
                      <div key={eleve.id} style={{ 
                        padding: '20px', 
                        backgroundColor: '#ffffff', 
                        borderRadius: '8px',
                        border: '1px solid #dee2e6',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ 
                              width: '50px', 
                              height: '50px', 
                              borderRadius: '50%', 
                              backgroundColor: '#e9ecef',
                              backgroundImage: eleve.photo ? `url(/photos/${eleve.photo})` : 'url(/default.jpg)',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center'
                            }}></div>
                            <div>
                              <h4 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>
                                {eleve.prenom} {eleve.nom}
                              </h4>
                              <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
                                ID Moodle: {eleve.id_moodle}
                              </p>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <span style={{ 
                                backgroundColor: '#17a2b8', 
                                color: 'white', 
                                padding: '4px 8px', 
                                borderRadius: '12px', 
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}>
                                {eleve.evaluations_count || 0} évaluation{(eleve.evaluations_count || 0) !== 1 ? 's' : ''}
                              </span>
                              <span style={{ 
                                backgroundColor: '#6f42c1', 
                                color: 'white', 
                                padding: '4px 8px', 
                                borderRadius: '12px', 
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}>
                                {eleve.positionnements_count || 0} positionnement{(eleve.positionnements_count || 0) !== 1 ? 's' : ''}
                              </span>
                            </div>
                            
                            <button 
                              onClick={() => supprimerToutesEvaluations(eleve.id)}
                              disabled={!eleve.evaluations_count || eleve.evaluations_count === 0}
                              style={{
                                backgroundColor: !eleve.evaluations_count || eleve.evaluations_count === 0 ? '#6c757d' : '#dc3545',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '4px',
                                cursor: !eleve.evaluations_count || eleve.evaluations_count === 0 ? 'not-allowed' : 'pointer',
                                fontSize: '14px'
                              }}
                              title={!eleve.evaluations_count || eleve.evaluations_count === 0 ? 'Aucune évaluation à supprimer' : 'Supprimer toutes les évaluations'}
                            >
                              🗑️ Supprimer toutes les évaluations
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'import' && (
        <div>
          <h2>Import des élèves via CSV</h2>
          
          <div style={{ 
            backgroundColor: '#e7f3ff', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #b8daff'
          }}>
            <p><strong>Classe de destination :</strong> {getClasseName()}</p>
            
            {!classeChoisie && (
              <p style={{ color: '#856404', backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px' }}>
                ⚠️ Sélectionnez d'abord une classe dans le menu principal pour pouvoir importer des élèves.
              </p>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleCSVChange} 
              disabled={!classeChoisie}
              style={{ marginBottom: '10px' }}
            />
            <br />
            <button 
              onClick={handleCSVUpload} 
              disabled={!classeChoisie || !csvFile}
              style={{
                backgroundColor: !classeChoisie || !csvFile ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: !classeChoisie || !csvFile ? 'not-allowed' : 'pointer'
              }}
            >
              Importer le CSV
            </button>
          </div>

          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '15px', 
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h4>Format attendu du fichier CSV :</h4>
            <code style={{ 
              backgroundColor: '#e9ecef', 
              padding: '10px', 
              display: 'block', 
              borderRadius: '4px',
              fontFamily: 'monospace'
            }}>
              id_moodle,prenom,nom<br />
              12345,Jean,Dupont<br />
              67890,Marie,Martin
            </code>
            <p style={{ marginTop: '10px', fontSize: '14px', color: '#6c757d' }}>
              La première ligne doit contenir les en-têtes de colonnes.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPanel