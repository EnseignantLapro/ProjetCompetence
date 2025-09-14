import React, { useState, useEffect } from 'react'
import { apiFetch } from '../utils/api'

function AdminEvaluation({ classeChoisie, getClasseName, isSuperAdmin = false, isTeacherReferent = false, teacherInfo = null }) {
  const [elevesWithEvaluations, setElevesWithEvaluations] = useState([])
  const [csvEvaluationFile, setCsvEvaluationFile] = useState(null)
  
  // États pour les sections collapsibles
  const [importSectionVisible, setImportSectionVisible] = useState(false)
  const [exportSectionVisible, setExportSectionVisible] = useState(false)

  // Fonction pour gérer correctement les URLs de photos
  const getPhotoUrl = (photoPath) => {
    if (!photoPath) return '/default.jpg'
    
    // Si c'est déjà une URL complète (http:// ou https://), la retourner telle quelle
    if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
      return photoPath
    }
    
    // Sinon, c'est un chemin relatif, ajouter le / devant
    return `/${photoPath}`
  }

  // Composant bouton sandwich
  const BoutonSandwich = ({ onClick, isOpen }) => (
    <button
      onClick={onClick}
      style={{
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        width: '32px',
        height: '32px',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
      title={isOpen ? 'Masquer la section' : 'Afficher la section'}
    >
      <div style={{ 
        width: '20px', 
        height: '3px', 
        backgroundColor: '#666', 
        borderRadius: '1px',
        transform: isOpen ? 'rotate(45deg) translateY(6px)' : 'none',
        transition: 'transform 0.2s'
      }}></div>
      <div style={{ 
        width: '20px', 
        height: '3px', 
        backgroundColor: '#666', 
        borderRadius: '1px',
        opacity: isOpen ? 0 : 1,
        transition: 'opacity 0.2s'
      }}></div>
      <div style={{ 
        width: '20px', 
        height: '3px', 
        backgroundColor: '#666', 
        borderRadius: '1px',
        transform: isOpen ? 'rotate(-45deg) translateY(-6px)' : 'none',
        transition: 'transform 0.2s'
      }}></div>
    </button>
  )

  // Chargement des élèves avec leurs évaluations
  useEffect(() => {
    // Vérifier si la classe sélectionnée est valide
    const classeName = getClasseName()
    const isValidClass = classeChoisie && classeChoisie !== '' && classeChoisie !== '0' && classeName !== 'Classe introuvable'
    
    if (isValidClass) {
      let url = `/eleves/with-evaluations/${classeChoisie}`;
      
      // Si c'est un enseignant référent (pas super admin), filtrer par établissement
      if (isTeacherReferent && !isSuperAdmin && teacherInfo && teacherInfo.etablissement) {
        url += `?etablissement=${encodeURIComponent(teacherInfo.etablissement)}`;
      }

      apiFetch(url)
        .then(res => res.json())
        .then(data => {
          // S'assurer que c'est toujours un tableau
          setElevesWithEvaluations(Array.isArray(data) ? data : [])
        })
        .catch(err => {
          console.error('Erreur lors du chargement des évaluations:', err)
          setElevesWithEvaluations([])
        })
    } else {
      // Aucune classe valide sélectionnée, vider la liste
      setElevesWithEvaluations([])
    }
  }, [classeChoisie, isSuperAdmin, isTeacherReferent, teacherInfo, getClasseName])

  // Fonctions pour gérer les évaluations
  const supprimerToutesEvaluations = async (eleveId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer TOUTES les évaluations de cet élève ?')) return
    
    try {
      const res = await apiFetch(`/eleves/${eleveId}/evaluations`, {
        method: 'DELETE',
      })
      
      if (res.ok) {
        alert('Toutes les évaluations ont été supprimées !')
        // Recharger les données
        if (classeChoisie) {
          let url = `/eleves/with-evaluations/${classeChoisie}`;
          
          // Si c'est un enseignant référent (pas super admin), filtrer par établissement
          if (isTeacherReferent && !isSuperAdmin && teacherInfo && teacherInfo.etablissement) {
            url += `?etablissement=${encodeURIComponent(teacherInfo.etablissement)}`;
          }

          apiFetch(url)
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
           

            const response = await apiFetch(`/evaluations/import`, {
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
          let url = `/eleves/with-evaluations/${classeChoisie}`;
          
          // Si c'est un enseignant référent (pas super admin), filtrer par établissement
          if (isTeacherReferent && !isSuperAdmin && teacherInfo && teacherInfo.etablissement) {
            url += `?etablissement=${encodeURIComponent(teacherInfo.etablissement)}`;
          }
          
          getApiUrl(url)
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

  // Fonction pour exporter les évaluations en CSV
  const exporterEvaluationsCSV = async () => {
    if (!classeChoisie) {
      alert('Aucune classe sélectionnée')
      return
    }

    try {
      // Récupérer les données d'évaluations détaillées
      const response = await apiFetch(`/evaluations/export/${classeChoisie}`)
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données')
      }

      const data = await response.json()
      
      if (!data.eleves || data.eleves.length === 0) {
        alert('Aucune évaluation à exporter dans cette classe')
        return
      }

      // Créer les en-têtes CSV
      const competences = data.competences || []
      const headers = ['id_moodle', 'prenom', 'nom', ...competences.map(c => c.code)]
      
      // Créer les lignes de données
      const csvLines = [headers.join(',')]
      
      data.eleves.forEach(eleve => {
        const ligne = [
          eleve.id_moodle || '',
          eleve.prenom || '',
          eleve.nom || ''
        ]
        
        // Ajouter les évaluations pour chaque compétence
        competences.forEach(competence => {
          const evaluation = eleve.evaluations?.find(e => e.competence_code === competence.code)
          ligne.push(evaluation ? evaluation.couleur : '')
        })
        
        csvLines.push(ligne.join(','))
      })

      // Créer et télécharger le fichier
      const csvContent = csvLines.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `evaluations_${getClasseName().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        alert(`Export terminé ! Fichier téléchargé : evaluations_${getClasseName().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
      }
    } catch (error) {
      console.error('Erreur lors de l\'export:', error)
      alert('Erreur lors de l\'export des évaluations')
    }
  }

  return (
    <div>
      <h2>Gestion des évaluations de la classe {getClasseName()}</h2>

      
        
        
        {(!classeChoisie || getClasseName() === 'Classe introuvable') && (
          <p style={{ color: '#856404', backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px' }}>
            ⚠️ Sélectionnez d'abord une classe valide dans le menu principal pour voir les évaluations.
          </p>
        )}
     

      {classeChoisie && classeChoisie !== '' && classeChoisie !== '0' && getClasseName() !== 'Classe introuvable' ? (
        <>
          {/* Import CSV des évaluations */}
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '20px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: importSectionVisible ? '15px' : '0' }}>
              <h3 style={{ margin: 0 }}>Importer des évaluations par CSV</h3>
              <BoutonSandwich 
                onClick={() => setImportSectionVisible(!importSectionVisible)}
                isOpen={importSectionVisible}
              />
            </div>
            
            {importSectionVisible && (
              <>
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
              </>
            )}
          </div>

          {/* Export CSV des évaluations */}
                    {/* Export CSV des évaluations */}
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '20px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: exportSectionVisible ? '15px' : '0' }}>
              <h3 style={{ margin: 0 }}>Exporter les évaluations en CSV</h3>
              <BoutonSandwich 
                onClick={() => setExportSectionVisible(!exportSectionVisible)}
                isOpen={exportSectionVisible}
              />
            </div>
            
            {exportSectionVisible && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ marginBottom: '10px', color: '#6c757d' }}>
                    Téléchargez toutes les évaluations de la classe au format CSV compatible avec l'import.
                  </p>
                  <button 
                    onClick={exporterEvaluationsCSV} 
                    disabled={!classeChoisie || !elevesWithEvaluations.length}
                    style={{
                      backgroundColor: !classeChoisie || !elevesWithEvaluations.length ? '#6c757d' : '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '4px',
                      cursor: !classeChoisie || !elevesWithEvaluations.length ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                    title={!classeChoisie ? 'Sélectionnez une classe' : !elevesWithEvaluations.length ? 'Aucun élève dans cette classe' : 'Télécharger le fichier CSV'}
                  >
                    📥 Exporter les évaluations CSV
                  </button>
                </div>
                
                <div style={{ 
                  backgroundColor: '#d1ecf1', 
                  padding: '10px', 
                  borderRadius: '4px',
                  border: '1px solid #bee5eb'
                }}>
                  <h4>Fichier généré :</h4>
                  <p style={{ marginTop: '5px', fontSize: '14px', color: '#0c5460' }}>
                    📄 <strong>evaluations_[NomClasse]_[Date].csv</strong><br />
                    • Format identique à celui utilisé pour l'import<br />
                    • Contient tous les élèves de la classe avec leurs évaluations<br />
                    • Compatible pour réimport dans une autre classe
                  </p>
                </div>
              </>
            )}
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
                          backgroundImage: `url(${getPhotoUrl(eleve.photo)})`,
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
      ) : (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#6c757d', 
          fontStyle: 'italic',
          fontSize: '18px'
        }}>
          <p>Sélectionnez une classe pour voir et gérer les évaluations</p>
        </div>
      )}
    </div>
  )
}

export default AdminEvaluation
