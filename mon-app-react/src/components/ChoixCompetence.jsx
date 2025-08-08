import { useState, useEffect } from 'react'
import { competencesN1N2, tachesProfessionelles } from '../data/competences'
import '../App.css'

function ChoixCompetence({ onChoixFinal, isStudentMode = false, isTeacherMode = false }) {
  const [niveau1, setNiveau1] = useState('')
  const [niveau2, setNiveau2] = useState('')
  const [niveau3, setNiveau3] = useState('')
  const [niveau3Texte, setNiveau3Texte] = useState('')
  const [niveau3EnBase, setNiveau3EnBase] = useState([])
  const [showModal, setShowModal] = useState(false)

  const OPTION_AJOUTER = '__ajouter__'

  useEffect(() => {
    // En mode élève, ne pas charger les données du localStorage
    if (!isStudentMode && !isTeacherMode) {
      const saved = localStorage.getItem('choix_competence')
      if (saved) {
        const { niveau1, niveau2, niveau3 } = JSON.parse(saved)
        setNiveau1(niveau1)
        setNiveau2(niveau2 || '')
        setNiveau3(niveau3 || '')
      } else {
        // Si aucune sauvegarde, réinitialiser complètement
        setNiveau1('')
        setNiveau2('')
        setNiveau3('')
        setNiveau3Texte('')
        setNiveau3EnBase([])
      }
      
      // Marquer qu'on vient de charger la page (nouvelle évaluation)
      localStorage.setItem('mode_evaluation', 'nouvelle')
    } else {
      // En mode élève ou enseignant, réinitialiser complètement
      setNiveau1('')
      setNiveau2('')
      setNiveau3('')
      setNiveau3Texte('')
      setNiveau3EnBase([])
    }
  }, [isStudentMode, isTeacherMode])

useEffect(() => {
  if (niveau2) {
    // 1. Charger les compétences N3 de la base de données (créées par les profs)
    fetch(`http://${window.location.hostname}:3001/competences-n3?parent_code=${niveau2}`)
      .then(res => res.json())
      .then(competencesN3BDD => {
        
        // 2. Charger les tâches professionnelles du fichier selon la compétence N1 du N2 sélectionné
        let tachesFromFile = []
        
        // Extraire la compétence N1 du code N2 (ex: C01.1 -> C01)
        const competenceN1 = niveau2.split('.')[0]
        
        if (competenceN1) {
          // Filtrer les tâches professionnelles qui contiennent cette compétence N1
          const tachesCompatibles = tachesProfessionelles.filter(tache => 
            tache.competences.includes(competenceN1)
          )
          
          // Créer une liste de toutes les tâches associées avec leur parent
          tachesCompatibles.forEach(tacheProf => {
            tacheProf.TacheAssociees.forEach(tache => {
              tachesFromFile.push({
                code: `${niveau2}.${tacheProf.code}.${tache.code}`, // Ex: C01.1.R1.T1
                nom: `${tacheProf.nom} — ${tache.nom}`, // Nom simplifié
                parent_code: niveau2,
                source: 'fichier', // Pour identifier la source
                tacheProf: tacheProf,
                tache: tache
              })
            })
          })
        }
        
        // 3. Combiner les deux sources
        const toutesLesOptions = [
          ...competencesN3BDD.map(comp => ({ ...comp, source: 'bdd' })),
          ...tachesFromFile
        ]
        
        setNiveau3EnBase(toutesLesOptions)
      })
  } else {
    setNiveau3EnBase([])
    setNiveau3('')
  }
}, [niveau2])

  const competence1 = competencesN1N2.find(c => c.code === niveau1)
  const sousCompetences = competence1?.enfants || []

  const genererCodeN3 = () => {
    const index = niveau3EnBase.length + 1
    return `${niveau2}.${index}`
  }

  const enregistrerNiveau3 = async () => {
    const nom = niveau3Texte.trim()
    if (!nom) return
    const code = genererCodeN3()

    const res = await fetch(`http://${window.location.hostname}:3001/competences-n3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_code: niveau2, code, nom }),
    })

    const data = await res.json()
    const newList = [...niveau3EnBase, data]
    setNiveau3EnBase(newList)
    setNiveau3(data.code) // sélection automatique
    setNiveau3Texte('')
    setShowModal(false) // Fermer la modal
  }

  const annulerAjout = () => {
    setNiveau3Texte('')
    setNiveau3('')
    setShowModal(false)
  }

  const valider = () => {
    // Récupérer l'ancienne sélection pour détecter les changements
    const saved = localStorage.getItem('choix_competence')
    let anciselection = null
    if (saved) {
      anciselection = JSON.parse(saved)
    }

    // Si aucun niveau1 n'est sélectionné, passer en mode vue d'ensemble
    if (!niveau1) {
      const selection = null
      // Ne sauvegarder que si on n'est pas en mode élève ou enseignant
      if (!isStudentMode && !isTeacherMode) {
        localStorage.setItem('choix_competence', JSON.stringify({ niveau1: '', niveau2: '', niveau3: '' }))
        localStorage.setItem('mode_evaluation', 'nouvelle')
      }
      onChoixFinal(selection)
      return
    }
    
    // Construire la nouvelle sélection
    const nouvelleSelection = {
      niveau1,
      niveau2: niveau2 || null,
      niveau3: niveau3 || null,
    }
    
    // Détecter si la compétence a changé
    const competenceAChange = !anciselection || 
      anciselection.niveau1 !== nouvelleSelection.niveau1 ||
      anciselection.niveau2 !== nouvelleSelection.niveau2 ||
      anciselection.niveau3 !== nouvelleSelection.niveau3
    
    // Définir le mode selon le changement
    const mode = competenceAChange ? 'nouvelle' : 'edition'
    
    // Ne sauvegarder que si on n'est pas en mode élève ou enseignant
    if (!isStudentMode && !isTeacherMode) {
      localStorage.setItem('choix_competence', JSON.stringify(nouvelleSelection))
      localStorage.setItem('mode_evaluation', mode)
    }
    onChoixFinal(nouvelleSelection)
  }

  return (
    <div className="choix-competence-container">
      <h3>Choisir une compétence</h3>

      {/* Niveau 1 */}
      <label>Compétence Principale :</label>
      <select value={niveau1} onChange={e => {
        setNiveau1(e.target.value)
        setNiveau2('')
        setNiveau3('')
        setNiveau3Texte('')
      }} title="Sélectionnez une compétence principale">
        <option value="">Bilan</option>
        {competencesN1N2.map(c => (
          <option key={c.code} value={c.code} title={`${c.code} — ${c.nom}`}>
            {c.code} — {c.nom}
          </option>
        ))}
      </select>
<br></br>
      {/* Niveau 2 */}
      {sousCompetences.length > 0 && (
        <>
          <label>Compétence secondaire <small>(recommandée)</small> : </label>
          <select value={niveau2} onChange={e => {
            setNiveau2(e.target.value)
            setNiveau3('')
            setNiveau3Texte('')
          }} title="Sélectionnez une compétence secondaire">
            <option value="">Aucune compétence secondaire</option>
            {sousCompetences.map(sc => (
              <option key={sc.code} value={sc.code} title={`${sc.code} — ${sc.nom}`}>
                {sc.code} — {sc.nom}
              </option>
            ))}
          </select>
        </>
      )}
<br></br>
      {/* Niveau 3 - Compétences BDD + Tâches professionnelles */}
      {niveau2 && (
        <>
          <label>Critère d'évaluation / activité <small>(optionnel)</small> :</label>
          <select value={niveau3} onChange={e => {
            if (e.target.value === OPTION_AJOUTER) {
              setShowModal(true)
            } else {
              setNiveau3(e.target.value)
            }
          }} title="Sélectionnez un critère d'évaluation">
            <option value="">-- Laisser vide pour évaluer la compétence secondaire uniquement --</option>
             <option value={OPTION_AJOUTER}>➕ Ajouter un nouveau critère d'évaluation ou activité</option>
            {niveau3EnBase.map(c => (
              <option key={c.code} value={c.code} title={c.nom}>
                {`${c.code} — ${c.nom}`}
              </option>
            ))}
            <option value={OPTION_AJOUTER}>➕ Ajouter un nouveau critère d'évaluation ou activité</option>
          </select>
          <br></br>
        </>
      )}

      <button 
        className='btn btn-primary' 
        onClick={valider}
        title={!niveau1 ? "Mode vue d'ensemble" : "Mode filtré sur la compétence sélectionnée"}
      >
        {!niveau1 ? "🏆 Vue d'ensemble" : "Valider le choix"}
      </button>

      {/* Modal pour ajouter une nouvelle compétence secondaire*/}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            minWidth: '400px',
            maxWidth: '500px'
          }}>
            <h4 style={{ marginTop: 0 }}>Ajouter un nouveau critère d'évaluation </h4>
            <p style={{ color: '#666', fontSize: '0.9em' }}>
             Pour <strong>{niveau2}.X</strong>
            </p>
            <input
              type="text"
              value={niveau3Texte}
              onChange={e => setNiveau3Texte(e.target.value)}
              placeholder="Ex. : Oral clair et fort"
              style={{
                width: '100%',
                padding: '8px',
                margin: '10px 0',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                onClick={annulerAjout}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>
              <button 
                onClick={enregistrerNiveau3}
                disabled={!niveau3Texte.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: niveau3Texte.trim() ? '#007bff' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: niveau3Texte.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default ChoixCompetence