import { useState, useEffect } from 'react'
import AdminPanel from './components/AdminPanel'
import TableauNotes from './components/TableauNotes'
import ChoixCompetence from './components/ChoixCompetence'
import Baniere from './components/Baniere'
import { competencesN1N2, tachesProfessionelles } from './data/competences'

import './App.css'

function App() {
  const [isStudentMode, setIsStudentMode] = useState(false)
  const [studentToken, setStudentToken] = useState(null)
  const [studentInfo, setStudentInfo] = useState(null)
  const [appInitialized, setAppInitialized] = useState(false) // Nouveau flag
  
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

  // Fonction pour vérifier le token côté serveur
  const verifyToken = async (token) => {
    try {
      const response = await fetch(`http://${window.location.hostname}:3001/auth/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      
      if (response.ok) {
        const data = await response.json()
        return data // { valid: true, eleve: {...} }
      }
      return { valid: false }
    } catch (error) {
      console.error('Erreur lors de la vérification du token:', error)
      return { valid: false }
    }
  }

  // Fonction pour nettoyer l'URL et sauvegarder le token
  const handleTokenFromURL = () => {
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    
    if (token) {
      // Sauvegarder le token dans localStorage
      localStorage.setItem('student_token', token)
      
      // Nettoyer l'URL pour cacher le token
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname
      window.history.replaceState({}, document.title, newUrl)
      
      return token
    }
    
    return null
  }

  // Fonction de déconnexion élève
  const handleStudentLogout = () => {
    localStorage.removeItem('student_token')
    setIsStudentMode(false)
    setStudentToken(null)
    setStudentInfo(null)
    setClasseChoisie('')
    setCompetenceChoisie(null)
  }

  // Initialisation au chargement
  useEffect(() => {
    const initializeApp = async () => {
      // 1. Vérifier s'il y a un token dans l'URL
      const urlToken = handleTokenFromURL()
      
      // 2. Si pas de token dans l'URL, vérifier le localStorage
      const storedToken = urlToken || localStorage.getItem('student_token')
      
      let isStudentMode = false
      let verification = null
      
      if (storedToken) {
        // 3. Vérifier la validité du token côté serveur
        verification = await verifyToken(storedToken)
        
        if (verification.valid) {
          // Token valide - mode élève
          isStudentMode = true
          setIsStudentMode(true)
          setStudentToken(storedToken)
          setStudentInfo(verification.eleve)
          setClasseChoisie(verification.eleve.classe_id.toString())
          // En mode élève, toujours forcer le bilan (pas de compétence choisie)
          setCompetenceChoisie(null)
        } else {
          // Token invalide - le supprimer
          localStorage.removeItem('student_token')
        }
      }
      
      // 4. Si mode enseignant, restaurer la compétence sauvegardée
      if (!isStudentMode) {
        const saved = localStorage.getItem('choix_competence')
        if (saved) {
          setCompetenceChoisie(JSON.parse(saved))
        }
      }
      
      // 5. Marquer l'app comme initialisée
      setAppInitialized(true)
    }
    
    initializeApp()
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
    // En mode élève, ne pas charger la classe depuis localStorage
    // La classe sera automatiquement définie lors de la vérification du token
    if (!isStudentMode) {
      const savedClasse = localStorage.getItem('classe_choisie')
      if (savedClasse) {
        setClasseChoisie(savedClasse)
      }
    }

    fetch(`http://${window.location.hostname}:3001/classes`)
      .then(res => res.json())
      .then(setClasses)
  }, [isStudentMode])

  const handleClasseChange = (e) => {
    // Empêcher le changement de classe en mode élève
    if (isStudentMode) return
    
    const value = e.target.value
    setClasseChoisie(value)
    localStorage.setItem('classe_choisie', value)
  }

  const handleToggleAdmin = () => {
    setAdminVisible(!adminVisible)
  }

  return (
    <>
      {/* Bouton de déconnexion pour les élèves - maintenant dans la bannière */}
      <Baniere
        classes={classes}
        classeChoisie={classeChoisie}
        onClasseChange={handleClasseChange}
        isAdmin={isAdmin && !isStudentMode} // Masquer les fonctions admin en mode élève
        adminVisible={adminVisible && !isStudentMode}
        onToggleAdmin={handleToggleAdmin}
        isStudentMode={isStudentMode}
        studentInfo={studentInfo}
        onStudentLogout={handleStudentLogout}
      />

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem' }}>
        {/* Panneau admin - masqué en mode élève */}
        {(adminVisible && !isStudentMode) ? (
          <div className="card">
            <AdminPanel classeChoisie={classeChoisie} classes={classes} />
          </div>
        ) : (
          <>
            {/* Mode de présentation élève ou première visite - masquer le choix de compétence en mode élève */}
            {(!competenceChoisie && !isModifying && !isStudentMode) && (
              <div className="card">
                <ChoixCompetence
                  key={choixCompetenceKey}
                  isStudentMode={isStudentMode}
                  onChoixFinal={(selection) => {
                    setCompetenceChoisie(selection)
                    setIsModifying(false)
                  }}
                />
                <div style={{
                  backgroundColor: isStudentMode ? '#f0fff0' : '#f0f8ff',
                  padding: '15px',
                  borderRadius: '8px',
                  marginTop: '20px',
                  border: `1px solid ${isStudentMode ? '#ccf5cc' : '#cce7ff'}`
                }}>
                  <h4 style={{ margin: '0 0 10px 0', color: isStudentMode ? '#2d5a2d' : '#2c5282' }}>
                    {isStudentMode ? '� Votre bilan personnel par bloc de compétence' : '📊 Bilan de la période pour chaque Bloc de compétence'}
                  </h4>
                  <p style={{ margin: 0, color: '#2d3748' }}>
                    {isStudentMode ? (
                      <>Consultez vos <strong>évaluations</strong> et votre progression dans <strong>tous les blocs de compétences</strong>. 
                      Les données sont triées par date croissante pour suivre votre évolution.</>
                    ) : (
                      <>Vous voyez toutes <strong>les évaluations</strong> pour toutes <strong>les compétences par bloc</strong>.
                      Vous pouvez Bypasser le Positionnement Automatique d'une compétence secondaire. Pour déterminer la note final sur 20 d'un bloc
                      <br></br> Les évaluations sont triées par date croissante.</>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* En mode élève, afficher directement le message de bilan */}
            {isStudentMode && !competenceChoisie && (
              <div className="card">
                <div style={{
                  backgroundColor: '#f0fff0',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid #ccf5cc'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#2d5a2d' }}>
                    🎯 Votre bilan personnel par bloc de compétence
                  </h4>
                  <p style={{ margin: 0, color: '#2d3748' }}>
                    Consultez vos <strong>évaluations</strong> et votre progression dans <strong>tous les blocs de compétences</strong>. 
                    Les données sont triées par date croissante pour suivre votre évolution.
                  </p>
                </div>
              </div>
            )}

            {/* Modification de compétence */}
            {(!competenceChoisie && isModifying) && (
              <div className="card">
                <ChoixCompetence
                  key={choixCompetenceKey}
                  isStudentMode={isStudentMode}
                  onChoixFinal={(selection) => {
                    setCompetenceChoisie(selection)
                    setIsModifying(false)
                  }}
                />
              </div>
            )}

            {/* Compétence sélectionnée */}
            {competenceChoisie && (
              <div className="card">
                <div>
                  <h4>Compétence sélectionnée :</h4>

                  <button className="competence-active" onClick={() => {
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
                      <em>{isStudentMode ? '📈' : '📝'} {isStudentMode ? 'Consultation' : 'L\'évaluation'} de la compétence {competenceChoisie.niveau1} {isStudentMode ? 'avec toutes ses compétences secondaires' : 'sera distillée dans toutes ses compétences secondaires'}</em>
                    )}
                    {competenceChoisie.niveau2 && !competenceChoisie.niveau3 && (
                      <em>{isStudentMode ? '�' : '�📝'} {isStudentMode ? 'Vous consultez cette compétence secondaire' : 'Vous pouvez évaluer cette compétence secondaire'} {competenceChoisie.niveau2} {isStudentMode ? 'et voyez tous les critères d\'évaluation' : 'et voir toutes les critères d\'évaluation déjà évalués'}</em>
                    )}
                    {competenceChoisie.niveau3 && (
                      <em>{isStudentMode ? '📈' : '📝'} {isStudentMode ? 'Vous consultez uniquement' : 'Vous évaluez uniquement'} : {competenceChoisie.niveau3} qui {isStudentMode ? 'est pris en compte' : 'sera prise en compte'} dans la compétence secondaire {competenceChoisie.niveau2}</em>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <TableauNotes 
                competenceChoisie={competenceChoisie} 
                classeChoisie={classeChoisie} 
                classes={classes}
                isStudentMode={isStudentMode}
                studentInfo={studentInfo}
                appInitialized={appInitialized}
              />
            </div>
          </>
        )}
      </div>
    </>
  )

}

export default App