import React, { useState, useEffect } from 'react'

function AdminEnseignant() {
  const [enseignants, setEnseignants] = useState([])
  const [classes, setClasses] = useState([])
  const [newEnseignant, setNewEnseignant] = useState({
    id_moodle: '',
    nom: '',
    prenom: '',
    photo: '',
    etablissement: ''
  })
  const [editingEnseignantId, setEditingEnseignantId] = useState(null)
  const [editingEnseignant, setEditingEnseignant] = useState({})
  const [selectedEnseignant, setSelectedEnseignant] = useState(null)
  const [enseignantClasses, setEnseignantClasses] = useState([])

  // Charger les enseignants
  useEffect(() => {
    fetchEnseignants()
    fetchClasses()
  }, [])

  const fetchEnseignants = () => {
    fetch(`http://${window.location.hostname}:3001/enseignants`)
      .then(res => res.json())
      .then(setEnseignants)
      .catch(err => console.error('Erreur lors du chargement des enseignants:', err))
  }

  const fetchClasses = () => {
    fetch(`http://${window.location.hostname}:3001/classes`)
      .then(res => res.json())
      .then(setClasses)
      .catch(err => console.error('Erreur lors du chargement des classes:', err))
  }

  const fetchEnseignantClasses = (enseignantId) => {
    fetch(`http://${window.location.hostname}:3001/enseignants/${enseignantId}/classes`)
      .then(res => res.json())
      .then(setEnseignantClasses)
      .catch(err => console.error('Erreur lors du chargement des classes de l\'enseignant:', err))
  }

  // Ajouter un enseignant
  const ajouterEnseignant = async () => {
    if (!newEnseignant.nom.trim() || !newEnseignant.prenom.trim()) {
      alert('Nom et prénom sont obligatoires')
      return
    }

    try {
      const res = await fetch(`http://${window.location.hostname}:3001/enseignants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEnseignant),
      })
      
      if (res.ok) {
        const data = await res.json()
        alert('Enseignant ajouté avec succès !')
        setNewEnseignant({
          id_moodle: '',
          nom: '',
          prenom: '',
          photo: '',
          etablissement: ''
        })
        fetchEnseignants()
      } else {
        alert('Erreur lors de l\'ajout de l\'enseignant')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur de connexion')
    }
  }

  // Modifier un enseignant
  const updateEnseignant = async () => {
    if (!editingEnseignant.nom?.trim() || !editingEnseignant.prenom?.trim()) {
      alert('Nom et prénom sont obligatoires')
      return
    }

    try {
      const res = await fetch(`http://${window.location.hostname}:3001/enseignants/${editingEnseignantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEnseignant),
      })
      
      if (res.ok) {
        alert('Enseignant modifié avec succès !')
        setEditingEnseignantId(null)
        setEditingEnseignant({})
        fetchEnseignants()
      } else {
        alert('Erreur lors de la modification de l\'enseignant')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur de connexion')
    }
  }

  // Supprimer un enseignant
  const supprimerEnseignant = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet enseignant ? Cela supprimera aussi ses associations avec les classes.')) return
    
    try {
      const res = await fetch(`http://${window.location.hostname}:3001/enseignants/${id}`, {
        method: 'DELETE',
      })
      
      if (res.ok) {
        alert('Enseignant supprimé !')
        fetchEnseignants()
      } else {
        alert('Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur de connexion')
    }
  }

  // Régénérer le token
  const regenererToken = async (id) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3001/enseignants/${id}/regenerate-token`, {
        method: 'POST'
      })
      
      if (res.ok) {
        const data = await res.json()
        alert(`Nouveau token généré : ${data.token}`)
        fetchEnseignants()
      } else {
        alert('Erreur lors de la régénération du token')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur de connexion')
    }
  }

  // Associer enseignant à une classe
  const associerClasse = async (classeId) => {
    if (!selectedEnseignant) return

    try {
      const res = await fetch(`http://${window.location.hostname}:3001/enseignant-classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enseignant_id: selectedEnseignant.id,
          classe_id: classeId
        }),
      })
      
      if (res.ok) {
        alert('Association créée avec succès !')
        fetchEnseignantClasses(selectedEnseignant.id)
      } else {
        const errorData = await res.json()
        alert(errorData.error || 'Erreur lors de l\'association')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur de connexion')
    }
  }

  // Supprimer association enseignant-classe
  const supprimerAssociation = async (classeId) => {
    if (!selectedEnseignant) return

    try {
      const res = await fetch(`http://${window.location.hostname}:3001/enseignant-classes/${selectedEnseignant.id}/${classeId}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        alert('Association supprimée !')
        fetchEnseignantClasses(selectedEnseignant.id)
      } else {
        alert('Erreur lors de la suppression de l\'association')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur de connexion')
    }
  }

  const getPhotoUrl = (photo) => {
    if (!photo || photo === 'default.jpg') return '/default.jpg'
    if (photo.startsWith('http://') || photo.startsWith('https://')) return photo
    return `/${photo}`
  }

  const generateTeacherUrl = (token) => {
    return `${window.location.origin}?teacher_token=${token}`
  }

  return (
    <div>
      <h2>Gestion des enseignants</h2>
      
      {/* Formulaire d'ajout */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #dee2e6'
      }}>
        <h3>Ajouter un nouvel enseignant</h3>
        <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ID Moodle</label>
            <input
              type="number"
              value={newEnseignant.id_moodle}
              onChange={e => setNewEnseignant({...newEnseignant, id_moodle: e.target.value})}
              placeholder="ID Moodle"
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom *</label>
            <input
              type="text"
              value={newEnseignant.nom}
              onChange={e => setNewEnseignant({...newEnseignant, nom: e.target.value})}
              placeholder="Nom"
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Prénom *</label>
            <input
              type="text"
              value={newEnseignant.prenom}
              onChange={e => setNewEnseignant({...newEnseignant, prenom: e.target.value})}
              placeholder="Prénom"
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Photo (URL)</label>
            <input
              type="text"
              value={newEnseignant.photo}
              onChange={e => setNewEnseignant({...newEnseignant, photo: e.target.value})}
              placeholder="URL de la photo"
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Établissement</label>
            <input
              type="text"
              value={newEnseignant.etablissement}
              onChange={e => setNewEnseignant({...newEnseignant, etablissement: e.target.value})}
              placeholder="Établissement"
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
            />
          </div>
        </div>
        <button 
          onClick={ajouterEnseignant}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '15px'
          }}
        >
          Ajouter l'enseignant
        </button>
      </div>

      {/* Liste des enseignants */}
      <div>
        <h3>Enseignants existants ({enseignants.length})</h3>
        <div style={{ display: 'grid', gap: '15px' }}>
          {enseignants.map(enseignant => (
            <div key={enseignant.id} style={{ 
              padding: '20px', 
              backgroundColor: '#ffffff', 
              borderRadius: '8px',
              border: '1px solid #dee2e6',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {editingEnseignantId === enseignant.id ? (
                <div>
                  <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '15px' }}>
                    <input
                      type="number"
                      placeholder="ID Moodle"
                      value={editingEnseignant.id_moodle || ''}
                      onChange={e => setEditingEnseignant({...editingEnseignant, id_moodle: e.target.value})}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <input
                      type="text"
                      placeholder="Nom"
                      value={editingEnseignant.nom || ''}
                      onChange={e => setEditingEnseignant({...editingEnseignant, nom: e.target.value})}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <input
                      type="text"
                      placeholder="Prénom"
                      value={editingEnseignant.prenom || ''}
                      onChange={e => setEditingEnseignant({...editingEnseignant, prenom: e.target.value})}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <input
                      type="text"
                      placeholder="Photo URL"
                      value={editingEnseignant.photo || ''}
                      onChange={e => setEditingEnseignant({...editingEnseignant, photo: e.target.value})}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <input
                      type="text"
                      placeholder="Établissement"
                      value={editingEnseignant.etablissement || ''}
                      onChange={e => setEditingEnseignant({...editingEnseignant, etablissement: e.target.value})}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={updateEnseignant}
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
                      onClick={() => setEditingEnseignantId(null)}
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
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ 
                        width: '50px', 
                        height: '50px', 
                        borderRadius: '50%', 
                        backgroundColor: '#e9ecef',
                        backgroundImage: `url(${getPhotoUrl(enseignant.photo)})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}></div>
                      <div>
                        <h4 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>
                          {enseignant.prenom} {enseignant.nom}
                        </h4>
                        <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
                          ID Moodle: {enseignant.id_moodle} | {enseignant.etablissement}
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        onClick={() => {
                          setEditingEnseignantId(enseignant.id)
                          setEditingEnseignant({...enseignant})
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
                        onClick={() => supprimerEnseignant(enseignant.id)}
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

                  {/* Token et lien */}
                  <div style={{ 
                    backgroundColor: '#f8f9fa', 
                    padding: '10px', 
                    borderRadius: '4px',
                    marginBottom: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <strong>Token d'accès :</strong>
                      <button 
                        onClick={() => regenererToken(enseignant.id)}
                        style={{
                          backgroundColor: '#ffc107',
                          color: 'black',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        🔄 Régénérer
                      </button>
                    </div>
                    <code style={{ fontSize: '12px', wordBreak: 'break-all' }}>{enseignant.token}</code>
                    <div style={{ marginTop: '5px' }}>
                      <strong>Lien d'accès :</strong>
                      <div style={{ fontSize: '12px', color: '#007bff', wordBreak: 'break-all' }}>
                        {generateTeacherUrl(enseignant.token)}
                      </div>
                    </div>
                  </div>

                  {/* Gestion des classes */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => {
                        setSelectedEnseignant(enseignant)
                        fetchEnseignantClasses(enseignant.id)
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
                      📚 Gérer les classes
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal de gestion des classes */}
      {selectedEnseignant && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            minWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>Classes de {selectedEnseignant.prenom} {selectedEnseignant.nom}</h3>
            
            {/* Classes associées */}
            <div style={{ marginBottom: '20px' }}>
              <h4>Classes assignées :</h4>
              {enseignantClasses.length === 0 ? (
                <p style={{ color: '#6c757d', fontStyle: 'italic' }}>Aucune classe assignée</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {enseignantClasses.map(classe => (
                    <div key={classe.id} style={{
                      backgroundColor: '#e7f3ff',
                      padding: '5px 10px',
                      borderRadius: '15px',
                      border: '1px solid #b8daff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <span>{classe.nom}</span>
                      <button
                        onClick={() => supprimerAssociation(classe.id)}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#dc3545',
                          cursor: 'pointer',
                          fontSize: '16px'
                        }}
                        title="Supprimer l'association"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ajouter une classe */}
            <div style={{ marginBottom: '20px' }}>
              <h4>Ajouter une classe :</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {classes
                  .filter(classe => !enseignantClasses.some(ec => ec.id === classe.id))
                  .map(classe => (
                    <button
                      key={classe.id}
                      onClick={() => associerClasse(classe.id)}
                      style={{
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      + {classe.nom}
                    </button>
                  ))
                }
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedEnseignant(null)}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminEnseignant
