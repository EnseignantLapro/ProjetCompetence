import React, { useState, useEffect } from 'react'

function AdminPanel({ classeChoisie, classes }) {
  const [competences, setCompetences] = useState([])
  const [newComp, setNewComp] = useState('')

  const [newClasse, setNewClasse] = useState('')
  const [editingClasseId, setEditingClasseId] = useState(null)
  const [editingClasseNom, setEditingClasseNom] = useState('')

  const [csvFile, setCsvFile] = useState(null)

  // Chargement initial
  useEffect(() => {
    fetch('http://localhost:3001/competences')
      .then(res => res.json())
      .then(setCompetences)
  }, [])

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
            const response = await fetch('http://localhost:3001/eleves', {
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

  // Ajout compétence
  const ajouterCompetence = async () => {
    if (!newComp.trim()) return
    const res = await fetch('http://localhost:3001/competences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: newComp }),
    })
    const data = await res.json()
    setCompetences([...competences, data])
    setNewComp('')
  }

  // Ajout classe
  const ajouterClasse = async () => {
    if (!newClasse.trim()) return
    const res = await fetch('http://localhost:3001/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: newClasse }),
    })
    const data = await res.json()
    // Note: Il faudrait remonter cette info à App.jsx pour mettre à jour la liste
    setNewClasse('')
    alert('Classe ajoutée ! Rechargez la page pour voir les changements.')
  }

  // Modifier classe
  const updateClasse = async () => {
    if (!editingClasseNom.trim()) return
    const res = await fetch(`http://localhost:3001/classes/${editingClasseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: editingClasseNom }),
    })
    const updated = await res.json()
    // Note: Il faudrait remonter cette info à App.jsx pour mettre à jour la liste
    setEditingClasseId(null)
    setEditingClasseNom('')
    alert('Classe modifiée ! Rechargez la page pour voir les changements.')
  }

  // Supprimer classe
  const supprimerClasse = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette classe ?')) return
    await fetch(`http://localhost:3001/classes/${id}`, {
      method: 'DELETE',
    })
    // Note: Il faudrait remonter cette info à App.jsx pour mettre à jour la liste
    alert('Classe supprimée ! Rechargez la page pour voir les changements.')
  }

  const getClasseName = () => {
    if (!classeChoisie) return 'Aucune classe sélectionnée'
    const classe = classes.find(c => c.id == classeChoisie)
    return classe ? classe.nom : 'Classe introuvable'
  }

  return (
    <div>
      <h2>Admin : Gestion des compétences</h2>
      <input
        type="text"
        value={newComp}
        onChange={e => setNewComp(e.target.value)}
        placeholder="Nouvelle compétence"
      />
      <button onClick={ajouterCompetence}>Ajouter</button>
      <ul>
        {competences.map(c => (
          <li key={c.id}>{c.nom}</li>
        ))}
      </ul>


      <h2>Gestion des classes</h2>
      <input
        type="text"
        value={newClasse}
        onChange={e => setNewClasse(e.target.value)}
        placeholder="Nom de la nouvelle classe"
      />
      <button onClick={ajouterClasse}>Ajouter</button>

      <ul>
        {classes.map(c => (
          <li key={c.id}>
            {editingClasseId === c.id ? (
              <>
                <input
                  type="text"
                  value={editingClasseNom}
                  onChange={e => setEditingClasseNom(e.target.value)}
                />
                <button onClick={updateClasse}>Valider</button>
                <button onClick={() => setEditingClasseId(null)}>Annuler</button>
              </>
            ) : (
              <>
                {c.nom}{' '}
                <button onClick={() => {
                  setEditingClasseId(c.id)
                  setEditingClasseNom(c.nom)
                }}>✏️</button>
                <button onClick={() => supprimerClasse(c.id)}>🗑️</button>
              </>
            )}
          </li>
        ))}
      </ul>

      <div>
        <h2>Admin : Import des élèves</h2>
        
        <p><strong>Classe de destination :</strong> {getClasseName()}</p>
        
        {!classeChoisie && (
          <p style={{ color: 'orange' }}>
            ⚠️ Sélectionnez d'abord une classe dans le menu principal pour pouvoir importer des élèves.
          </p>
        )}

        <div style={{ marginTop: '1rem' }}>
          <input type="file" accept=".csv" onChange={handleCSVChange} disabled={!classeChoisie} />
          <button onClick={handleCSVUpload} disabled={!classeChoisie || !csvFile}>
            Importer le CSV
          </button>
        </div>

        <p style={{ marginTop: '1rem' }}>
          Format attendu : <code>id_moodle,prenom,nom</code> (première ligne = en-tête)
        </p>
      </div>

    </div>
  )
}

export default AdminPanel