import React, { useState, useEffect } from 'react'

function AdminClasse() {
  const [classesWithCounts, setClassesWithCounts] = useState([])
  const [newClasse, setNewClasse] = useState('')
  const [editingClasseId, setEditingClasseId] = useState(null)
  const [editingClasseNom, setEditingClasseNom] = useState('')

  // Chargement des classes avec le nombre d'élèves
  useEffect(() => {
    fetch(`http://${window.location.hostname}:3001/classes/with-counts`)
      .then(res => res.json())
      .then(setClassesWithCounts)
  }, [])

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

  return (
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
  )
}

export default AdminClasse
