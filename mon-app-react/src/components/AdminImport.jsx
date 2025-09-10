import React, { useState } from 'react'
import { apiFetch } from '../utils/api'

function AdminImport({ classeChoisie, getClasseName }) {
  const [csvFile, setCsvFile] = useState(null)

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
            const response = await apiFetch(`/eleves`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nom,
                prenom,
                id_moodle: id_moodle,
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

  return (
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
  )
}

export default AdminImport
