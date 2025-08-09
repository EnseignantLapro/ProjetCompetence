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
  const [isTeacherMode, setIsTeacherMode] = useState(false)
  const [teacherToken, setTeacherToken] = useState(null)
  const [superAdmin, setSuperAdmin] = useState(false)
  const [teacherInfo, setTeacherInfo] = useState(null)
  const [appInitialized, setAppInitialized] = useState(false) // Nouveau flag
  
    // À remplacer plus tard par détection Moodle
  
  // Vérifier si on a accès aux fonctions admin
  const hasAdminAccess = () => {
    
    
    // Mode élève : pas d'accès admin
    if (isStudentMode) return false
    
    // Mode enseignant : accès admin seulement si référent
    if (isTeacherMode && teacherInfo) return teacherInfo.referent
    
    return false
  }
  const [adminVisible, setAdminVisible] = useState(false)
  const [competenceChoisie, setCompetenceChoisie] = useState(null)
  const [classes, setClasses] = useState([])
  const [classeChoisie, setClasseChoisie] = useState('')
  const [choixCompetenceKey, setChoixCompetenceKey] = useState(0) // Pour forcer le rechargement du composant
  const [isModifying, setIsModifying] = useState(false) // Pour distinguer modification vs première sélection

  const [nomNiveau1, setNomNiveau1] = useState('')
  const [nomNiveau2, setNomNiveau2] = useState('')
  const [nomNiveau3, setNomNiveau3] = useState('')

  // Fonction pour vérifier le token élève côté serveur
  const verifyStudentToken = async (token) => {
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
      console.error('Erreur lors de la vérification du token élève:', error)
      return { valid: false }
    }
  }

  // Fonction pour vérifier le token enseignant côté serveur
  const verifyTeacherToken = async (token) => {
    try {
      const response = await fetch(`http://${window.location.hostname}:3001/auth/verify-teacher-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      
      if (response.ok) {
        const data = await response.json()
        return data // { valid: true, enseignant: {...} }
      }
      return { valid: false }
    } catch (error) {
      console.error('Erreur lors de la vérification du token enseignant:', error)
      return { valid: false }
    }
  }

  // Fonction pour nettoyer l'URL et sauvegarder les tokens
  const handleTokensFromURL = () => {
    const urlParams = new URLSearchParams(window.location.search)
    const studentToken = urlParams.get('token')
    const teacherToken = urlParams.get('teacher_token')
    
    let foundToken = null
    let tokenType = null
    
    if (studentToken) {
      // Token élève : supprimer le token enseignant s'il existe
      localStorage.removeItem('teacher_token')
      localStorage.setItem('student_token', studentToken)
      foundToken = studentToken
      tokenType = 'student'
    } else if (teacherToken) {
      // Token enseignant : supprimer le token élève s'il existe
      localStorage.removeItem('student_token')
      localStorage.setItem('teacher_token', teacherToken)
      foundToken = teacherToken
      tokenType = 'teacher'
    }
    
    if (foundToken) {
      // Nettoyer l'URL pour cacher le token
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname
      window.history.replaceState({}, document.title, newUrl)
    }
    
    return { token: foundToken, type: tokenType }
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

  // Fonction de déconnexion enseignant
  const handleTeacherLogout = () => {
    localStorage.removeItem('teacher_token')
    setIsTeacherMode(false)
    setTeacherToken(null)
    setTeacherInfo(null)
    // Garder les autres états pour retourner en mode normal
  }

  // Initialisation au chargement
  useEffect(() => {
    const initializeApp = async () => {
      // 1. Vérifier s'il y a des tokens dans l'URL (priorité absolue)
      const urlTokens = handleTokensFromURL()
      
      // 2. Déterminer quel token utiliser
      let tokenToCheck = null
      let tokenType = null
      
      if (urlTokens.token) {
        // Token dans l'URL - priorité absolue
        tokenToCheck = urlTokens.token
        tokenType = urlTokens.type
      } else {
        // Pas de token dans l'URL, vérifier localStorage
        const storedStudentToken = localStorage.getItem('student_token')
        const storedTeacherToken = localStorage.getItem('teacher_token')
        
        if (storedStudentToken) {
          tokenToCheck = storedStudentToken
          tokenType = 'student'
        } else if (storedTeacherToken) {
          tokenToCheck = storedTeacherToken
          tokenType = 'teacher'
        }
      }
      
      // 3. Vérifier le token selon son type
      if (tokenToCheck && tokenType === 'student') {
        const studentVerification = await verifyStudentToken(tokenToCheck)
        
        if (studentVerification.valid) {
          // Token élève valide
          setIsStudentMode(true)
          setStudentToken(tokenToCheck)
          setStudentInfo(studentVerification.eleve)
          setClasseChoisie(studentVerification.eleve.classe_id.toString())
          // En mode élève, toujours forcer le bilan (pas de compétence choisie)
          setCompetenceChoisie(null)
        } else {
          // Token élève invalide - le supprimer
          localStorage.removeItem('student_token')
        }
      } else if (tokenToCheck && tokenType === 'teacher') {
        const teacherVerification = await verifyTeacherToken(tokenToCheck)
        
        if (teacherVerification.valid) {
          // Token enseignant valide
          teacherVerification.enseignant.token = tokenToCheck // Ajouter le token à l'objet de vérification
          setIsTeacherMode(true)
          setTeacherToken(tokenToCheck)
          setTeacherInfo(teacherVerification.enseignant)
          // Les enseignants gardent leur comportement normal (compétence persistée)
        } else {
          // Token enseignant invalide - le supprimer
          localStorage.removeItem('teacher_token')
        }
      } else {
        // Aucun token valide - mode normal

      //TODO SUPER ADMIN
      setSuperAdmin(true)
        tokenToCheck = "wyj4zi9yan5qktoby5alm"
        const teacherVerification = await verifyTeacherToken(tokenToCheck)
        
        if (teacherVerification.valid) {
          // Token enseignant valide
          teacherVerification.enseignant.token = tokenToCheck
          setIsTeacherMode(true)
          setTeacherToken(tokenToCheck)
          setTeacherInfo(teacherVerification.enseignant)
          // Les enseignants gardent leur comportement normal (compétence persistée)
        }


        const saved = localStorage.getItem('choix_competence')
        if (saved) {
          setCompetenceChoisie(JSON.parse(saved))
        }
      }
      
      // 4. Marquer l'app comme initialisée
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
    // En mode enseignant, charger depuis les classes assignées ou localStorage
    if (!isStudentMode && !isTeacherMode) {
      const savedClasse = localStorage.getItem('classe_choisie')
      if (savedClasse) {
        setClasseChoisie(savedClasse)
      }
    } else if (isTeacherMode && teacherInfo && teacherInfo.classes && teacherInfo.classes.length > 0) {
      // En mode enseignant, sélectionner la première classe assignée par défaut
      if (!classeChoisie) {
        setClasseChoisie(teacherInfo.classes[0].id.toString())
      }
    }

    // Charger toutes les classes pour l'affichage
    fetch(`http://${window.location.hostname}:3001/classes`)
      .then(res => res.json())
      .then(allClasses => {
        if (isTeacherMode && teacherInfo && teacherInfo.classes) {
          // En mode enseignant, filtrer pour ne montrer que les classes assignées
          setClasses(teacherInfo.classes)
        } else {
          // Mode normal ou élève : toutes les classes
          setClasses(allClasses)
        }
      })
  }, [isStudentMode, isTeacherMode, teacherInfo])

  const handleClasseChange = (e) => {
    // Empêcher le changement de classe en mode élève
    if (isStudentMode) return
    
    const value = e.target.value
    setClasseChoisie(value)
    
    // Sauvegarder en localStorage seulement en mode normal (pas enseignant connecté)
    if (!isTeacherMode) {
      localStorage.setItem('classe_choisie', value)
    }
  }

  const handleToggleAdmin = () => {
    setAdminVisible(!adminVisible)
  }

  return (
    <>
      {/* Bannière avec gestion des modes élève et enseignant */}
      <Baniere
        classes={classes}
        classeChoisie={classeChoisie}
        onClasseChange={handleClasseChange}
        isAdmin={hasAdminAccess()} // Masquer les fonctions admin selon le mode et les permissions
        adminVisible={adminVisible && hasAdminAccess()}
        onToggleAdmin={handleToggleAdmin}
        isStudentMode={isStudentMode}
        studentInfo={studentInfo}
        onStudentLogout={handleStudentLogout}
        isTeacherMode={isTeacherMode}
        teacherInfo={teacherInfo}
        onTeacherLogout={handleTeacherLogout}
        hasAdminAccess={hasAdminAccess()}
      />

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem' }}>
        {/* Panneau admin - masqué en mode élève et enseignant */}
        {(adminVisible && hasAdminAccess()) ? (
          <div className="card">
            <AdminPanel classeChoisie={classeChoisie} classes={classes} isSuperAdmin={superAdmin} teacherInfo={teacherInfo} isTeacherReferent={teacherInfo.referent} />
          </div>    
        ) : (
          <>
            {/* Mode de présentation normale - masquer le choix de compétence en mode élève */}
            {(!competenceChoisie && !isModifying && !isStudentMode) && (
              <div className="card">
                <ChoixCompetence
                  key={choixCompetenceKey}
                  isStudentMode={isStudentMode}
                  isTeacherMode={isTeacherMode}
                  onChoixFinal={(selection) => {
                    setCompetenceChoisie(selection)
                    setIsModifying(false)
                  }}
                />
                <div style={{
                  backgroundColor: isStudentMode ? '#f0fff0' : isTeacherMode ? '#fff0f5' : '#f0f8ff',
                  padding: '15px',
                  borderRadius: '8px',
                  marginTop: '20px',
                  border: `1px solid ${isStudentMode ? '#ccf5cc' : isTeacherMode ? '#f5ccf5' : '#cce7ff'}`
                }}>
                  <h4 style={{ margin: '0 0 10px 0', color: isStudentMode ? '#2d5a2d' : isTeacherMode ? '#8b2c7a' : '#2c5282' }}>
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
                isTeacherMode={isTeacherMode}
                teacherInfo={teacherInfo}
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