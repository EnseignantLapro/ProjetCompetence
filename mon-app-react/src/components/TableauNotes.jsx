import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import './TableauNotes.css'
import ColorPickerModal from './ColorPickerModal'
import PositionnementModal from './PositionnementModal'
import NotePastille from './NotePastille'
import DevoirView from './DevoirView'
import { competencesN1N2, tachesProfessionelles } from '../data/competences'
import { apiFetch } from '../utils/api'
import{getCouleurPourCompetence,isCompetenceInHierarchy,isCompetenceN1,getNotesVisibles,ajouterNoteDirecte,getCommentaireDerniereEvaluation} from './TableauNotesUtils'

function TableauNotes({ competenceChoisie, classeChoisie, classes, eleveFiltre, isStudentMode = false, studentInfo = null, isTeacherMode = false, teacherInfo = null, appInitialized = false }) {
    const [eleves, setEleves] = useState([])
    const [elevesVisibles, setElevesVisibles] = useState([]) // Les élèves qui doivent être affichés selon le filtre
    const [notes, setNotes] = useState([])

    const [modalOuvert, setModalOuvert] = useState(false)
    const [eleveActuel, setEleveActuel] = useState(null)
    const [noteDetail, setNoteDetail] = useState(null)
    const [ouvertureModalEnCours, setOuvertureModalEnCours] = useState(false) // Empêcher les popups pendant l'ouverture de modal

    // États pour la modal de positionnement enseignant
    const [modalPositionnementOuvert, setModalPositionnementOuvert] = useState(false)
    const [elevePositionnement, setElevePositionnement] = useState(null)
    const [competencePositionnement, setCompetencePositionnement] = useState(null)

    // État pour la vue devoir
    const [devoirViewVisible, setDevoirViewVisible] = useState(false)
    const [devoirKeyVisible, setDevoirKeyVisible] = useState(null)

    // États pour la gestion du devoir en cours de saisie
    const [devoirSelectionne, setDevoirSelectionne] = useState('')
    const [nouveauDevoirNom, setNouveauDevoirNom] = useState('')
    const [devoirs, setDevoirs] = useState([])
    const [showDevoirSelection, setShowDevoirSelection] = useState(false)

    // État pour gérer les blocs fermés/ouverts (par défaut fermés en mode enseignant normal, ouverts en mode élève et enseignant connecté)
    const [blocsFermes, setBlocsFermes] = useState(isStudentMode ? new Set() : new Set([1, 2, 3]))

    // État pour gérer l'affichage du tableau en mode filtré (visible par défaut en mode élève et enseignant connecté)
    const [tableauVisible, setTableauVisible] = useState(isStudentMode || isTeacherMode)

    // État pour tracker les dernières évaluations directes par élève/compétence
    const [dernieresEvaluationsDirectes, setDernieresEvaluationsDirectes] = useState(new Map())

    // Refs pour maintenir la position des élèves lors des changements d'affichage
    const eleveRefs = useRef({})
    const [eleveAMaintenir, setEleveAMaintenir] = useState(null)

    const codeCompetence = competenceChoisie
        ? competenceChoisie.niveau3 || competenceChoisie.niveau2 || competenceChoisie.niveau1
        : null

    const [competencesN3, setCompetencesN3] = useState([])
    const [positionnementsEnseignant, setPositionnementsEnseignant] = useState([])
    const [enseignants, setEnseignants] = useState([])
    const [competenceModalCode, setCompetenceModalCode] = useState(null)
    const [commentairesEleves, setCommentairesEleves] = useState({}) // Format: {eleveId-competenceCode: commentaire}
    const [isEditingNote, setIsEditingNote] = useState(false)
    const [editingNoteData, setEditingNoteData] = useState({ couleur: '', commentaire: '' })
    const [editError, setEditError] = useState('')

    useEffect(() => {
        // Ne pas charger tant que l'app n'est pas initialisée
        if (!appInitialized) return
        
        const idClasse = classeChoisie
        
        // En mode élève, charger tous les élèves de la classe pour la comparaison des notes de progression
        // mais on n'affichera que l'élève connecté
        if (isStudentMode && studentInfo) {
            // Charger tous les élèves de la classe de l'étudiant connecté
            apiFetch(`/eleves?classe_id=${studentInfo.classe_id}`)
                .then(res => res.json())
                .then(allStudents => {
                    // Garder tous les élèves pour les calculs de comparaison
                    setEleves(allStudents)
                })
            
            // Charger toutes les notes de la classe pour permettre la comparaison
            apiFetch(`/notes`)
                .then(res => res.json())
                .then(allNotes => {
                    // Filtrer les notes pour tous les élèves de cette classe
                    const classNotes = allNotes.filter(note => 
                        allNotes.some(n => n.eleve_id === studentInfo.id) // Au moins une note de l'élève connecté
                    )
                    setNotes(allNotes) // Garder toutes les notes pour les calculs
                })
            
            // Charger les positionnements de cet élève seulement
            apiFetch(`/positionnements?eleve_id=${studentInfo.id}`)
                .then(res => res.json())
                .then(setPositionnementsEnseignant)
        } else if (isStudentMode && !studentInfo) {
            // En mode élève mais pas encore d'infos - ne rien charger
            setEleves([])
            setNotes([])
            setPositionnementsEnseignant([])
        } else {
            // Mode normal (enseignant)
            if (!idClasse) {
                apiFetch(`/eleves`)
                    .then(res => res.json())
                    .then(setEleves)
                return
            }

            apiFetch(`/eleves?classe_id=${idClasse}`)
                .then(res => res.json())
                .then(setEleves)
            apiFetch(`/notes`).then(res => res.json()).then(setNotes)
            apiFetch(`/positionnements`).then(res => res.json()).then(setPositionnementsEnseignant)
        }
        
        // Charger les competences N3 de la BDD + les tâches professionnelles (commun aux deux modes)
        // En mode vue d'ensemble : charger toutes les compétences N3
        // En mode compétence spécifique : charger seulement celles du parent sélectionné
        const competenceN3Url = competenceChoisie?.niveau2 
            ? `/competences-n3?parent_code=${competenceChoisie.niveau2}`
            : `/competences-n3` // Charger toutes les compétences N3 en mode vue d'ensemble
            
        apiFetch(competenceN3Url)
            .then(res => res.json())
            .then(competencesBDD => {
             
                    // Ajouter toutes les tâches professionnelles comme compétences N3
                    const tachesN3 = []
                    
                    // Pour chaque compétence N2, ajouter les tâches compatibles
                    competencesN1N2.forEach(compN1 => {
                        compN1.enfants.forEach(compN2 => {
                            // Filtrer les tâches professionnelles compatibles avec cette N1
                            const tachesCompatibles = tachesProfessionelles.filter(tache => 
                                tache.competences.includes(compN1.code)
                            )
                            
                            // Ajouter chaque tâche associée
                            tachesCompatibles.forEach(tacheProf => {
                                tacheProf.TacheAssociees.forEach(tache => {
                                    tachesN3.push({
                                        code: `${compN2.code}.${tacheProf.code}.${tache.code}`,
                                        nom: `${tacheProf.nom} — ${tache.nom}`,
                                        parent_code: compN2.code,
                                        source: 'fichier'
                                    })
                                })
                            })
                        })
                    })
                    
                    // Combiner BDD + tâches professionnelles
                    const toutesCompetencesN3 = [
                        ...competencesBDD.map(comp => ({ ...comp, source: 'bdd' })),
                        ...tachesN3
                    ]
                    
                    setCompetencesN3(toutesCompetencesN3)
                })
        
        // Charger les enseignants (nécessaire dans tous les modes pour afficher les noms dans les détails de note)
        apiFetch(`/enseignants`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`)
                }
                return res.json()
            })
            .then(data => {
                setEnseignants(data)
            })
            .catch(error => {
                console.error('Erreur lors du chargement des enseignants:', error)
                setEnseignants([]) // Assurer qu'on a un tableau vide en cas d'erreur
            })
    }, [classeChoisie, isStudentMode, studentInfo, appInitialized, competenceChoisie])

    // Initialiser les commentaires des élèves avec les valeurs existantes
    useEffect(() => {
        if (eleves.length > 0 && dernieresEvaluationsDirectes.size > 0) {
            const nouveauxCommentaires = {}
            eleves.forEach(eleve => {
                const cleEleveCompetence = `${eleve.id}-${codeCompetence}`
                const commentaireExistant = getCommentaireDerniereEvaluation(eleve.id, codeCompetence,dernieresEvaluationsDirectes)
                if (commentaireExistant && !commentairesEleves[cleEleveCompetence]) {
                    nouveauxCommentaires[cleEleveCompetence] = commentaireExistant
                }
            })
            if (Object.keys(nouveauxCommentaires).length > 0) {
                setCommentairesEleves(prev => ({...prev, ...nouveauxCommentaires}))
            }
        }
    }, [eleves, dernieresEvaluationsDirectes, codeCompetence])

    // Filtrer les élèves selon le filtre sélectionné
    useEffect(() => {
        if (!eleveFiltre || eleveFiltre === '') {
            // Aucun filtre : afficher tous les élèves
            setElevesVisibles(eleves)
        } else {
            // Filtre appliqué : afficher seulement l'élève sélectionné
            const eleveSelectionne = eleves.find(eleve => eleve.id.toString() === eleveFiltre.toString())
            setElevesVisibles(eleveSelectionne ? [eleveSelectionne] : [])
        }
    }, [eleves, eleveFiltre])

    // Charger les devoirs existants du professeur
    useEffect(() => {
        const chargerDevoirs = async () => {
            if (isTeacherMode && teacherInfo?.id && codeCompetence) {
                try {
                    const response = await apiFetch('/devoirs')
                    const devoirsData = await response.json()
                    setDevoirs(devoirsData)
                } catch (error) {
                    console.error('Erreur lors du chargement des devoirs:', error)
                    setDevoirs([])
                }
            } else {
                setDevoirs([])
            }
        }
        
        chargerDevoirs()
    }, [isTeacherMode, teacherInfo?.id, codeCompetence])

    // Réinitialiser l'affichage du tableau quand la compétence change
    useEffect(() => {
        setTableauVisible(false)
        
        // Si on est en mode "nouvelle évaluation", réinitialiser le tracking
        const modeEvaluation = localStorage.getItem('mode_evaluation')
        if (modeEvaluation === 'nouvelle') {
            setDernieresEvaluationsDirectes(new Map())
        }
    }, [competenceChoisie])

    // Effet pour maintenir la position de l'élève après un changement d'affichage
    useEffect(() => {
        if (eleveAMaintenir && eleveRefs.current[eleveAMaintenir]) {
            const timeout = setTimeout(() => {
                eleveRefs.current[eleveAMaintenir].scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                })
                setEleveAMaintenir(null) // Reset après le scroll
            }, 100) // Petit délai pour s'assurer que le rendu est terminé
            
            return () => clearTimeout(timeout)
        }
    }, [eleveAMaintenir, tableauVisible, blocsFermes])



  



 

    const handleClickEleve = (eleve, competenceCodeSpecifique = null) => {
        // Désactiver les interactions en mode élève
        if (isStudentMode) {
            return
        }
        
        // Utiliser la compétence spécifique passée en paramètre ou celle du state global
        const competenceAUtiliser = competenceCodeSpecifique || codeCompetence

        // Si aucune compétence n'est disponible, on ne peut pas ajouter de note
        if (!competenceAUtiliser) {
            alert('Impossible de déterminer la compétence à évaluer.')
            return
        }

        // Stocker la compétence à utiliser pour la modal
        setEleveActuel(eleve)
        // Temporairement mettre à jour le code compétence si une compétence spécifique est fournie
        if (competenceCodeSpecifique && competenceCodeSpecifique !== codeCompetence) {
            // Créer un objet noteDetail avec la compétence spécifique
            setNoteDetail({
                eleve_id: eleve.id,
                competence_code: competenceCodeSpecifique,
                couleur: getCouleurPourCompetence(eleve.id, competenceCodeSpecifique,notes)  // Récupérer la couleur actuelle pour cette compétence
            })
        }
        setModalOuvert(true)
    }

    const handleSaveNote = (nouvelleNote) => {
        // Remplace la note s'il y en avait une (utilise la compétence de la note elle-même)
        const autres = notes.filter(n => !(n.eleve_id === nouvelleNote.eleve_id && n.competence_code === nouvelleNote.competence_code))
        setNotes([...autres, nouvelleNote])
    }

 


    // Fonction pour calculer la note de progression basée sur le nombre de pastilles
    const calculerNoteProgression = (eleveId, numeroBloc) => {
        // Obtenir les compétences du bloc
        const competencesBloc = competencesParBloc[numeroBloc] || []
        const codesCompetencesBloc = competencesBloc.map(comp => comp.code)

        // Obtenir toutes les notes de cet élève pour ce bloc
        const notesEleveBloc = notes.filter(note => {
            if (note.eleve_id !== eleveId) return false
            if (!note.competence_code) return false
            
            // Vérifier si cette évaluation appartient à CE bloc
            // Bidirectionnel : C04 appartient au bloc C04.1, et C04.1 appartient au bloc C04
            return codesCompetencesBloc.some(code => 
                note.competence_code.startsWith(code) || code.startsWith(note.competence_code)
            )
        })

        // Compter simplement le nombre d'évaluations individuelles (chaque évaluation = 1 pastille)
        const pastillesEleve = notesEleveBloc.length



        // Créer une liste des IDs des élèves de cette classe seulement
        const elevesClasseIds = eleves.map(eleve => eleve.id)
        
        // Compter les pastilles SEULEMENT des élèves de cette classe POUR CE BLOC SEULEMENT
        const pastillesParEleveCeBloc = {}
        notes.forEach(note => {
            if (!note.competence_code) return
            
            // CRUCIAL: Vérifier que cet élève appartient à la classe actuelle
            if (!elevesClasseIds.includes(note.eleve_id)) return
            
            // Vérifier si cette note appartient à CE bloc
            // Bidirectionnel : C04 appartient au bloc C04.1, et C04.1 appartient au bloc C04
            const matchCeBloc = codesCompetencesBloc.some(code => 
                note.competence_code.startsWith(code) || code.startsWith(note.competence_code)
            )
            if (matchCeBloc) {
                if (!pastillesParEleveCeBloc[note.eleve_id]) {
                    pastillesParEleveCeBloc[note.eleve_id] = 0
                }
                pastillesParEleveCeBloc[note.eleve_id]++
            }
        })

        // Trouver le maximum pour CE bloc seulement
        const nombreMaxPastillesCeBloc = Math.max(...Object.values(pastillesParEleveCeBloc), 1)
        
    
        
        // Calculer la note de progression sur 20 par rapport au meilleur DE CE BLOC
        const note = (pastillesEleve / nombreMaxPastillesCeBloc) * 20
        const noteFinale = Math.round(note * 10) / 10
        
        return noteFinale
    }

    // Fonction pour obtenir la couleur de la dernière évaluation directe
    const getDerniereCouleurDirecte = (eleveId, competenceCode) => {
        const cleEleveCompetence = `${eleveId}-${competenceCode}`
        const derniereEvaluation = dernieresEvaluationsDirectes.get(cleEleveCompetence)
        return derniereEvaluation ? derniereEvaluation.couleur : null
    }

    // Fonction pour créer un tooltip enrichi pour les pastilles
    const creerTooltipEnrichi = (note) => {
        // Obtenir les initiales du professeur
        const prof = enseignants.find(e => e.id === note.prof_id)
        const initialesProf = prof ? `${prof.prenom?.[0] || ''}${prof.nom?.[0] || ''}` : 'XX'
        
        // Obtenir le code de compétence (gérer les deux propriétés possibles)
        const codeCompetence = note.competence_code || note.competenceCode
        
        // Obtenir le libellé de la compétence de plus bas niveau
        const labelleCompetence = getNomCompetence(codeCompetence)
        
        // Construire le tooltip
        let tooltip = ``
        if (note.commentaire && note.commentaire.trim()) {
            tooltip += `Commentaire: ${note.commentaire}\n`
        }
        const dateObj = new Date(note.date)
        const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}`
        tooltip += `Date: ${dateStr} - `
        tooltip += `Prof: ${initialesProf}\n`
        tooltip += `Compétence: ${labelleCompetence}\n`
        return tooltip
    }

    const handleDeleteNote = async (noteId) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) {
            return
        }

        try {
            const res = await apiFetch(`/notes/${noteId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                // Supprime la note de l'état local
                setNotes(prev => prev.filter(n => n.id !== noteId))
                // Ferme la modal
                setNoteDetail(null)
            } else {
                alert('Erreur lors de la suppression de la note')
            }
        } catch (error) {
            console.error('Erreur:', error)
            alert('Erreur lors de la suppression de la note')
        }
    }

    const handleEditNote = () => {
        setEditingNoteData({
            couleur: noteDetail.couleur,
            commentaire: noteDetail.commentaire || ''
        })
        setEditError('') // Réinitialiser l'erreur
        setIsEditingNote(true)
    }

    const handleCancelEdit = () => {
        setIsEditingNote(false)
        setEditingNoteData({ couleur: '', commentaire: '' })
        setEditError('') // Réinitialiser l'erreur
        setNoteDetail(null) // Fermer la popup
    }

    const handleSaveEditedNote = async () => {
        setEditError('') // Réinitialiser l'erreur avant la tentative
        
        try {
            const res = await apiFetch(`/notes/${noteDetail.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    eleve_id: noteDetail.eleve_id,
                    competence_code: noteDetail.competence_code,
                    couleur: editingNoteData.couleur,
                    date: noteDetail.date,
                    prof_id: noteDetail.prof_id,
                    commentaire: editingNoteData.commentaire
                })
            })

            if (res.ok) {
                // Met à jour la note dans l'état local
                setNotes(prev => prev.map(n => 
                    n.id === noteDetail.id 
                        ? { ...n, couleur: editingNoteData.couleur, commentaire: editingNoteData.commentaire }
                        : n
                ))
                
                // Fermer la popup après sauvegarde réussie
                setIsEditingNote(false)
                setEditingNoteData({ couleur: '', commentaire: '' })
                setNoteDetail(null)
            } else {
                const errorData = await res.json().catch(() => ({}))
                setEditError(errorData.error || 'Erreur lors de la modification de la note')
            }
        } catch (error) {
            console.error('Erreur:', error)
            setEditError('Erreur de connexion. Veuillez réessayer.')
        }
    }

    // Fonctions pour le positionnement enseignant
    const handleClickPositionnement = (eleve, competenceCode) => {
        setElevePositionnement(eleve)
        setCompetencePositionnement(competenceCode)
        setModalPositionnementOuvert(true)
    }

    const handleSavePositionnement = async (couleur) => {
        if (!elevePositionnement || !competencePositionnement) return

        try {
            const response = await apiFetch(`/positionnements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    eleve_id: elevePositionnement.id,
                    competence_code: competencePositionnement,
                    couleur: couleur,
                    prof_id: teacherInfo?.id || null
                })
            })

            if (response.ok) {
                // Recharger les positionnements enseignant
                const positionnementsResponse = await apiFetch(`/positionnements`)
                if (positionnementsResponse.ok) {
                    const nouveauxPositionnements = await positionnementsResponse.json()
                    setPositionnementsEnseignant(nouveauxPositionnements)
                }

                // Fermer la modal
                setModalPositionnementOuvert(false)
                setElevePositionnement(null)
                setCompetencePositionnement(null)
            } else {
                alert('Erreur lors de la sauvegarde du positionnement')
            }
        } catch (error) {
            console.error('Erreur:', error)
            alert('Erreur lors de la sauvegarde du positionnement')
        }
    }

    const getPositionnementEnseignant = (eleveId, competenceCode) => {
        const positionnement = positionnementsEnseignant.find(p =>
            p.eleve_id === eleveId && p.competence_code === competenceCode
        )
        return positionnement ? positionnement.couleur : null
    }

    const getNomEnseignant = (profId) => {
        if (!profId) return 'Non défini'
        
        // Si les enseignants ne sont pas encore chargés, retourner un placeholder
        if (!enseignants || enseignants.length === 0) {
            return 'Chargement...'
        }
        
        // Convertir profId en nombre pour la comparaison (au cas où ce serait une chaîne)
        const profIdNum = parseInt(profId)
        const enseignant = enseignants.find(e => e.id === profIdNum || e.id === profId)
        
        return enseignant ? `${enseignant.prenom} ${enseignant.nom}` : `Enseignant ID ${profId}`
    }

    function getNomCompetence(code) {
        if (!code) return ''
        if (!code.includes('.')) {
            const c1 = competencesN1N2.find(c => c.code === code)
            return c1 ? `${c1.code} — ${c1.nom}` : code
        }

        const parts = code.split('.')
        const codeN1 = parts[0]
        const codeN2 = parts.slice(0, 2).join('.')

        const c1 = competencesN1N2.find(c => c.code === codeN1)
        const c2 = c1?.enfants?.find(sc => sc.code === codeN2)

        if (parts.length === 2) {
            return c2 ? `${c2.code} — ${c2.nom}` : code
        }

        // Pour les codes N3 (3 ou 4 parties), chercher dans competencesN3 qui contient maintenant tout
        const c3 = competencesN3.find(c => c.code === code)
        return c3 ? `${c3.code} — ${c3.nom}` : code
    }

    // Fonction pour récupérer les évaluations N3 d'une compétence N2 pour un élève
    const getEvaluationsN3PourN2 = (eleveId, codeCompetenceN2) => {
        if (!codeCompetenceN2 || !codeCompetenceN2.includes('.')) return []
        
        // Trouver toutes les compétences N3 rattachées à cette N2
        const competencesN3Enfants = competencesN3.filter(c3 => c3.parent_code === codeCompetenceN2)
        
        // Pour chaque N3, récupérer ses évaluations
        const evaluationsN3 = []
        competencesN3Enfants.forEach(compN3 => {
            const notesN3 = notes.filter(note => 
                note.eleve_id === eleveId && 
                note.competence_code === compN3.code
            )
            
            notesN3.forEach(note => {
                evaluationsN3.push({
                    ...note,
                    competenceNom: compN3.nom,
                    competenceCode: compN3.code
                })
            })
        })
        
        return evaluationsN3
    }

    // Fonction pour récupérer les évaluations N1 d'une compétence N1 pour un élève
    const getEvaluationsN1PourN1 = (eleveId, codeCompetenceN1) => {
        if (!codeCompetenceN1 || codeCompetenceN1.includes('.')) return []
        
        // Récupérer les évaluations directes sur cette compétence N1
        const evaluationsN1 = notes.filter(note => 
            note.eleve_id === eleveId && 
            note.competence_code === codeCompetenceN1
        )
        
        return evaluationsN1.map(note => ({
            ...note,
            competenceNom: getNomCompetence(codeCompetenceN1),
            competenceCode: codeCompetenceN1
        }))
    }

    // Fonction pour vérifier si le code sélectionné est une compétence N3
    const isCompetenceN3 = (competenceCode) => {
        if (!competenceCode) return false
        // Une compétence N3 contient au moins 2 points (ex: C01.1.R1 ou C01.1.R1.T1)
        const points = (competenceCode.match(/\./g) || []).length
        return points >= 2
    }

    // Fonction pour récupérer les évaluations N2 d'une compétence N2 pour un élève
    const getEvaluationsN2PourN2 = (eleveId, codeCompetenceN2) => {
        if (!codeCompetenceN2 || !codeCompetenceN2.includes('.')) return []
        
        // Récupérer les évaluations directes sur cette compétence N2
        const evaluationsN2 = notes.filter(note => 
            note.eleve_id === eleveId && 
            note.competence_code === codeCompetenceN2
        )
        
        return evaluationsN2.map(note => ({
            ...note,
            competenceNom: getNomCompetence(codeCompetenceN2),
            competenceCode: codeCompetenceN2
        }))
    }

    // Fonction pour organiser les notes par hiérarchie pour un élève
    const organiserNotesParHierarchie = (eleveId) => {
        const notesEleve = getNotesVisibles(eleveId,codeCompetence,notes)
        const hierarchie = {}

        notesEleve.forEach(note => {
            if (!note.competence_code) return

            const parts = note.competence_code.split('.')
            const niveau1 = parts[0]
            const niveau2 = parts.length > 1 ? parts.slice(0, 2).join('.') : null
            const niveau3 = parts.length > 2 ? note.competence_code : null

            // Initialiser la structure hiérarchique
            if (!hierarchie[niveau1]) {
                hierarchie[niveau1] = {
                    code: niveau1,
                    nom: getNomCompetence(niveau1),
                    sousNiveaux: {},
                    notes: []
                }
            }

            if (niveau2) {
                if (!hierarchie[niveau1].sousNiveaux[niveau2]) {
                    hierarchie[niveau1].sousNiveaux[niveau2] = {
                        code: niveau2,
                        nom: getNomCompetence(niveau2),
                        niveau3: {},
                        notes: []
                    }
                }

                if (niveau3) {
                    if (!hierarchie[niveau1].sousNiveaux[niveau2].niveau3[niveau3]) {
                        hierarchie[niveau1].sousNiveaux[niveau2].niveau3[niveau3] = {
                            code: niveau3,
                            nom: getNomCompetence(niveau3),
                            notes: []
                        }
                    }
                    hierarchie[niveau1].sousNiveaux[niveau2].niveau3[niveau3].notes.push(note)
                } else {
                    hierarchie[niveau1].sousNiveaux[niveau2].notes.push(note)
                }
            } else {
                hierarchie[niveau1].notes.push(note)
            }
        })

        return hierarchie
    }

    // Fonction pour générer les lignes complètes avec toutes les compétences du référentiel
    const genererLignesCompletes = (eleveId) => {
        const lignes = []
        const notesEleve = notes.filter(n => n.eleve_id === eleveId)

        // Parcourir toutes les compétences du référentiel
        competencesN1N2.forEach(comp1 => {
            let premiereLignePourNiveau1 = true

            // Ajouter la compétence de niveau 1 (parent)
            const notesComp1 = notesEleve.filter(note => note.competence_code === comp1.code)
            lignes.push({
                niveau1: { code: comp1.code, nom: comp1.nom },
                niveau2: null,
                niveau3: null,
                notes: notesComp1,
                competence: comp1 // Référence pour le bilan
            })
            premiereLignePourNiveau1 = false

            // Ajouter les compétences de niveau 2 (enfants)
            comp1.enfants.forEach(comp2 => {
                let premiereLignePourNiveau2 = true

                // Chercher les notes pour cette compétence niveau 2
                const notesComp2 = notesEleve.filter(note => note.competence_code === comp2.code)
                lignes.push({
                    niveau1: null, // Ne pas répéter le niveau 1
                    niveau2: { code: comp2.code, nom: comp2.nom },
                    niveau3: null,
                    notes: notesComp2,
                    competence: comp2 // Référence pour le bilan
                })
                premiereLignePourNiveau2 = false

                // Ajouter les compétences de niveau 3 pour ce parent niveau 2
                const comp3List = competencesN3.filter(c3 => c3.parent_code === comp2.code)
                comp3List.forEach(comp3 => {
                    const notesComp3 = notesEleve.filter(note => note.competence_code === comp3.code)
                    // Ne pas ajouter les compétences niveau 3 sans évaluation
                    if (notesComp3.length > 0) {
                        lignes.push({
                            niveau1: null, // Ne pas répéter le niveau 1
                            niveau2: premiereLignePourNiveau2 ? { code: comp2.code, nom: comp2.nom } : null, // Ne répéter le niveau 2 que pour la première ligne N3
                            niveau3: { code: comp3.code, nom: comp3.nom },
                            notes: notesComp3,
                            competence: comp3 // Référence pour le bilan
                        })
                        if (premiereLignePourNiveau2) premiereLignePourNiveau2 = false
                    }
                })
            })
        })

        return lignes
    }

    // Fonction pour générer les lignes du tableau hiérarchique
    const genererLignesTableau = (hierarchie) => {
        const lignes = []

        Object.values(hierarchie).forEach(niveau1 => {
            const sousNiveauxKeys = Object.keys(niveau1.sousNiveaux)
            let premiereLignePourNiveau1 = true

            // D'abord, ajouter les notes du niveau 1 si elles existent
            if (niveau1.notes.length > 0) {
                lignes.push({
                    niveau1: { code: niveau1.code, nom: niveau1.nom },
                    niveau2: null,
                    niveau3: null,
                    notes: niveau1.notes
                })
                premiereLignePourNiveau1 = false
            }

            if (sousNiveauxKeys.length === 0) {
                // Si pas de sous-niveaux et pas de notes directes, on affiche quand même le niveau 1
                if (niveau1.notes.length === 0) {
                    lignes.push({
                        niveau1: { code: niveau1.code, nom: niveau1.nom },
                        niveau2: null,
                        niveau3: null,
                        notes: []
                    })
                }
            } else {
                // Parcourir les sous-niveaux
                sousNiveauxKeys.forEach((niveau2Key, index) => {
                    const niveau2 = niveau1.sousNiveaux[niveau2Key]
                    const niveau3Keys = Object.keys(niveau2.niveau3)
                    let premiereLignePourNiveau2 = true

                    // D'abord, ajouter les notes du niveau 2 si elles existent
                    if (niveau2.notes.length > 0) {
                        lignes.push({
                            niveau1: premiereLignePourNiveau1 ? { code: niveau1.code, nom: niveau1.nom } : null,
                            niveau2: { code: niveau2.code, nom: niveau2.nom },
                            niveau3: null,
                            notes: niveau2.notes
                        })
                        if (premiereLignePourNiveau1) premiereLignePourNiveau1 = false
                        premiereLignePourNiveau2 = false
                    }

                    if (niveau3Keys.length === 0) {
                        // Si pas de niveau 3 et pas de notes niveau 2, on affiche quand même le niveau 2
                        if (niveau2.notes.length === 0) {
                            lignes.push({
                                niveau1: premiereLignePourNiveau1 ? { code: niveau1.code, nom: niveau1.nom } : null,
                                niveau2: { code: niveau2.code, nom: niveau2.nom },
                                niveau3: null,
                                notes: []
                            })
                            if (premiereLignePourNiveau1) premiereLignePourNiveau1 = false
                        }
                    } else {
                        // Parcourir le niveau 3
                        niveau3Keys.forEach((niveau3Key, index3) => {
                            const niveau3 = niveau2.niveau3[niveau3Key]
                            lignes.push({
                                niveau1: premiereLignePourNiveau1 ? { code: niveau1.code, nom: niveau1.nom } : null,
                                niveau2: premiereLignePourNiveau2 ? { code: niveau2.code, nom: niveau2.nom } : null,
                                niveau3: { code: niveau3.code, nom: niveau3.nom },
                                notes: niveau3.notes
                            })
                            if (premiereLignePourNiveau1) premiereLignePourNiveau1 = false
                            if (premiereLignePourNiveau2) premiereLignePourNiveau2 = false
                        })
                    }
                })
            }
        })

        return lignes
    }

    // Fonction pour construire la hiérarchie complète (toutes les compétences du référentiel)
    const construireHierarchieComplete = (eleveId) => {
        const hierarchie = {}
        const notesEleve = notes.filter(n => n.eleve_id === eleveId)

        // Parcourir toutes les compétences du référentiel
        competencesN1N2.forEach(comp1 => {
            // En mode filtré, ne traiter que la compétence N1 sélectionnée ou toutes si aucune sélection
            if (codeCompetence && !isCompetenceInHierarchy(comp1.code,codeCompetence)) {
                return // Ignorer cette compétence N1 si elle ne correspond pas au filtre
            }

            // Initialiser le niveau 1
            hierarchie[comp1.code] = {
                code: comp1.code,
                nom: comp1.nom,
                sousNiveaux: {},
                notes: notesEleve.filter(note => note.competence_code === comp1.code)
            }

            // Ajouter les compétences de niveau 2
            comp1.enfants.forEach(comp2 => {
                // En mode filtré, vérifier si cette N2 doit être incluse
                if (codeCompetence && !isCompetenceInHierarchy(comp2.code,codeCompetence)) {
                    return // Ignorer cette compétence N2 si elle ne correspond pas au filtre
                }

                hierarchie[comp1.code].sousNiveaux[comp2.code] = {
                    code: comp2.code,
                    nom: comp2.nom,
                    niveau3: {},
                    notes: notesEleve.filter(note => note.competence_code === comp2.code)
                }

                // En mode complet (vue d'ensemble), ne pas créer de lignes N3 séparées
                // Les évaluations N3 seront affichées sous forme de pastilles dans les lignes N2
                // via la fonction getEvaluationsN3PourN2
            })
        })

        return hierarchie
    }

    // Fonction modifiée pour inclure les lignes de bilan
    const genererLignesTableauAvecBilan = (hierarchie, eleveId, modeComplet = false) => {
        // En mode complet, vérifier que les compétences N3 sont chargées SEULEMENT si une compétence spécifique est sélectionnée
       
        
        // Ne vérifier competencesN3 que si une compétence niveau2 est sélectionnée
        if (modeComplet && competenceChoisie?.niveau2 && competencesN3.length === 0) {
          
            return [] // Retourner un tableau vide si les données ne sont pas encore chargées
        }
        


        // En mode complet (vue d'ensemble), construire la hiérarchie complète
        const hierarchieAUtiliser = modeComplet ? construireHierarchieComplete(eleveId) : hierarchie
        const lignesBase = genererLignesTableau(hierarchieAUtiliser)
        const lignesAvecBilan = []

        // Enrichir les lignes de base avec le positionnement ET les références de compétences
        const lignesEnrichies = lignesBase.map(ligne => {
            // Le positionnement automatique est TOUJOURS calculé sur les N2 uniquement
            const codeCompetenceN2 = ligne.niveau2?.code
            
            // Ajouter la référence de compétence pour le filtrage par bloc
            let competenceRef = null
            
            if (ligne.niveau2?.code) {
                // Pour N2, trouver la compétence dans le référentiel N1N2
                const parts = ligne.niveau2.code.split('.')
                const comp1 = competencesN1N2.find(c => c.code === parts[0])
                competenceRef = comp1?.enfants?.find(c => c.code === ligne.niveau2.code)
            } else if (ligne.niveau1?.code) {
                // Pour N1, trouver la compétence dans le référentiel N1N2
                competenceRef = competencesN1N2.find(c => c.code === ligne.niveau1.code)
            } else if (ligne.niveau3?.code) {
                // Pour N3, utiliser la compétence N3 mais avec le bloc de son parent N2
                const codeN2Parent = ligne.niveau3.code.split('.').slice(0, 2).join('.')
                const parts = codeN2Parent.split('.')
                const comp1 = competencesN1N2.find(c => c.code === parts[0])
                competenceRef = comp1?.enfants?.find(c => c.code === codeN2Parent)
            }
            
            return {
                ...ligne,
                competence: competenceRef, // Ajouter la référence de compétence
                positionnementAuto: codeCompetenceN2 ? calculerPositionnementAuto(codeCompetenceN2, eleveId) : null,
                positionnementEnseignant: ligne.niveau2?.code ? getPositionnementEnseignant(eleveId, ligne.niveau2.code) : null,
                positionnement: ligne.niveau1 ? calculerPositionnement(ligne.niveau1.code, eleveId) :
                    ligne.niveau2 ? calculerPositionnement(ligne.niveau2.code, eleveId) : null
            }
        })

        // Grouper les lignes par compétence de niveau 1
        const groupesNiveau1 = {}
        lignesEnrichies.forEach(ligne => {
            if (ligne.niveau1) {
                const codeNiveau1 = ligne.niveau1.code
                if (!groupesNiveau1[codeNiveau1]) {
                    groupesNiveau1[codeNiveau1] = {
                        nom: ligne.niveau1.nom,
                        lignes: []
                    }
                }
                groupesNiveau1[codeNiveau1].lignes.push(ligne)
            } else {
                // Ajouter aux lignes du dernier groupe (pour les sous-niveaux sans répétition du niveau 1)
                const dernierGroupe = Object.keys(groupesNiveau1).pop()
                if (dernierGroupe) {
                    groupesNiveau1[dernierGroupe].lignes.push(ligne)
                }
            }
        })

        // Reconstituer les lignes avec les bilans
        Object.keys(groupesNiveau1).forEach(codeNiveau1 => {
            const groupe = groupesNiveau1[codeNiveau1]

            // Ajouter toutes les lignes du groupe
            lignesAvecBilan.push(...groupe.lignes)

            // Ajouter la ligne de bilan - différent selon le mode
            const positionnementBilan = modeComplet ?
                calculerPositionnementPondere(codeNiveau1, eleveId) : // Mode vue d'ensemble : bilan pondéré
                calculerPositionnementSimple(codeNiveau1, eleveId)     // Mode filtré : bilan simple

            if (positionnementBilan) {
                lignesAvecBilan.push({
                    niveau1: null,
                    niveau2: null,
                    niveau3: null,
                    notes: [],
                    positionnement: null,
                    estBilan: true,
                    codeCompetence: codeNiveau1,
                    positionnementBilan: modeComplet ? positionnementBilan.couleur : positionnementBilan
                })
            }
        })

        return lignesAvecBilan
    }

    const getNomClasse = (classeId) => {
        if (!classeId || !classes) return ''
        const classe = classes.find(c => c.id === classeId)
        return classe ? classe.nom : `Classe ${classeId}`
    }

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

    // Fonction pour obtenir la couleur de fond selon le bloc de la compétence
    const getCouleurFondCompetence = (codeCompetence) => {
        if (!codeCompetence) return 'transparent'

        // Trouver la compétence principale (niveau 1)
        const niveau1 = codeCompetence.split('.')[0]
        const competencePrincipale = competencesN1N2.find(c => c.code === niveau1)

        if (!competencePrincipale) return 'transparent'

        // Déterminer le bloc majoritaire de cette compétence principale
        // (au cas où une compétence aurait des enfants dans plusieurs blocs)
        const blocs = competencePrincipale.enfants.map(enfant => enfant.bloc)
        const blocMajoritaire = blocs.sort((a, b) =>
            blocs.filter(v => v === a).length - blocs.filter(v => v === b).length
        ).pop()

        // Couleurs par bloc
        switch (blocMajoritaire) {
            case 1:
                return 'rgba(33, 150, 243, 0.1)' // Bleu transparent - Bloc 1 (Analyse et conception)
            case 2:
                return 'rgba(76, 175, 80, 0.1)' // Vert transparent - Bloc 2 (Infrastructure)
            case 3:
                return 'rgba(255, 165, 0, 0.1)' // Orange transparent - Bloc 3 (Développement et projet)
            default:
                return 'transparent'
        }
    }

    // Fonction pour calculer la moyenne des notes d'une compétence
    // Fonction pour calculer le positionnement simple (mode filtré)
    // Moyenne simple des positionnements enseignant existants
    const calculerPositionnementSimple = (codeCompetence, eleveid) => {
        const notesCompetence = notes.filter(note =>
            note.eleve_id === eleveid &&
            note.competence_code &&
            note.competence_code.startsWith(codeCompetence)
        )

        if (notesCompetence.length === 0) return null

        // Conversion des couleurs en points (5, 10, 15, 20)
        const points = notesCompetence.map(note => {
            switch (note.couleur.toLowerCase()) {
                case 'rouge': return 5
                case 'jaune': return 10
                case 'bleu': return 15
                case 'vert': return 20
                default: return 0
            }
        })

        const moyennePoints = points.reduce((sum, val) => sum + val, 0) / points.length

        // Conversion de la moyenne de points en couleur de positionnement (échelle 5-20)
        if (moyennePoints >= 17.5) return 'vert'
        else if (moyennePoints >= 12.5) return 'bleu'
        else if (moyennePoints >= 7.5) return 'jaune'
        else return 'rouge'
    }

    // Fonction pour calculer le positionnement pondéré (mode vue d'ensemble)
    // Prend en compte les poids des N2 et la répartition des N1
    // Fonction pour calculer le positionnement pondéré (mode vue d'ensemble)
    // Prend en compte les poids des N2 et la répartition des N1
    const calculerPositionnementPondere = (codeCompetence, eleveid) => {
        const competenceN1 = competencesN1N2.find(comp => comp.code === codeCompetence)
        if (!competenceN1) return null

        // Chercher les notes N1 directes
        const notesN1Directes = notes.filter(note =>
            note.eleve_id === eleveid &&
            note.competence_code === codeCompetence
        )

        const enfantsN2 = competenceN1.enfants
        let totalPoints = 0
        let totalPoids = 0
        let nombreContributions = 0

        for (let i = 0; i < enfantsN2.length; i++) {
            const enfantN2 = enfantsN2[i]

            // D'abord vérifier s'il y a un positionnement enseignant pour ce N2
            const positionnementEnseignant = getPositionnementEnseignant(eleveid, enfantN2.code)

            if (positionnementEnseignant) {
                // Utiliser le positionnement enseignant manuel
                let pointsPositionnement = 0
                switch (positionnementEnseignant.toLowerCase()) {
                    case 'rouge': pointsPositionnement = 0; break
                    case 'jaune': pointsPositionnement = 1; break
                    case 'bleu': pointsPositionnement = 2; break
                    case 'vert': pointsPositionnement = 3; break
                    default: pointsPositionnement = -1  // Valeur invalide pour ignorer
                }

                if (pointsPositionnement >= 0) {  // Accepter rouge (0) aussi, mais pas les invalides (-1)
                    // Ajouter directement au total pondéré avec le poids du N2
                    totalPoints += pointsPositionnement * enfantN2.poid
                    totalPoids += enfantN2.poid
                    nombreContributions += 1
                    continue // Passer au N2 suivant
                }
            }

            // Pas de positionnement enseignant, utiliser les notes
            let pointsN2Total = 0
            let contributionsN2Total = 0

            // Contribution des notes N1 réparties sur ce N2
            if (notesN1Directes.length > 0) {
                notesN1Directes.forEach(noteN1 => {
                    let pointsNote = 0
                    switch (noteN1.couleur.toLowerCase()) {
                        case 'rouge': pointsNote = 0; break
                        case 'jaune': pointsNote = 1; break
                        case 'bleu': pointsNote = 2; break
                        case 'vert': pointsNote = 3; break
                        default: pointsNote = 0
                    }

                    if (pointsNote >= 0) {  // Accepter rouge (0) aussi
                        // Répartition équitable entre tous les N2
                        pointsN2Total += pointsNote / enfantsN2.length
                        contributionsN2Total += 1 / enfantsN2.length
                    }
                })
            }

            // Contribution des notes N2 directes
            const notesN2Directes = notes.filter(note =>
                note.eleve_id === eleveid &&
                note.competence_code === enfantN2.code
            )

            notesN2Directes.forEach(noteN2 => {
                let pointsNote = 0
                switch (noteN2.couleur.toLowerCase()) {
                    case 'rouge': pointsNote = 0; break
                    case 'jaune': pointsNote = 1; break
                    case 'bleu': pointsNote = 2; break
                    case 'vert': pointsNote = 3; break
                    default: pointsNote = 0
                }

                if (pointsNote >= 0) {  // Accepter rouge (0) aussi
                    pointsN2Total += pointsNote
                    contributionsN2Total += 1
                }
            })

            // Contribution des notes N3 rattachées à ce N2
            const competencesN3Enfants = competencesN3.filter(c3 => c3.parent_code === enfantN2.code)
            competencesN3Enfants.forEach(compN3 => {
                const notesN3Directes = notes.filter(note =>
                    note.eleve_id === eleveid &&
                    note.competence_code === compN3.code
                )

                notesN3Directes.forEach(noteN3 => {
                    let pointsNote = 0
                    switch (noteN3.couleur.toLowerCase()) {
                        case 'rouge': pointsNote = 0; break
                        case 'jaune': pointsNote = 1; break
                        case 'bleu': pointsNote = 2; break
                        case 'vert': pointsNote = 3; break
                        default: pointsNote = 0
                    }

                    if (pointsNote >= 0) {  // Accepter rouge (0) aussi
                        pointsN2Total += pointsNote
                        contributionsN2Total += 1
                    }
                })
            })

            // Ajouter au total pondéré si il y a des contributions  
            if (contributionsN2Total > 0) {
                const moyenneN2 = pointsN2Total / contributionsN2Total
                totalPoints += moyenneN2 * enfantN2.poid
                totalPoids += enfantN2.poid
                nombreContributions += 1
            }
        }

        if (nombreContributions === 0 || totalPoids === 0) return null

        const moyennePonderee = totalPoints / totalPoids

        // Conversion de la moyenne pondérée en couleur (échelle 0-3)
        let resultat
        if (moyennePonderee >= 2.5) resultat = 'vert'
        else if (moyennePonderee >= 1.5) resultat = 'bleu'
        else if (moyennePonderee >= 0.5) resultat = 'jaune'
        else resultat = 'rouge'

        return { couleur: resultat, moyenne: moyennePonderee }
    }

    // Fonction pour calculer le positionnement automatique (basé sur les notes)
    const calculerPositionnementAuto = (codeCompetence, eleveid) => {
        // Si c'est une compétence de niveau 1, calculer avec répartition sur les N2
        const competenceN1 = competencesN1N2.find(comp => comp.code === codeCompetence)

        if (competenceN1) {
            // C'est une compétence N1, répartir les évaluations sur les N2
            const notesN1 = notes.filter(note =>
                note.eleve_id === eleveid &&
                note.competence_code === codeCompetence
            )

            const enfantsN2 = competenceN1.enfants
            let totalPoints = 0
            let totalContributions = 0

            // Si il y a des notes N1, les répartir équitablement
            if (notesN1.length > 0) {
                notesN1.forEach(noteN1 => {
                    let pointsNote = 0
                    switch (noteN1.couleur.toLowerCase()) {
                        case 'rouge': pointsNote = 0; break
                        case 'jaune': pointsNote = 1; break
                        case 'bleu': pointsNote = 2; break
                        case 'vert': pointsNote = 3; break
                        default: pointsNote = 0
                    }

                    if (pointsNote >= 0) {  // Accepter rouge (0) aussi
                        // Chaque note N1 contribue équitablement à chaque N2
                        totalPoints += pointsNote
                        totalContributions += 1
                    }
                })
            }

            // Ajouter aussi les évaluations directes des N2
            enfantsN2.forEach(enfantN2 => {
                const notesN2 = notes.filter(note =>
                    note.eleve_id === eleveid &&
                    note.competence_code === enfantN2.code
                )

                notesN2.forEach(noteN2 => {
                    let pointsNote = 0
                    switch (noteN2.couleur.toLowerCase()) {
                        case 'rouge': pointsNote = 0; break
                        case 'jaune': pointsNote = 1; break
                        case 'bleu': pointsNote = 2; break
                        case 'vert': pointsNote = 3; break
                        default: pointsNote = 0
                    }

                    if (pointsNote >= 0) {  // Accepter rouge (0) aussi
                        totalPoints += pointsNote
                        totalContributions += 1
                    }
                })

                // Ajouter aussi les notes N3 rattachées à chaque N2
                const competencesN3Enfant = competencesN3.filter(c3 => c3.parent_code === enfantN2.code)
                competencesN3Enfant.forEach(compN3 => {
                    const notesN3 = notes.filter(note =>
                        note.eleve_id === eleveid &&
                        note.competence_code === compN3.code
                    )

                    notesN3.forEach(noteN3 => {
                        let pointsNote = 0
                        switch (noteN3.couleur.toLowerCase()) {
                            case 'rouge': pointsNote = 0; break
                            case 'jaune': pointsNote = 1; break
                            case 'bleu': pointsNote = 2; break
                            case 'vert': pointsNote = 3; break
                            default: pointsNote = 0
                        }

                        totalPoints += pointsNote
                        totalContributions += 1
                    })
                })
            })

            if (totalContributions === 0) return null

            const moyennePoints = totalPoints / totalContributions

            // Conversion de la moyenne de points en couleur de positionnement
            if (moyennePoints >= 2.5) return 'vert'
            else if (moyennePoints >= 1.5) return 'bleu'
            else if (moyennePoints >= 0.5) return 'jaune'
            else return 'rouge'
        } else {
            // C'est une compétence N2 ou N3, logique modifiée pour prendre en compte la distillation

            // D'abord chercher les notes directes sur cette compétence
            const notesDirectes = notes.filter(note =>
                note.eleve_id === eleveid &&
                note.competence_code &&
                note.competence_code.startsWith(codeCompetence)
            )

            let totalPoints = 0
            let totalContributions = 0

            // Ajouter les notes directes
            notesDirectes.forEach(note => {
                let pointsNote = 0
                switch (note.couleur.toLowerCase()) {
                    case 'rouge': pointsNote = 0; break
                    case 'jaune': pointsNote = 1; break
                    case 'bleu': pointsNote = 2; break
                    case 'vert': pointsNote = 3; break
                    default: pointsNote = 0
                }

                // Compter toutes les notes, même les rouges (0 points)
                totalPoints += pointsNote
                totalContributions += 1
            })

            // Si c'est une compétence N2, ajouter aussi les notes N3 enfants
            const parts = codeCompetence.split('.')
            if (parts.length === 2) { // C'est une N2 (ex: C01.1)
                // Chercher les compétences N3 rattachées à cette N2
                const competencesN3Enfant = competencesN3.filter(c3 => c3.parent_code === codeCompetence)
                
                // Pour chaque N3, calculer sa moyenne et l'ajouter avec un poids équitable
                competencesN3Enfant.forEach(compN3 => {
                    const notesN3 = notes.filter(note =>
                        note.eleve_id === eleveid &&
                        note.competence_code === compN3.code
                    )

                    if (notesN3.length > 0) {
                        // Calculer la moyenne des notes N3
                        let totalPointsN3 = 0
                        notesN3.forEach(noteN3 => {
                            let pointsNote = 0
                            switch (noteN3.couleur.toLowerCase()) {
                                case 'rouge': pointsNote = 0; break
                                case 'jaune': pointsNote = 1; break
                                case 'bleu': pointsNote = 2; break
                                case 'vert': pointsNote = 3; break
                                default: pointsNote = 0
                            }
                            totalPointsN3 += pointsNote
                        })
                        
                        // Chaque N3 contribue de manière équitable (moyenne de ses notes)
                        const moyenneN3 = totalPointsN3 / notesN3.length
                        totalPoints += moyenneN3
                        totalContributions += 1 // Chaque N3 = 1 contribution, peu importe le nombre de notes
                    }
                })

                // Chercher les notes N1 du parent à distiller
                const codeParentN1 = parts[0] // ex: C01
                const competenceParentN1 = competencesN1N2.find(comp => comp.code === codeParentN1)

                if (competenceParentN1) {
                    // Chercher les notes N1 du parent
                    const notesN1Parent = notes.filter(note =>
                        note.eleve_id === eleveid &&
                        note.competence_code === codeParentN1
                    )

                    // Trouver le poids de cette N2 spécifique
                    const competenceN2 = competenceParentN1.enfants.find(enfant => enfant.code === codeCompetence)
                    const poidsN2 = competenceN2 ? competenceN2.poid : 1

                    // Calculer la somme des poids de tous les N2 du parent
                    const totalPoidsN2 = competenceParentN1.enfants.reduce((sum, enfant) => sum + enfant.poid, 0)

                    // Distiller les notes N1 sur cette N2 selon son poids proportionnel
                    notesN1Parent.forEach(noteN1 => {
                        let pointsNote = 0
                        switch (noteN1.couleur.toLowerCase()) {
                            case 'rouge': pointsNote = 0; break
                            case 'jaune': pointsNote = 1; break
                            case 'bleu': pointsNote = 2; break
                            case 'vert': pointsNote = 3; break
                            default: pointsNote = 0
                        }

                        if (pointsNote >= 0) {  // Accepter toutes les notes valides, y compris rouge (0)
                            // Répartition proportionnelle selon le poids de cette N2
                            const proportionN2 = poidsN2 / totalPoidsN2
                            totalPoints += pointsNote * proportionN2
                            totalContributions += proportionN2 // Contribution proportionnelle au poids
                        }
                    })
                }
            }

            if (totalContributions === 0) return null

            const moyennePoints = totalPoints / totalContributions

            // Conversion de la moyenne de points en couleur de positionnement
            if (moyennePoints >= 2.5) return 'vert'
            else if (moyennePoints >= 1.5) return 'bleu'
            else if (moyennePoints >= 0.5) return 'jaune'
            else return 'rouge'
        }
    }

    // Fonction principale pour calculer le positionnement (priorise le positionnement enseignant)
    const calculerPositionnement = (codeCompetence, eleveid) => {
        // D'abord, vérifier s'il y a un positionnement enseignant manuel
        const positionnementManuel = getPositionnementEnseignant(eleveid, codeCompetence)
        if (positionnementManuel) {
            return positionnementManuel
        }

        // Sinon, utiliser le calcul automatique
        return calculerPositionnementAuto(codeCompetence, eleveid)
    }

    // Fonction pour convertir nos noms de couleurs en couleurs CSS
    const getCouleurCss = (nomCouleur) => {
        switch (nomCouleur?.toLowerCase()) {
            case 'rouge': return '#e53935'
            case 'jaune': return '#fdd835'
            case 'bleu': return '#1e88e5'
            case 'vert': return '#43a047'
            case 'orange': return '#fb8c00'
            default: return '#cccccc'
        }
    }

    // Fonction pour organiser les compétences par bloc
    const organiserParBloc = (competencesData) => {
        const parBloc = {}

        competencesData.forEach(competence => {
            competence.enfants.forEach(enfant => {
                const bloc = enfant.bloc
                if (!parBloc[bloc]) {
                    parBloc[bloc] = []
                }
                parBloc[bloc].push({
                    ...enfant,
                    parent: competence
                })
            })
        })

        return parBloc
    }

    // Organisation des compétences par bloc pour utilisation globale
    const competencesParBloc = useMemo(() => organiserParBloc(competencesN1N2), [])

    // Fonction pour obtenir le nom du bloc
    const getNomBloc = (numeroBloc) => {
        switch (numeroBloc) {
            case 1: return 'Bloc 1 - Étude et conception de réseaux informatiques'
            case 2: return 'Bloc 2 - Exploitation et maintenance de réseaux informatiques'
            case 3: return 'Bloc 3 - Valorisation de la donnée et cybersécurité'
            default: return `Bloc ${numeroBloc}`
        }
    }

    // Fonction pour calculer le bilan d'un bloc avec moyenne pondérée
    const calculerBilanBloc = (numeroBloc, eleveId) => {
        const competencesParBloc = organiserParBloc(competencesN1N2)
        const competencesBloc = competencesParBloc[numeroBloc] || []

        if (competencesBloc.length === 0) return null

        // Grouper les compétences N2 par leur parent N1
        const competencesParParent = {}
        competencesBloc.forEach(competence => {
            const parentCode = competence.parent.code
            if (!competencesParParent[parentCode]) {
                competencesParParent[parentCode] = {
                    parent: competence.parent,
                    enfants: []
                }
            }
            competencesParParent[parentCode].enfants.push(competence)
        })

        let totalPoints = 0
        let totalPoids = 0
        let nombreCompetences = 0

        // Pour chaque compétence N1 du bloc, utiliser le calcul pondéré
        Object.values(competencesParParent).forEach(groupe => {
            const parentCode = groupe.parent.code
            const positionnementPondere = calculerPositionnementPondere(parentCode, eleveId)

            if (positionnementPondere && positionnementPondere.moyenne !== undefined) {
                // Utiliser directement la moyenne pondérée numérique
                const pointsCompetence = positionnementPondere.moyenne
                const poidsN1 = groupe.parent.poid // Utiliser le poids N1 défini dans le référentiel

                totalPoints += pointsCompetence * poidsN1
                totalPoids += poidsN1
                nombreCompetences++
            }
        })


        if (nombreCompetences === 0 || totalPoids === 0) return null

        const moyennePonderee = totalPoints / totalPoids

        // Conversion de la moyenne pondérée en couleur (échelle 0-3)
        if (moyennePonderee >= 2.5) return { couleur: 'vert', moyenne: moyennePonderee }
        if (moyennePonderee >= 1.5) return { couleur: 'bleu', moyenne: moyennePonderee }
        if (moyennePonderee >= 0.5) return { couleur: 'jaune', moyenne: moyennePonderee }
        return { couleur: 'rouge', moyenne: moyennePonderee }
    }

    // Fonction pour toggle l'affichage d'un bloc
    const toggleBloc = useCallback((numeroBloc, eleveId = null) => {
        if (eleveId) {
            setEleveAMaintenir(eleveId) // Capturer l'élève pour maintenir sa position
        }
        setBlocsFermes(prev => {
            const nouveauxBlocsFermes = new Set(prev)
            if (nouveauxBlocsFermes.has(numeroBloc)) {
                nouveauxBlocsFermes.delete(numeroBloc)
            } else {
                nouveauxBlocsFermes.add(numeroBloc)
            }
            return nouveauxBlocsFermes
        })
    }, [])

    // Fonction pour toggle l'affichage du tableau en mode filtré
    const toggleTableauVisible = useCallback((eleveId) => {
        setEleveAMaintenir(eleveId) // Capturer l'élève pour maintenir sa position
        setTableauVisible(prev => !prev)
    }, [])


   

    return (
        <div className="tableau-container">

            { eleves.length === 0 && (
                <div className="aucune-note alert">
                    <p>Aucun Élève est ajouté à votre classe.</p>
                </div>
            )}

           

            {modalOuvert && eleveActuel && (
                <ColorPickerModal
                    eleve={eleveActuel}
                    competenceCode={competenceModalCode || noteDetail?.competence_code || codeCompetence}
                    onClose={() => {
                        setModalOuvert(false)
                        setCompetenceModalCode(null)
                        // Nettoyer noteDetail quand on ferme la modal
                        if (noteDetail?.competence_code !== codeCompetence) {
                            setNoteDetail(null)
                        }
                    }}
                    onSave={handleSaveNote}
                    ajouterNote={(note) => setNotes(prev => [...prev, note])}
                    teacherInfo={teacherInfo}
                />
            )}

            {modalPositionnementOuvert && elevePositionnement && competencePositionnement && (
                <PositionnementModal
                    eleve={elevePositionnement}
                    competenceCode={competencePositionnement}
                    competenceNom={getNomCompetence(competencePositionnement)}
                    positionnementActuel={getPositionnementEnseignant(elevePositionnement.id, competencePositionnement)}
                    onClose={() => {
                        setModalPositionnementOuvert(false)
                        setElevePositionnement(null)
                        setCompetencePositionnement(null)
                    }}
                    onSave={handleSavePositionnement}
                />
            )}

            {noteDetail && (
                <div className="modal-note-detail">
                    <div className="modal-content">
                        <h4>{isEditingNote ? 'Modifier la note' : 'Détail de la note'}</h4>
                        <p><strong>Compétence :</strong> {getNomCompetence(noteDetail.competence_code)}</p>
                        
                        {!isEditingNote ? (
                            <>
                                <p><strong>Couleur :</strong> {noteDetail.couleur}</p>
                                <p><strong>Date :</strong> {new Date(noteDetail.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                                <p><strong>Prof :</strong> {getNomEnseignant(noteDetail.prof_id)}</p>
                                {noteDetail.commentaire && (
                                    <div style={{ marginTop: '10px' }}>
                                        <p><strong>Commentaire/Remédiation :</strong></p>
                                        <div style={{ 
                                            backgroundColor: '#f8f9fa', 
                                            padding: '10px', 
                                            borderRadius: '4px',
                                            border: '1px solid #dee2e6',
                                            fontStyle: 'italic',
                                            color: '#212529'
                                        }}>
                                            {noteDetail.commentaire}
                                        </div>
                                    </div>
                                )}

                                {/* Affichage du devoir associé */}
                                {noteDetail.devoir_label && noteDetail.devoirKey && (
                                    <div style={{ marginTop: '10px' }}>
                                        <p><strong>Devoir associé :</strong></p>
                                        <div style={{ 
                                            backgroundColor: '#e3f2fd', 
                                            padding: '10px', 
                                            borderRadius: '4px',
                                            border: '1px solid #2196f3',
                                            color: '#1565c0'
                                        }}>
                                            📋 {noteDetail.devoir_label}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <p><strong>Date :</strong> {new Date(noteDetail.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                                <p><strong>Prof :</strong> {getNomEnseignant(noteDetail.prof_id)}</p>
                                
                                <div style={{ marginTop: '15px' }}>
                                    <label><strong>Couleur :</strong></label>
                                    <div style={{ 
                                        marginTop: '10px', 
                                        display: 'flex', 
                                        gap: '10px', 
                                        flexWrap: 'wrap',
                                        justifyContent: 'center'
                                    }}>
                                        {[
                                            { nom: 'rouge', label: 'Non acquis', css: '#e53935' },
                                            { nom: 'jaune', label: 'Maîtrise fragile', css: '#fdd835' },
                                            { nom: 'bleu', label: 'Maîtrise satisfaisante', css: '#1e88e5' },
                                            { nom: 'vert', label: 'Très bonne maîtrise', css: '#43a047' }
                                        ].map(couleur => (
                                            <button
                                                key={couleur.nom}
                                                onClick={() => setEditingNoteData(prev => ({ ...prev, couleur: couleur.nom }))}
                                                style={{
                                                    backgroundColor: couleur.css,
                                                    color: 'white',
                                                    border: editingNoteData.couleur === couleur.nom ? '3px solid #333' : '1px solid #ccc',
                                                    borderRadius: '8px',
                                                    padding: '12px 16px',
                                                    cursor: 'pointer',
                                                    fontSize: '13px',
                                                    fontWeight: 'bold',
                                                    minWidth: '120px',
                                                    textAlign: 'center',
                                                    transform: editingNoteData.couleur === couleur.nom ? 'scale(1.05)' : 'scale(1)',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: editingNoteData.couleur === couleur.nom ? '0 4px 8px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                {couleur.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ marginTop: '15px' }}>
                                    <label><strong>Commentaire/Remédiation :</strong></label>
                                    <textarea
                                        value={editingNoteData.commentaire}
                                        onChange={(e) => setEditingNoteData(prev => ({ ...prev, commentaire: e.target.value }))}
                                        placeholder="Commentaire ou remédiation..."
                                        style={{
                                            width: '100%',
                                            height: '80px',
                                            marginTop: '5px',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            border: '1px solid #ccc',
                                            resize: 'vertical'
                                        }}
                                    />
                                </div>

                                {/* Affichage de l'erreur */}
                                {editError && (
                                    <div style={{
                                        marginTop: '10px',
                                        padding: '10px',
                                        backgroundColor: '#ffe6e6',
                                        border: '1px solid #ff4444',
                                        borderRadius: '4px',
                                        color: '#cc0000',
                                        fontSize: '14px'
                                    }}>
                                        {editError}
                                    </div>
                                )}
                            </>
                        )}
                        
                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            {!isEditingNote ? (
                                <>
                                    <button onClick={() => setNoteDetail(null)}>Fermer</button>
                                    
                                    {/* Bouton pour afficher le devoir associé */}
                                    {noteDetail.devoirKey && !isStudentMode && (
                                        <button
                                            onClick={() => {
                                                setDevoirKeyVisible(noteDetail.devoirKey)
                                                setDevoirViewVisible(true)
                                                setNoteDetail(null)
                                            }}
                                            style={{
                                                backgroundColor: '#2196f3',
                                                color: 'white',
                                                border: 'none',
                                                padding: '8px 16px',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            📋 Voir le devoir
                                        </button>
                                    )}
                                    
                                    {!isStudentMode && (
                                        <>
                                            <button
                                                onClick={handleEditNote}
                                                style={{
                                                    backgroundColor: '#2196F3',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 16px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Modifier
                                            </button>
                                            <button
                                                onClick={() => handleDeleteNote(noteDetail.id)}
                                                style={{
                                                    backgroundColor: '#e53935',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 16px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Supprimer
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <button onClick={handleCancelEdit}>Annuler</button>
                                    <button
                                        onClick={handleSaveEditedNote}
                                        style={{
                                            backgroundColor: '#4CAF50',
                                            color: 'white',
                                            border: 'none',
                                            padding: '8px 16px',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Enregistrer
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Vue devoir */}
            {devoirViewVisible && devoirKeyVisible ? (
                <DevoirView
                    devoirKey={devoirKeyVisible}
                    onClose={() => {
                        setDevoirViewVisible(false)
                        setDevoirKeyVisible(null)
                    }}
                    teacherInfo={teacherInfo}
                />
            ):(<> {/* Section de sélection de devoir - affiché seulement si une compétence est sélectionnée et en mode enseignant */}
            {codeCompetence && isTeacherMode && !isStudentMode && eleves.length > 0 && (
                <div style={{ 
                    marginBottom: '20px', 
                    padding: '15px', 
                    border: '1px solid #ddd', 
                    borderRadius: '5px',
                    backgroundColor: '#f9f9f9'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, marginRight: '15px' }}>
                            📋 Associer à un devoir (facultatif)
                        </h4>
                        <button
                            type="button"
                            onClick={() => setShowDevoirSelection(!showDevoirSelection)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#007bff',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                fontSize: '14px'
                            }}
                        >
                            {showDevoirSelection ? 'Masquer' : 'Afficher les options'}
                        </button>
                    </div>

                    {showDevoirSelection && (
                        <div>
                            {/* Devoir existant */}
                            {devoirs.length > 0 && (
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                        Associer à un devoir existant :
                                    </label>
                                    <select
                                        value={devoirSelectionne}
                                        onChange={(e) => {
                                            setDevoirSelectionne(e.target.value)
                                            if (e.target.value) setNouveauDevoirNom('') // Effacer le nouveau devoir si on sélectionne un existant
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            border: '1px solid #ccc',
                                            fontSize: '14px'
                                        }}
                                    >
                                        <option value="">-- Sélectionner un devoir existant --</option>
                                        {devoirs.map(devoir => (
                                            <option key={devoir.devoirKey} value={devoir.devoirKey}>
                                                {devoir.devoir_label} ({new Date(devoir.date).toLocaleDateString()})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* OU nouveau devoir */}
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    {devoirs.length > 0 ? 'OU créer un nouveau devoir :' : 'Créer un nouveau devoir :'}
                                </label>
                                <input
                                    type="text"
                                    value={nouveauDevoirNom}
                                    onChange={(e) => {
                                        setNouveauDevoirNom(e.target.value)
                                        if (e.target.value) setDevoirSelectionne('') // Effacer la sélection existante si on tape un nouveau
                                    }}
                                    placeholder="Ex: TP Chimie 12/09/25, Contrôle Math..."
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        border: '1px solid #ccc',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>

                            {(devoirSelectionne || nouveauDevoirNom.trim()) && (
                                <div style={{ 
                                    padding: '10px', 
                                    backgroundColor: '#e8f5e8', 
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    color: '#2e7d2e'
                                }}>
                                    ✅ Les notes saisies seront associées au devoir : 
                                    <strong>
                                        {devoirSelectionne 
                                            ? devoirs.find(d => d.devoirKey === devoirSelectionne)?.devoir_label 
                                            : nouveauDevoirNom.trim()
                                        }
                                    </strong>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            {/* Si mode vue d'ensemble, organiser par élève avec leurs blocs */}
            {!codeCompetence ? (
                elevesVisibles
                    .filter(eleve => !isStudentMode || eleve.id === studentInfo?.id) // En mode étudiant, afficher seulement l'élève connecté
                    .map(eleve => {
                    const hierarchie = organiserNotesParHierarchie(eleve.id)
                    const lignes = genererLignesTableauAvecBilan(hierarchie, eleve.id, true) // Mode complet activé
                    
               

                    // En mode complet, on affiche toujours l'élève même sans notes

                    // Organiser les lignes par bloc
                    const competencesParBloc = organiserParBloc(competencesN1N2)
                    const blocsOrdonnes = Object.keys(competencesParBloc).sort((a, b) => parseInt(a) - parseInt(b))

                    return (
                        <div key={eleve.id} className="eleve-card" ref={el => eleveRefs.current[eleve.id] = el}>
                            <div className="eleve-header">
                                <div className="eleve-info">

                                    <img
                                        src={getPhotoUrl(eleve.photo)}
                                        alt={eleve.prenom}
                                        className="photo-eleve"
                                        onError={(e) => {
                                            e.target.onerror = null
                                            e.target.src = '/default.jpg'
                                        }}
                                    />

                                    <div>
                                        <h3>{eleve.prenom} {eleve.nom}</h3>
                                        <p>Classe: {getNomClasse(eleve.classe_id)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Afficher les 3 blocs pour cet élève */}
                            {blocsOrdonnes.map(numeroBloc => {
                                // Filtrer les lignes pour ce bloc
                                const lignesBloc = lignes.filter(ligne => {
                                    if (ligne.estBilan) {
                                        // Vérifier si le bilan appartient à ce bloc
                                        const competenceParent = competencesN1N2.find(c => c.code === ligne.codeCompetence)
                                        return competenceParent?.enfants.some(enfant => enfant.bloc === parseInt(numeroBloc))
                                    }

                                    // Utiliser la référence competence pour vérifier le bloc
                                    if (ligne.competence) {
                                        return ligne.competence.bloc === parseInt(numeroBloc)
                                    }

                                    if (ligne.niveau3) {
                                        // Vérifier si la compétence niveau 3 appartient à ce bloc
                                        // Trouver la compétence niveau 2 parent
                                        const codeNiveau2 = ligne.niveau3.code.split('.').slice(0, 2).join('.')
                                        return competencesParBloc[numeroBloc].some(comp => comp.code === codeNiveau2)
                                    }

                                    if (ligne.niveau2) {
                                        // Vérifier si la compétence niveau 2 appartient à ce bloc
                                        return competencesParBloc[numeroBloc].some(comp => comp.code === ligne.niveau2.code)
                                    }

                                    if (ligne.niveau1) {
                                        // Vérifier si le niveau 1 a des enfants dans ce bloc
                                        const competenceParent = competencesN1N2.find(c => c.code === ligne.niveau1.code)
                                        return competenceParent?.enfants.some(enfant => enfant.bloc === parseInt(numeroBloc))
                                    }

                                    return false
                                })

                                if (lignesBloc.length === 0) {
                                    // Afficher un bloc vide si pas de notes
                                    return (
                                        <div key={numeroBloc} className="bloc-section-eleve" >
                                            <h4 className={`bloc-titre-eleve bloc-titre-eleve${parseInt(numeroBloc)}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>{getNomBloc(parseInt(numeroBloc))}</span>
                                                <button
                                                    onClick={() => toggleBloc(parseInt(numeroBloc), eleve.id)}
                                                    style={{
                                                        backgroundColor: 'white',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '2px',
                                                        width: '24px',
                                                        height: '24px'
                                                    }}
                                                    title={blocsFermes.has(parseInt(numeroBloc)) ? 'Ouvrir le bloc' : 'Fermer le bloc'}
                                                >
                                                    <div style={{ width: '12px', height: '2px', backgroundColor: '#666', borderRadius: '1px' }}></div>
                                                    <div style={{ width: '12px', height: '2px', backgroundColor: '#666', borderRadius: '1px' }}></div>
                                                    <div style={{ width: '12px', height: '2px', backgroundColor: '#666', borderRadius: '1px' }}></div>
                                                </button>
                                            </h4>
                                            {!blocsFermes.has(parseInt(numeroBloc)) && (
                                                <div className="aucune-note-bloc">
                                                    <em>Aucune évaluation pour ce bloc</em>
                                                </div>
                                            )}
                                        </div>
                                    )
                                }

                                return (
                                    <div key={numeroBloc} className="bloc-section-eleve">
                                        <h4 className={`bloc-titre-eleve bloc-titre-eleve${parseInt(numeroBloc)}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{getNomBloc(parseInt(numeroBloc))}</span>
                                            <button
                                                onClick={() => toggleBloc(parseInt(numeroBloc), eleve.id)}
                                                style={{
                                                    backgroundColor: 'white',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '2px',
                                                    width: '24px',
                                                    height: '24px'
                                                }}
                                                title={blocsFermes.has(parseInt(numeroBloc)) ? 'Ouvrir le bloc' : 'Fermer le bloc'}
                                            >
                                                <div style={{ width: '12px', height: '2px', backgroundColor: '#666', borderRadius: '1px' }}></div>
                                                <div style={{ width: '12px', height: '2px', backgroundColor: '#666', borderRadius: '1px' }}></div>
                                                <div style={{ width: '12px', height: '2px', backgroundColor: '#666', borderRadius: '1px' }}></div>
                                            </button>
                                        </h4>

                                        {!blocsFermes.has(parseInt(numeroBloc)) && (
                                            <table className="tableau-hierarchique">
                                                <thead>
                                                    <tr>
                                                        <th>Compétence principale</th>
                                                        <th>Compétence secondaire</th>
                                                        <th>Critères d'évaluations / Tâches professionnelles</th>
                                                        <th>Evaluations</th>
                                                        <th>Positionnement Auto / Enseignant</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* Afficher les lignes normales (sans les bilans par compétence) */}
                                                    {lignesBloc.filter(ligne => !ligne.estBilan).map((ligne, index) => (
                                                        <tr key={index}
                                                            style={{
                                                                backgroundColor: ligne.niveau1 ? getCouleurFondCompetence(ligne.niveau1.code) : 'transparent'
                                                            }}>
                                                            <td className="cell-niveau1">
                                                                {ligne.niveau1 && (
                                                                    <div>
                                                                        <strong>{ligne.niveau1.code}</strong>
                                                                        <br />
                                                                        <small>{ligne.niveau1.nom}</small>
                                                                        
                                                                        {/* Petites pastilles pour les évaluations N1 */}
                                                                        {(() => {
                                                                            // Ne pas afficher les pastilles N1 en mode vue d'ensemble
                                                                            if (!codeCompetence) return null
                                                                            
                                                                            // Ne pas afficher les pastilles N1 si on a sélectionné cette même compétence N1
                                                                            if (codeCompetence === ligne.niveau1.code) return null
                                                                            
                                                                            // Ne pas afficher les pastilles N1 dans les bilans car on voit déjà les N1 dans les évaluations
                                                                            if (ligne.estBilan) return null
                                                                            
                                                                            const evaluationsN1 = getEvaluationsN1PourN1(eleve.id, ligne.niveau1.code)
                                                                            if (evaluationsN1.length === 0) return null
                                                                            
                                                                            return (
                                                                                <div style={{ 
                                                                                    marginTop: '5px',
                                                                                    display: 'flex', 
                                                                                    gap: '2px', 
                                                                                    flexWrap: 'wrap', 
                                                                                    alignItems: 'center' 
                                                                                }}>
                                                                                   
                                                                                    {evaluationsN1.map((note, i) => (
                                                                                        <NotePastille
                                                                                            key={i}
                                                                                            note={note}
                                                                                            disabled={ouvertureModalEnCours}
                                                                                            tooltip={creerTooltipEnrichi(note)}
                                                                                            size="small"
                                                                                            onClick={(note) => {
                                                                                                if (!ouvertureModalEnCours) {
                                                                                                    setNoteDetail(note);
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                    ))}
                                                                                </div>
                                                                            )
                                                                        })()}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="cell-niveau2">
                                                                {ligne.niveau2 && (
                                                                    <div>
                                                                        <strong>{ligne.niveau2.code}</strong>
                                                                        <br />
                                                                        <small>{ligne.niveau2.nom}</small>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="cell-niveau3">
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    {ligne.niveau3 && (
                                                                        <div>
                                                                            <strong>{ligne.niveau3.code}</strong>
                                                                            <br />
                                                                            <small>{ligne.niveau3.nom}</small>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Afficher les évaluations N3 si on est sur une ligne N2 - en mode filtré N1 OU en mode vue d'ensemble */}
                                                                    {ligne.niveau2?.code && (
                                                                        (!codeCompetence) || // Mode vue d'ensemble
                                                                        (codeCompetence && isCompetenceN1(codeCompetence)) // Mode filtré N1
                                                                    ) && (() => {
                                                                        const evaluationsN3 = getEvaluationsN3PourN2(eleve.id, ligne.niveau2.code);
                                                                        if (evaluationsN3.length > 0) {
                                                                            return (
                                                                                <div style={{ 
                                                                                    display: 'flex', 
                                                                                    gap: '2px', 
                                                                                    alignItems: 'center', 
                                                                                    flexWrap: 'wrap',
                                                                                    paddingTop: '4px',
                                                                                    marginTop: '4px'
                                                                                }}>
                                                                                    
                                                                                    {(() => {
                                                                                        // Regrouper les évaluations par code de compétence
                                                                                        const evaluationsGroupees = evaluationsN3.reduce((acc, note) => {
                                                                                            if (!acc[note.competenceCode]) {
                                                                                                acc[note.competenceCode] = [];
                                                                                            }
                                                                                            acc[note.competenceCode].push(note);
                                                                                            return acc;
                                                                                        }, {});

                                                                                        // Afficher chaque groupe
                                                                                        return Object.entries(evaluationsGroupees).map(([competenceCode, notes]) => (
                                                                                            <div key={competenceCode} style={{ 
                                                                                                display: 'flex', 
                                                                                                alignItems: 'center', 
                                                                                                gap: '3px', 
                                                                                                marginRight: '8px',
                                                                                                marginBottom: '2px',
                                                                                                flexWrap: 'wrap'
                                                                                            }}>
                                                                                                <span style={{ fontSize: '10px', color: '#666', marginRight: '3px', flexShrink: 0 }}>
                                                                                                    {competenceCode}
                                                                                                </span>
                                                                                                <div style={{ 
                                                                                                    display: 'flex', 
                                                                                                    gap: '2px', 
                                                                                                    flexWrap: 'wrap', 
                                                                                                    alignItems: 'center' 
                                                                                                }}>
                                                                                                    {notes.map((note, i) => (
                                                                                                        <NotePastille
                                                                                                            key={i}
                                                                                                            note={note}
                                                                                                            disabled={ouvertureModalEnCours}
                                                                                                            tooltip={creerTooltipEnrichi(note)}
                                                                                                            size="small"
                                                                                                            onClick={(note) => {
                                                                                                                if (!ouvertureModalEnCours) {
                                                                                                                    setNoteDetail(note);
                                                                                                                }
                                                                                                            }}
                                                                                                        />
                                                                                                    ))}
                                                                                                </div>
                                                                                            </div>
                                                                                        ));
                                                                                    })()}
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                </div>
                                                            </td>
                                                            <td className="cell-notes-hierarchique">
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    {/* Évaluations directes de cette ligne */}
                                                                    {ligne.notes.length > 0 ? (
                                                                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                            {ligne.notes.map((note, i) => (
                                                                                <NotePastille
                                                                                    key={i}
                                                                                    note={note}
                                                                                    disabled={ouvertureModalEnCours}
                                                                                    tooltip={creerTooltipEnrichi(note)}
                                                                                    onClick={(note) => {
                                                                                        // Ne pas ouvrir la popup si on est en train d'ouvrir une modal
                                                                                        if (ouvertureModalEnCours) return;
                                                                                        // Fermer d'abord toute popup existante avant d'en ouvrir une nouvelle
                                                                                        setNoteDetail(null);
                                                                                        setTimeout(() => {
                                                                                            // Vérifier encore une fois au moment de l'exécution
                                                                                            if (!ouvertureModalEnCours) {
                                                                                                setNoteDetail(note);
                                                                                            }
                                                                                        }, 10);
                                                                                    }}
                                                                                />
                                                                            ))}
                                                                            {/* Bouton + pour ajouter une nouvelle évaluation - maintenant pour tous les niveaux - masqué en mode élève */}
                                                                            {!isStudentMode && (
                                                                                <button
                                                                                    style={{
                                                                                        display: 'inline-block',
                                                                                        width: '20px',
                                                                                        height: '20px',
                                                                                        borderRadius: '50%',
                                                                                        backgroundColor: '#f0f0f0',
                                                                                        border: '1px solid #999',
                                                                                        cursor: 'pointer',
                                                                                        fontSize: '12px',
                                                                                        fontWeight: 'bold',
                                                                                        color: '#666',

                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        padding: '0',
                                                                                        lineHeight: '1',
                                                                                        marginLeft: '2px'
                                                                                    }}
                                                                                    title="Ajouter une nouvelle évaluation"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setOuvertureModalEnCours(true); // Bloquer les popups
                                                                                        setNoteDetail(null); // Fermer toute popup d'info
                                                                                        // Déterminer le code de compétence selon le niveau
                                                                                        let codeCompetence;
                                                                                        if (ligne.niveau3) {
                                                                                            codeCompetence = ligne.niveau3.code;
                                                                                        } else if (ligne.niveau2) {
                                                                                            codeCompetence = ligne.niveau2.code;
                                                                                        } else if (ligne.niveau1) {
                                                                                            codeCompetence = ligne.niveau1.code;
                                                                                        }
                                                                                        if (codeCompetence) {
                                                                                            // Délai pour s'assurer que la popup se ferme avant d'ouvrir la modal
                                                                                            setTimeout(() => {
                                                                                                handleClickEleve(eleve, codeCompetence);
                                                                                                // Remettre à false après un délai pour permettre les futures popups
                                                                                                setTimeout(() => setOuvertureModalEnCours(false), 100);
                                                                                            }, 50);
                                                                                        }
                                                                                    }}
                                                                                >+</button>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        // Afficher pastille grise pour tous les niveaux - non cliquable en mode élève
                                                                        <div
                                                                            style={{
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                width: '20px',
                                                                                height: '20px',
                                                                                borderRadius: '50%',
                                                                                backgroundColor: '#cccccc',
                                                                                border: '2px solid #999',
                                                                                cursor: isStudentMode ? 'default' : 'pointer',
                                                                                fontSize: '12px',
                                                                                fontWeight: 'bold',
                                                                                color: '#666'
                                                                            }}
                                                                            title={isStudentMode ? "Non évalué" : "Non évalué - Cliquer pour évaluer"}
                                                                            onClick={!isStudentMode ? (e) => {
                                                                                e.stopPropagation();
                                                                                setOuvertureModalEnCours(true); // Bloquer les popups
                                                                                setNoteDetail(null); // Fermer toute popup d'info
                                                                                // Déterminer le code de compétence selon le niveau
                                                                                let codeCompetence;
                                                                                if (ligne.niveau3) {
                                                                                    codeCompetence = ligne.niveau3.code;
                                                                                } else if (ligne.niveau2) {
                                                                                    codeCompetence = ligne.niveau2.code;
                                                                                } else if (ligne.niveau1) {
                                                                                    codeCompetence = ligne.niveau1.code;
                                                                                }
                                                                                if (codeCompetence) {
                                                                                    // Délai pour s'assurer que la popup se ferme avant d'ouvrir la modal
                                                                                    setTimeout(() => {
                                                                                        handleClickEleve(eleve, codeCompetence);
                                                                                        // Remettre à false après un délai pour permettre les futures popups
                                                                                        setTimeout(() => setOuvertureModalEnCours(false), 100);
                                                                                    }, 50);
                                                                                }
                                                                            } : undefined}
                                                                        >+</div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="cell-positionnement">
                                                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {ligne.niveau2?.code && (
                                                                        <>
                                                                            {/* En mode enseignant, toujours afficher d'abord le positionnement automatique */}
                                                                            {/* En mode élève, l'afficher seulement s'il n'y a pas de positionnement enseignant */}
                                                                            {((!ligne.positionnementEnseignant && isStudentMode) || (!isStudentMode)) && (
                                                                                <div
                                                                                    className="pastille-auto"
                                                                                    style={{
                                                                                        backgroundColor: getCouleurCss(ligne.positionnementAuto || 'Gris')
                                                                                    }}
                                                                                    title={`Positionnement automatique: ${ligne.positionnementAuto || 'Non évalué'}`}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                    }}
                                                                                >
                                                                                    {isStudentMode ? 'P' : 'A'}
                                                                                </div>
                                                                            )}

                                                                            {/* Afficher ensuite le positionnement enseignant s'il existe */}
                                                                            {ligne.positionnementEnseignant && (
                                                                                <div
                                                                                    style={{
                                                                                        width: '20px',
                                                                                        height: '20px',
                                                                                        borderRadius: '50%',
                                                                                        backgroundColor: getCouleurCss(ligne.positionnementEnseignant),
                                                                                        border: '2px solid #333',
                                                                                        cursor: isStudentMode ? 'default' : 'pointer',
                                                                                        fontSize: '10px',
                                                                                        color: 'white',
                                                                                        fontWeight: 'bold',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        marginLeft: !isStudentMode && ligne.positionnementAuto ? '5px' : '0'
                                                                                    }}
                                                                                    title={`Positionnement enseignant: ${ligne.positionnementEnseignant}`}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (isStudentMode || ouvertureModalEnCours) return;
                                                                                        const codeCompetence = ligne.niveau2?.code
                                                                                        if (codeCompetence) {
                                                                                            handleClickPositionnement(eleve, codeCompetence)
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    {isStudentMode ? 'P' : 'E'}
                                                                                </div>
                                                                            )}

                                                                            {/* Bouton pour créer un positionnement enseignant (seulement si pas déjà existant et pas en mode élève) */}
                                                                            {!ligne.positionnementEnseignant && !isStudentMode && (
                                                                                <button
                                                                                    className="btn-positionner"
                                                                                    style={{ marginLeft: '5px' }}
                                                                                    title="Cliquer pour définir un positionnement enseignant"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleClickPositionnement(eleve, ligne.niveau2.code)
                                                                                    }}
                                                                                >
                                                                                    + Positionner
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}

                                        {/* Bilan du bloc - toujours affiché */}
                                        {(() => {
                                            const bilanBloc = calculerBilanBloc(parseInt(numeroBloc), eleve.id)
                                            if (!bilanBloc) return null

                                            return (
                                                <div className={`bloc-section-bilan bloc-section-bilan${parseInt(numeroBloc)}`}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span>🏆 BILAN {getNomBloc(parseInt(numeroBloc))}</span>

                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {/* Pastille note principale */}
                                                        <div
                                                            style={{
                                                                display: 'inline-block',
                                                                width: '35px',
                                                                height: '35px',
                                                                padding: '2px',
                                                                borderRadius: '50%',
                                                                backgroundColor: getCouleurCss(bilanBloc.couleur),
                                                                border: `3px solid white`,
                                                                cursor: 'pointer',
                                                                color: 'white',
                                                                fontSize: '13px',
                                                                fontWeight: 'bold',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                            title={`Positionnement bloc: ${bilanBloc.couleur} (${(bilanBloc.moyenne * 20 / 3).toFixed(1)}/20)`}
                                                        >
                                                            {(bilanBloc.moyenne * 20 / 3).toFixed(1)}
                                                        </div>
                                                        
                                                        {/* Pastille note de progression */}
                                                        <div
                                                            style={{
                                                                display: 'inline-block',
                                                                width: '35px',
                                                                height: '35px',
                                                                padding: '2px',
                                                                borderRadius: '50%',
                                                                backgroundColor: '#6c757d',
                                                                border: `3px solid white`,
                                                                cursor: 'pointer',
                                                                color: 'white',
                                                                fontSize: '13px',
                                                                fontWeight: 'bold',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                            title={`Note de progression: ${calculerNoteProgression(eleve.id, numeroBloc)}/20 (basée sur les pastilles par rapport au meilleur)`}
                                                        >
                                                            {calculerNoteProgression(eleve.id, numeroBloc)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                    </div>
                                )
                            })}
                        </div>
                    )
                })
            ) : (
                /* Mode compétence spécifique - affichage classique */
                elevesVisibles
                    .filter(eleve => !isStudentMode || eleve.id === studentInfo?.id) // En mode étudiant, afficher seulement l'élève connecté
                    .map(eleve => {
                    const hierarchie = organiserNotesParHierarchie(eleve.id)
                    // Activer le mode complet si on sélectionne une compétence N1 pour voir toutes les N2
                    const modeComplet = isCompetenceN1(codeCompetence)
                    const lignes = genererLignesTableauAvecBilan(hierarchie, eleve.id, modeComplet)


                    // Afficher l'élève même s'il n'a pas de notes pour la compétence sélectionnée



                    //if (lignes.length === 0) return null // En mode vue d'ensemble, ne pas afficher les élèves sans notes

                    return (
                        <div key={eleve.id} className="eleve-card" ref={el => eleveRefs.current[eleve.id] = el}>
                            <div className="eleve-header">
                                <div className="eleve-info">
                                    {eleve && (
                                        <img
                                            src={getPhotoUrl(eleve.photo)}
                                            alt={eleve.prenom}
                                            className="photo-eleve"
                                            onError={(e) => {
                                                e.target.onerror = null
                                                e.target.src = '/default.jpg'
                                            }}
                                        />
                                    )}
                                    <div>
                                        <h3> <span>{eleve.nom} {eleve.prenom}</span></h3>
                                        <p>Classe: {getNomClasse(eleve.classe_id)}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                    {/* Boutons de couleur directs pour éviter la popup - masqués en mode élève */}
                                    {!isStudentMode && (() => {
                                        const derniereCouleur = getDerniereCouleurDirecte(eleve.id, codeCompetence)
                                        return (
                                            <>
                                                <button
                                                    className="btn-noter"
                                                    style={{
                                                        backgroundColor: '#e74c3c',
                                                        color: 'white',
                                                        fontSize: '11px',
                                                        height: '50px',
                                                        padding: '6px 10px',
                                                        minWidth: '80px',
                                                        opacity: derniereCouleur && derniereCouleur !== 'rouge' ? 0.4 : 1,
                                                        boxShadow: derniereCouleur === 'rouge' ? '0 0 8px rgba(231, 76, 60, 0.6)' : 'none',
                                                        transform: derniereCouleur === 'rouge' ? 'scale(1.05)' : 'scale(1)',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onClick={() => ajouterNoteDirecte(eleve, codeCompetence, 'rouge',notes,isStudentMode,dernieresEvaluationsDirectes,commentairesEleves,teacherInfo,devoirSelectionne,devoirs,setDernieresEvaluationsDirectes,nouveauDevoirNom)}
                                                    disabled={!codeCompetence}
                                                >
                                                    Non acquis
                                                </button>
                                                <button
                                                    className="btn-noter"
                                                    style={{
                                                        backgroundColor: '#f1c40f',
                                                        color: 'white',
                                                        fontSize: '11px',
                                                         height: '50px',
                                                        padding: '6px 10px',
                                                        minWidth: '80px',
                                                        opacity: derniereCouleur && derniereCouleur !== 'jaune' ? 0.4 : 1,
                                                        boxShadow: derniereCouleur === 'jaune' ? '0 0 8px rgba(241, 196, 15, 0.6)' : 'none',
                                                        transform: derniereCouleur === 'jaune' ? 'scale(1.05)' : 'scale(1)',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onClick={() => ajouterNoteDirecte(eleve, codeCompetence, 'jaune',notes,isStudentMode,dernieresEvaluationsDirectes,commentairesEleves,teacherInfo,devoirSelectionne,devoirs,setDernieresEvaluationsDirectes,nouveauDevoirNom)}
                                                    disabled={!codeCompetence}
                                                >
                                                    Maîtrise fragile
                                                </button>
                                                <button
                                                    className="btn-noter"
                                                    style={{
                                                        backgroundColor: '#3498db',
                                                        color: 'white',
                                                        fontSize: '11px',
                                                         height: '50px',
                                                        padding: '6px 10px',
                                                        minWidth: '80px',
                                                        opacity: derniereCouleur && derniereCouleur !== 'bleu' ? 0.4 : 1,
                                                        boxShadow: derniereCouleur === 'bleu' ? '0 0 8px rgba(52, 152, 219, 0.6)' : 'none',
                                                        transform: derniereCouleur === 'bleu' ? 'scale(1.05)' : 'scale(1)',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onClick={() => ajouterNoteDirecte(eleve, codeCompetence, 'bleu',notes,isStudentMode,dernieresEvaluationsDirectes,commentairesEleves,teacherInfo,devoirSelectionne,devoirs,setDernieresEvaluationsDirectes,nouveauDevoirNom)}
                                                    disabled={!codeCompetence}
                                                >
                                                    Maîtrise satisfaisante
                                                </button>
                                                <button
                                                    className="btn-noter"
                                                    style={{
                                                        backgroundColor: '#2ecc71',
                                                        color: 'white',
                                                        fontSize: '11px',
                                                         height: '50px',
                                                        padding: '6px 10px',
                                                        minWidth: '80px',
                                                        opacity: derniereCouleur && derniereCouleur !== 'vert' ? 0.4 : 1,
                                                        boxShadow: derniereCouleur === 'vert' ? '0 0 8px rgba(46, 204, 113, 0.6)' : 'none',
                                                        transform: derniereCouleur === 'vert' ? 'scale(1.05)' : 'scale(1)',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onClick={() => ajouterNoteDirecte(eleve, codeCompetence, 'vert' ,notes,isStudentMode,dernieresEvaluationsDirectes,commentairesEleves,teacherInfo,devoirSelectionne,devoirs,setDernieresEvaluationsDirectes,nouveauDevoirNom)}
                                                    disabled={!codeCompetence}
                                                >
                                                    Très bonne maîtrise
                                                </button>
                                            </>
                                        )
                                    })()}
                                    
                                    {/* Champ de commentaire pour les évaluations directes */}
                                    {!isStudentMode && (
                                        <div style={{ width: '100%', marginTop: '10px' }}>
                                            <textarea
                                                placeholder="Commentaire / Remédiation (facultatif)..."
                                                value={(() => {
                                                    const cleEleveCompetence = `${eleve.id}-${codeCompetence}`
                                                    return commentairesEleves[cleEleveCompetence] !== undefined 
                                                        ? commentairesEleves[cleEleveCompetence] 
                                                        : getCommentaireDerniereEvaluation(eleve.id, codeCompetence,dernieresEvaluationsDirectes)
                                                })()}
                                                onChange={(e) => {
                                                    const cleEleveCompetence = `${eleve.id}-${codeCompetence}`
                                                    setCommentairesEleves(prev => ({
                                                        ...prev,
                                                        [cleEleveCompetence]: e.target.value
                                                    }))
                                                }}
                                                style={{
                                                    width: '100%',
                                                    minHeight: '40px',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ccc',
                                                    fontSize: '12px',
                                                    fontFamily: 'inherit',
                                                    resize: 'vertical',
                                                    boxSizing: 'border-box'
                                                }}
                                                rows="2"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>



                            {/** Affichage conditionnel : message si pas d'évaluations, sinon tableau */}
                            {lignes.length === 0 && codeCompetence ? (
                                <div className="aucune-note">
                                    <em>Aucune évaluation pour cette compétence</em>
                                </div>
                            ) : (<> <div style={{ textAlign: 'right', margin: '15px 20px 15px 0' }}>
                                <button
                                    style={{
                                        backgroundColor: 'white',
                                        border: '1px solid #ddd',
                                        color: '#666',
                                        fontSize: '14px',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 'normal',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                        width: '36px',
                                        height: '36px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '3px',
                                        marginLeft: '20px',
                                    }}
                                    onClick={() => toggleTableauVisible(eleve.id)}
                                    title={tableauVisible ? 'Masquer les autres évaluations' : 'Voir les autres évaluations'}
                                >
                                    <div style={{ width: '18px', height: '2px', backgroundColor: '#666', borderRadius: '1px' }}></div>
                                    <div style={{ width: '18px', height: '2px', backgroundColor: '#666', borderRadius: '1px' }}></div>
                                    <div style={{ width: '18px', height: '2px', backgroundColor: '#666', borderRadius: '1px' }}></div>
                                </button>
                            </div>

                            {tableauVisible && (
                                <table className="tableau-hierarchique">
                                    <thead>
                                        <tr>
                                            <th>Compétence principale</th>
                                            <th>Compétence secondaire</th>
                                            <th>Critères d'évaluations / Tâches professionnelles</th>
                                            <th>Evaluations</th>
                                            <th>Positionnement Auto/Prof</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lignes.filter(ligne => !ligne.estBilan).map((ligne, index) => {
                                            // En mode filtré, on n'affiche pas les lignes de bilan
                                            // Cas normal pour toutes les lignes
                                            return (
                                                <tr key={index}
                                                    style={{
                                                        backgroundColor: ligne.niveau1 ? getCouleurFondCompetence(ligne.niveau1.code) : 'transparent'
                                                    }}>
                                                    <td className="cell-niveau1">
                                                        {ligne.niveau1 && (
                                                            <div>
                                                                <strong>{ligne.niveau1.code}</strong>
                                                                <br />
                                                                <small>{ligne.niveau1.nom}</small>
                                                                
                                                                {/* Petites pastilles pour les évaluations N1 */}
                                                                {(() => {
                                                                    // Ne pas afficher les pastilles N1 en mode vue d'ensemble
                                                                    if (!codeCompetence) return null
                                                                    
                                                                    // Ne pas afficher les pastilles N1 si on a sélectionné cette même compétence N1
                                                                    if (codeCompetence === ligne.niveau1.code) return null
                                                                    
                                                                    // Ne pas afficher les pastilles N1 dans les bilans car on voit déjà les N1 dans les évaluations
                                                                    if (ligne.estBilan) return null
                                                                    
                                                                    const evaluationsN1 = getEvaluationsN1PourN1(eleve.id, ligne.niveau1.code)
                                                                    if (evaluationsN1.length === 0) return null
                                                                    
                                                                    return (
                                                                        <div style={{ 
                                                                            marginTop: '5px',
                                                                            display: 'flex', 
                                                                            gap: '2px', 
                                                                            flexWrap: 'wrap', 
                                                                            alignItems: 'center' 
                                                                        }}>
                                                                           
                                                                            {evaluationsN1.map((note, i) => (
                                                                                <NotePastille
                                                                                    key={i}
                                                                                    note={note}
                                                                                    disabled={ouvertureModalEnCours}
                                                                                    tooltip={creerTooltipEnrichi(note)}
                                                                                    size="small"
                                                                                    onClick={(note) => {
                                                                                        if (!ouvertureModalEnCours) {
                                                                                            setNoteDetail(note);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    )
                                                                })()}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="cell-niveau2">
                                                        {ligne.niveau2 && (
                                                            <div>
                                                                <strong>{ligne.niveau2.code}</strong>
                                                                <br />
                                                                <small>{ligne.niveau2.nom}</small>
                                                                
                                                                {/* Petites pastilles pour les évaluations N2 en mode filtré N3 */}
                                                                {(() => {
                                                                    // Afficher les pastilles N2 uniquement en mode filtré N3
                                                                    if (!codeCompetence || !isCompetenceN3(codeCompetence)) return null
                                                                    
                                                                    // Ne pas afficher les pastilles N2 si on a sélectionné cette même compétence N2
                                                                    if (codeCompetence === ligne.niveau2.code) return null
                                                                    
                                                                    // Ne pas afficher les pastilles N2 dans les bilans car on voit déjà les N2 dans les évaluations
                                                                    if (ligne.estBilan) return null
                                                                    
                                                                    const evaluationsN2 = getEvaluationsN2PourN2(eleve.id, ligne.niveau2.code)
                                                                    if (evaluationsN2.length === 0) return null
                                                                    
                                                                    return (
                                                                        <div style={{ 
                                                                            marginTop: '5px',
                                                                            display: 'flex', 
                                                                            gap: '2px', 
                                                                            flexWrap: 'wrap', 
                                                                            alignItems: 'center' 
                                                                        }}>
                                                                           
                                                                            {evaluationsN2.map((note, i) => (
                                                                                <NotePastille
                                                                                    key={i}
                                                                                    note={note}
                                                                                    disabled={ouvertureModalEnCours}
                                                                                    tooltip={creerTooltipEnrichi(note)}
                                                                                    size="small"
                                                                                    onClick={(note) => {
                                                                                        if (!ouvertureModalEnCours) {
                                                                                            setNoteDetail(note);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    )
                                                                })()}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="cell-niveau3">
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            {ligne.niveau3 && (
                                                                <div>
                                                                    <strong>{ligne.niveau3.code}</strong>
                                                                    <br />
                                                                    <small>{ligne.niveau3.nom}</small>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Afficher les évaluations N3 si on est sur une ligne N2 - en mode filtré N1 OU en mode vue d'ensemble */}
                                                            {ligne.niveau2?.code && (
                                                                (!codeCompetence) || // Mode vue d'ensemble
                                                                (codeCompetence && isCompetenceN1(codeCompetence)) // Mode filtré N1
                                                            ) && (() => {
                                                                const evaluationsN3 = getEvaluationsN3PourN2(eleve.id, ligne.niveau2.code);
                                                                
                                                                if (evaluationsN3.length > 0) {
                                                                    return (
                                                                        <div style={{ 
                                                                            display: 'flex', 
                                                                            gap: '2px', 
                                                                            alignItems: 'center', 
                                                                            flexWrap: 'wrap',
                                                                            paddingTop: '4px',
                                                                            marginTop: '4px'
                                                                        }}>
                                                                            
                                                                            {(() => {
                                                                                // Regrouper les évaluations par code de compétence
                                                                                const evaluationsGroupees = evaluationsN3.reduce((acc, note) => {
                                                                                    if (!acc[note.competenceCode]) {
                                                                                        acc[note.competenceCode] = [];
                                                                                    }
                                                                                    acc[note.competenceCode].push(note);
                                                                                    return acc;
                                                                                }, {});

                                                                                // Afficher chaque groupe
                                                                                return Object.entries(evaluationsGroupees).map(([competenceCode, notes]) => (
                                                                                    <div key={competenceCode} style={{ 
                                                                                        display: 'flex', 
                                                                                        alignItems: 'center', 
                                                                                        gap: '3px', 
                                                                                        marginRight: '8px',
                                                                                        marginBottom: '2px',
                                                                                        flexWrap: 'wrap'
                                                                                    }}>
                                                                                        <span style={{ fontSize: '10px', color: '#666', marginRight: '3px', flexShrink: 0 }}>
                                                                                            {competenceCode}
                                                                                        </span>
                                                                                        <div style={{ 
                                                                                            display: 'flex', 
                                                                                            gap: '2px', 
                                                                                            flexWrap: 'wrap', 
                                                                                            alignItems: 'center' 
                                                                                        }}>
                                                                                            {notes.map((note, i) => (
                                                                                                <NotePastille
                                                                                                    key={i}
                                                                                                    note={note}
                                                                                                    disabled={ouvertureModalEnCours}
                                                                                                    tooltip={creerTooltipEnrichi(note)}
                                                                                                    size="small"
                                                                                                    onClick={(note) => {
                                                                                                        if (!ouvertureModalEnCours) {
                                                                                                            setNoteDetail(note);
                                                                                                        }
                                                                                                    }}
                                                                                                />
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                ));
                                                                            })()}
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="cell-notes-hierarchique">
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            {/* Évaluations directes de cette ligne */}
                                                            {ligne.notes.length > 0 ? (
                                                                <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                    {ligne.notes.map((note, i) => (
                                                                        <NotePastille
                                                                            key={i}
                                                                            note={note}
                                                                            disabled={ouvertureModalEnCours}
                                                                            tooltip={creerTooltipEnrichi(note)}
                                                                            onClick={(note) => {
                                                                                // Ne pas ouvrir la popup si on est en train d'ouvrir une modal
                                                                                if (ouvertureModalEnCours) return;
                                                                                // Fermer d'abord toute popup existante avant d'en ouvrir une nouvelle
                                                                                setNoteDetail(null);
                                                                                setTimeout(() => {
                                                                                    // Vérifier encore une fois au moment de l'exécution
                                                                                    if (!ouvertureModalEnCours) {
                                                                                        setNoteDetail(note);
                                                                                    }
                                                                                }, 10);
                                                                            }}
                                                                        />
                                                                    ))}
                                                                    {/* Bouton + pour ajouter une nouvelle évaluation - maintenant pour tous les niveaux - masqué en mode élève */}
                                                                    {!isStudentMode && (
                                                                        <button
                                                                            style={{
                                                                                display: 'inline-block',
                                                                                width: '20px',
                                                                                height: '20px',
                                                                                borderRadius: '50%',
                                                                                backgroundColor: '#f0f0f0',
                                                                                border: '1px solid #999',
                                                                                cursor: 'pointer',
                                                                                fontSize: '12px',
                                                                                fontWeight: 'bold',
                                                                                color: '#666',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                padding: '0',
                                                                                lineHeight: '1',
                                                                                marginLeft: '2px'
                                                                            }}
                                                                            title="Ajouter une nouvelle évaluation"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setOuvertureModalEnCours(true); // Bloquer les popups
                                                                                setNoteDetail(null); // Fermer toute popup d'info
                                                                                // Déterminer le code de compétence selon le niveau
                                                                                let codeCompetence;
                                                                                if (ligne.niveau3) {
                                                                                    codeCompetence = ligne.niveau3.code;
                                                                                } else if (ligne.niveau2) {
                                                                                    codeCompetence = ligne.niveau2.code;
                                                                                } else if (ligne.niveau1) {
                                                                                    codeCompetence = ligne.niveau1.code;
                                                                                }
                                                                                if (codeCompetence) {
                                                                                    // Délai pour s'assurer que la popup se ferme avant d'ouvrir la modal
                                                                                    setTimeout(() => {
                                                                                        handleClickEleve(eleve, codeCompetence);
                                                                                        // Remettre à false après un délai pour permettre les futures popups
                                                                                        setTimeout(() => setOuvertureModalEnCours(false), 100);
                                                                                    }, 50);
                                                                                }
                                                                            }}
                                                                        >+</button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                // Afficher pastille grise pour tous les niveaux - non cliquable en mode élève
                                                                <div
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        width: '20px',
                                                                        height: '20px',
                                                                        borderRadius: '50%',
                                                                        backgroundColor: '#cccccc',
                                                                        border: '2px solid #999',
                                                                        cursor: isStudentMode ? 'default' : 'pointer',
                                                                        fontSize: '12px',
                                                                        fontWeight: 'bold',
                                                                        color: '#666'
                                                                    }}
                                                                    title={isStudentMode ? "Non évalué" : "Non évalué - Cliquer pour évaluer"}
                                                                    onClick={!isStudentMode ? (e) => {
                                                                        e.stopPropagation();
                                                                        setOuvertureModalEnCours(true); // Bloquer les popups
                                                                        setNoteDetail(null); // Fermer toute popup d'info
                                                                        // Déterminer le code de compétence selon le niveau
                                                                        let codeCompetence;
                                                                        if (ligne.niveau3) {
                                                                            codeCompetence = ligne.niveau3.code;
                                                                        } else if (ligne.niveau2) {
                                                                            codeCompetence = ligne.niveau2.code;
                                                                        } else if (ligne.niveau1) {
                                                                            codeCompetence = ligne.niveau1.code;
                                                                        }
                                                                        if (codeCompetence) {
                                                                            // Délai pour s'assurer que la popup se ferme avant d'ouvrir la modal
                                                                            setTimeout(() => {
                                                                                handleClickEleve(eleve, codeCompetence);
                                                                                // Remettre à false après un délai pour permettre les futures popups
                                                                                setTimeout(() => setOuvertureModalEnCours(false), 100);
                                                                            }, 50);
                                                                        }
                                                                    } : undefined}
                                                                >+</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="cell-positionnement">
                                                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', justifyContent: 'center' }}>
                                                            {ligne.niveau2?.code && (
                                                                <>
                                                                    {/* En mode enseignant, toujours afficher d'abord le positionnement automatique */}
                                                                    {/* En mode élève, l'afficher seulement s'il n'y a pas de positionnement enseignant */}
                                                                    {((!ligne.positionnementEnseignant && isStudentMode) || (!isStudentMode)) && (
                                                                        <div
                                                                            className="pastille-auto"
                                                                            style={{
                                                                                backgroundColor: getCouleurCss(ligne.positionnementAuto || 'Gris')
                                                                            }}
                                                                            title={`Positionnement automatique: ${ligne.positionnementAuto || 'Non évalué'}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                            }}
                                                                        >
                                                                            {isStudentMode ? 'P' : 'A'}
                                                                        </div>
                                                                    )}

                                                                    {/* Afficher ensuite le positionnement enseignant s'il existe */}
                                                                    {ligne.positionnementEnseignant && (
                                                                        <div
                                                                            style={{
                                                                                width: '20px',
                                                                                height: '20px',
                                                                                borderRadius: '50%',
                                                                                backgroundColor: getCouleurCss(ligne.positionnementEnseignant),
                                                                                border: '2px solid #333',
                                                                                cursor: isStudentMode ? 'default' : 'pointer',
                                                                                fontSize: '10px',
                                                                                color: 'white',
                                                                                fontWeight: 'bold',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center'
                                                                            }}
                                                                            title={`Positionnement enseignant: ${ligne.positionnementEnseignant}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (isStudentMode || ouvertureModalEnCours) return;
                                                                                const codeCompetence = ligne.niveau2?.code
                                                                                if (codeCompetence) {
                                                                                    handleClickPositionnement(eleve, codeCompetence)
                                                                                }
                                                                            }}
                                                                        >
                                                                            {isStudentMode ? 'P' : 'E'}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                            </>
                            )}
                        </div>
                    )
                }))}</>)}
        </div>
    )

}

export default TableauNotes
