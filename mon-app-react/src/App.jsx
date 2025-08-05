import { useState, useEffect } from 'react'
import AdminPanel from './components/AdminPanel'
import TableauNotes from './components/TableauNotes'
import ChoixCompetence from './components/ChoixCompetence'
import { competencesN1N2 } from './data/competences'

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

    // Niveau 3 depuis la BDD
    if (niveau2 && niveau3) {
      fetch(`http://localhost:3001/competences-n3?parent_code=${niveau2}`)
        .then(res => res.json())
        .then(data => {
          const found = data.find(sc => sc.code === niveau3)
          setNomNiveau3(found?.nom || '')
        })
    } else {
      setNomNiveau3('')
    }
  }, [competenceChoisie])

  useEffect(() => {


    const savedClasse = localStorage.getItem('classe_choisie')
    if (savedClasse) {
      setClasseChoisie(savedClasse)
    }

    fetch('http://localhost:3001/classes')
      .then(res => res.json())
      .then(setClasses)

    
  }, [])

  const handleClasseChange = (e) => {
    const value = e.target.value
    setClasseChoisie(value)
    localStorage.setItem('classe_choisie', value)
  }

  const getClasseName = () => {
    if (!classeChoisie) return ''
    const classe = classes.find(c => c.id == classeChoisie)
    return classe ? classe.nom : ''
  }

  return (
    <>
      <h1>Compétence Julien Code</h1>

      <div>
        <label htmlFor="select-classe">Classe :</label>{' '}
        <select id="select-classe" value={classeChoisie} onChange={handleClasseChange}>
          <option value="">-- Choisir une classe --</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
       
      </div>

      {isAdmin && !adminVisible && (
        <button onClick={() => setAdminVisible(true)}>Gérer l’appli</button>
      )}

      {isAdmin && adminVisible && (
        <>
          <button onClick={() => setAdminVisible(false)}>Revenir</button>
          <AdminPanel classeChoisie={classeChoisie} classes={classes} />
        </>
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
              📊 Mode Vue d'ensemble
            </h4>
            <p style={{ margin: 0, color: '#2d3748' }}>
              Aucune compétence sélectionnée : vous voyez <strong>toutes les notes de tous les élèves</strong> pour toutes les compétences. 
              Sélectionnez une compétence ci-dessus pour pouvoir noter les élèves ou filtrer l'affichage.
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
            <p>

              {competenceChoisie.niveau1} — {nomNiveau1 || ''}<br />
              {competenceChoisie.niveau2 || ''} {nomNiveau2 && `— ${nomNiveau2}`}<br />
              {competenceChoisie.niveau3 || ''} {nomNiveau3 && `— ${nomNiveau3}`}

            </p>
            <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '10px' }}>
              {!competenceChoisie.niveau3 && !competenceChoisie.niveau2 && (
                <em>📝 Vous pouvez noter la compétence {competenceChoisie.niveau1} ET voir toutes ses sous-compétences</em>
              )}
              {competenceChoisie.niveau2 && !competenceChoisie.niveau3 && (
                <em>📝 Vous pouvez noter cette sous-compétence {competenceChoisie.niveau2} ET voir toutes ses sous-compétences</em>
              )}
              {competenceChoisie.niveau3 && (
                <em>📝  Notation uniquement pour {competenceChoisie.niveau3}</em>
              )}
            </div>
            <button onClick={() => {
              setIsModifying(true)
              setCompetenceChoisie(null)
              // Les valeurs restent en localStorage pour que ChoixCompetence les récupère
              // Forcer le rechargement du composant ChoixCompetence
              setChoixCompetenceKey(prev => prev + 1)
            }}>Changer</button>
          </div>


        </>
      )}

      {!adminVisible && (
        <div className="card">
          <h2>Liste des élèves</h2>
          <TableauNotes competenceChoisie={competenceChoisie} classeChoisie={classeChoisie} classes={classes}/>
        </div>
      )}
    </>
  )
}

export default App