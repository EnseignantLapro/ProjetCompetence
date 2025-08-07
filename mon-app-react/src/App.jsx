import { useState, useEffect } from 'react'
import AdminPanel from './components/AdminPanel'
import TableauNotes from './components/TableauNotes'
import ChoixCompetence from './components/ChoixCompetence'
import Baniere from './components/Baniere'
import { competencesN1N2, tachesProfessionelles } from './data/competences'

import './App.css'

function App() {
  const isAdmin = true // À remplacer plus tard par détection Moodle
  const [adminVisible, setAdminVisible] = useState(false)
  const [competenceChoisie, setCompetenceChoisie] = useState(null)
  const [classes, setClasses] = useState([])
  const [classeChoisie, setClasseChoisie] = useState('')
  const [choixCompetenceKey, setChoixCompetenceKey] = useState(0) // Pour forcer le rechargement du composant
  const [isModifying, setIsModifying] = useState(false) // Pour distinguer modification vs première sélection

  const [nomNiveau1, setNomNiveau1] = useState('')
  const [nomNiveau2, setNomNiveau2] = useState('')
  const [nomNiveau3, setNomNiveau3] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('choix_competence')
    if (saved) {
      setCompetenceChoisie(JSON.parse(saved))
    }
    // Si aucune compétence sauvegardée, on reste en mode "première sélection" (isModifying = false)
  }, [])

  useEffect(() => {
    if (!competenceChoisie) return


    const { niveau1, niveau2, niveau3 } = competenceChoisie

    // Niveau 1 & 2 depuis le fichier local
    const bloc1 = competencesN1N2.find(c => c.code === niveau1)
    if (bloc1) {
      setNomNiveau1(bloc1.nom)
      const sous = bloc1.enfants?.find(s => s.code === niveau2)
      setNomNiveau2(sous?.nom || '')
    }

    // Niveau 3 depuis la BDD ou les tâches professionnelles
    if (niveau2 && niveau3) {
      // Vérifier si c'est un code de tâche professionnelle (4 parties : C01.1.R1.T1)
      const parts = niveau3.split('.')
      if (parts.length === 4) {
        const tacheCode = parts[2] // R1, R2, etc.
        const taskCode = parts[3]  // T1, T2, etc.
        
        const tacheProf = tachesProfessionelles.find(t => t.code === tacheCode)
        if (tacheProf) {
          const tache = tacheProf.TacheAssociees.find(t => t.code === taskCode)
          if (tache) {
            setNomNiveau3(`${tacheProf.nom} — ${tache.nom}`)
          } else {
            setNomNiveau3(niveau3) // Fallback au code si non trouvé
          }
        } else {
          setNomNiveau3(niveau3) // Fallback au code si non trouvé
        }
      } else {
        // Code BDD traditionnel
        fetch(`http://${window.location.hostname}:3001/competences-n3?parent_code=${niveau2}`)
          .then(res => res.json())
          .then(data => {
            const found = data.find(sc => sc.code === niveau3)
            setNomNiveau3(found?.nom || niveau3)
          })
      }
    } else {
      setNomNiveau3('')
    }
  }, [competenceChoisie])

  useEffect(() => {


    const savedClasse = localStorage.getItem('classe_choisie')
    if (savedClasse) {
      setClasseChoisie(savedClasse)
    }

    fetch(`http://${window.location.hostname}:3001/classes`)
      .then(res => res.json())
      .then(setClasses)

    
  }, [])

  const handleClasseChange = (e) => {
    const value = e.target.value
    setClasseChoisie(value)
    localStorage.setItem('classe_choisie', value)
  }

  const handleToggleAdmin = () => {
    setAdminVisible(!adminVisible)
  }

  return (
    <>
      <Baniere
        classes={classes}
        classeChoisie={classeChoisie}
        onClasseChange={handleClasseChange}
        isAdmin={isAdmin}
        adminVisible={adminVisible}
        onToggleAdmin={handleToggleAdmin}
      />

      {adminVisible && (
        <AdminPanel classeChoisie={classeChoisie} classes={classes} />
      )}

      {(!competenceChoisie && !isModifying) && (
        <>
          <ChoixCompetence 
            key={choixCompetenceKey} 
            onChoixFinal={(selection) => {
              setCompetenceChoisie(selection)
              setIsModifying(false)
            }} 
          />
          <div style={{ 
            backgroundColor: '#f0f8ff', 
            padding: '15px', 
            borderRadius: '8px', 
            marginTop: '20px',
            border: '1px solid #cce7ff'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c5282' }}>
              📊  Bilan de la période pour chaque Bloc de compétence.
            </h4>
            <p style={{ margin: 0, color: '#2d3748' }}>
             Vous voyez toutes <strong>les évaluations</strong> pour toutes <strong>les compétences par bloc</strong>. 
             Vous pouvez Bypasser le Positionnement Automatique d'une compétence secondaire. Pour déterminer la note final sur 20 d'un bloc
<br></br> Les évaluations sont triées par date croissante.
            </p>
          </div>
        </>
      )}

      {(!competenceChoisie && isModifying) && (
        <ChoixCompetence 
          key={choixCompetenceKey} 
          onChoixFinal={(selection) => {
            setCompetenceChoisie(selection)
            setIsModifying(false)
          }} 
        />
      )}



      {competenceChoisie && (
        <>
          <div>
            <h4>Compétence sélectionnée :</h4>
           
           
            <button  className="competence-active" onClick={() => {
              setIsModifying(true)
              setCompetenceChoisie(null)
              // Les valeurs restent en localStorage pour que ChoixCompetence les récupère
              // Forcer le rechargement du composant ChoixCompetence
              setChoixCompetenceKey(prev => prev + 1)
            }}>
              {/* Afficher seulement le niveau le plus spécifique */}
               <span >
              {competenceChoisie.niveau3 ? (
                  <>{competenceChoisie.niveau3} — {nomNiveau3}</>
              ) : competenceChoisie.niveau2 ? (
                  <>{competenceChoisie.niveau2} — {nomNiveau2}</>
              ) : (
                  <>{competenceChoisie.niveau1} — {nomNiveau1}</>
              )}
              🔎
             </span>
             
            </button>
             <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '10px' }}>
              {!competenceChoisie.niveau3 && !competenceChoisie.niveau2 && (
                <em>📝  l'évaluation de la compétence {competenceChoisie.niveau1} sera répartie dans toutes ses compétences secondaires</em>
              )}
              {competenceChoisie.niveau2 && !competenceChoisie.niveau3 && (
                <em>📝 Vous pouvez évaluer cette compétence secondaire {competenceChoisie.niveau2} et voir toutes les critères d'évaluation déjà évalués</em>
              )}
              {competenceChoisie.niveau3 && (
                <em>📝  Vous évaluez uniquement : {competenceChoisie.niveau3} qui sera prise en compte dans la compétence secondaire {competenceChoisie.niveau2}</em>
              )}
            </div>
          </div>


        </>
      )}

      {!adminVisible && (
        <div className="card">
        
          <TableauNotes competenceChoisie={competenceChoisie} classeChoisie={classeChoisie} classes={classes}/>
        </div>
      )}
    </>
  )
}

export default App