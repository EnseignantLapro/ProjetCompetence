// Import des fonctions utilitaires
import { apiFetch } from '../utils/api'

// Fonction pour générer une clé de devoir au format: codecompetence_classeid_profid_JJMMAA_HHMMSS
const generateDevoirKey = (competenceCode, classeId, profId) => {
    const now = new Date()
    const jour = String(now.getDate()).padStart(2, '0')
    const mois = String(now.getMonth() + 1).padStart(2, '0') // +1 car getMonth() commence à 0
    const annee = String(now.getFullYear()).slice(-2) // Derniers 2 chiffres de l'année
    const heure = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const seconde = String(now.getSeconds()).padStart(2, '0')
    const jjmmaa = `${jour}${mois}${annee}`
    const hhmmss = `${heure}${minute}${seconde}`
    
    const key = `${competenceCode}_${classeId}_${profId}_${jjmmaa}_${hhmmss}`
    console.log('🔑 [FRONT] generateDevoirKey:', { competenceCode, classeId, profId, jjmmaa, hhmmss, key })
    return key
}
export { generateDevoirKey }

// Fonction helper pour récupérer la couleur avec une compétence spécifique
const getCouleurPourCompetence = (eleveId, competenceCode,notes) => {
    const note = notes.find(n => n.eleve_id === eleveId && n.competence_code === competenceCode)
    return note ? note.couleur : ''
}
export { getCouleurPourCompetence };


// Fonction pour vérifier si une compétence fait partie de la hiérarchie sélectionnée
const isCompetenceInHierarchy = (competenceCode,codeCompetence) => {
    // Si aucune compétence n'est sélectionnée, on affiche tout
    if (!codeCompetence) {

        return true;
    }

    if (!competenceCode) {

        return false;
    }

    // Si c'est exactement la même compétence
    if (competenceCode === codeCompetence) {

        return true;
    }

    // Si la compétence sélectionnée est un parent de cette compétence
    // Par exemple : sélection "C01" et compétence "C01.1" ou "C01.1.2"
    if (competenceCode.startsWith(codeCompetence + '.')) {

        return true;
    }


    return false;
}

export { isCompetenceInHierarchy };


    // Fonction pour vérifier si le code sélectionné est une compétence N1
    const isCompetenceN1 = (competenceCode) => {
        if (!competenceCode) return false
        // Une compétence N1 ne contient pas de point
        return !competenceCode.includes('.')
    }

export { isCompetenceN1 };

   // Fonction pour obtenir toutes les notes visibles pour un élève
    const getNotesVisibles = (eleveId,codeCompetence,notes) => {
        const notesTotales = notes.filter(n => n.eleve_id === eleveId)
        const notesAvecCode = notesTotales.filter(n => n.competence_code)
        const notesFiltrees = notesAvecCode.filter(n => isCompetenceInHierarchy(n.competence_code,codeCompetence))
     
        
        return notesFiltrees
    }

export { getNotesVisibles };

   // Fonction pour ajouter directement une note avec une couleur (mode filtré)
    const ajouterNoteDirecte = async (eleve, competenceCode, couleur,notes,isStudentMode,dernieresEvaluationsDirectes,commentairesEleves,teacherInfo,devoirSelectionne,devoirs,setDernieresEvaluationsDirectes,nouveauDevoirNom,setNotes,devoirActifMemoire = null) => {
        // Désactiver les interactions en mode élève
        if (isStudentMode) {
            return
        }
        
        try {
            const modeEvaluation = localStorage.getItem('mode_evaluation') || 'nouvelle'
            const cleEleveCompetence = `${eleve.id}-${competenceCode}`
            const derniereEvaluationDirecte = dernieresEvaluationsDirectes.get(cleEleveCompetence)
            
            // Récupérer le commentaire pour cette combinaison élève + compétence
            const commentaire = commentairesEleves[cleEleveCompetence] || ''

            // En mode "edition" : modifier l'évaluation existante s'il y en a une
            // En mode "nouvelle" : toujours créer une nouvelle évaluation
            if (modeEvaluation === 'edition' && derniereEvaluationDirecte) {
                // Modifier la dernière évaluation directe existante
                const response = await apiFetch(`/notes/${derniereEvaluationDirecte.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...derniereEvaluationDirecte,
                        couleur: couleur,
                        date: new Date().toISOString().split('T')[0],
                        commentaire: commentaire.trim() || null
                    })
                })

                if (response.ok) {
                    // Mettre à jour l'état local
                    const evaluationModifiee = { ...derniereEvaluationDirecte, couleur, commentaire }
                    setDernieresEvaluationsDirectes(prev => new Map(prev.set(cleEleveCompetence, evaluationModifiee)))

                    // Recharger toutes les notes depuis la base
                    const notesResponse = await apiFetch(`/notes`)
                    const toutesLesNotes = await notesResponse.json()
                    setNotes(toutesLesNotes)
                    
                    // Ne pas vider le commentaire en mode édition, le laisser pour modification
                }
            } else {
                // Créer une nouvelle évaluation (mode "nouvelle" ou aucune évaluation existante)
                const nouvelleNote = {
                    eleve_id: eleve.id,
                    competence_code: competenceCode,
                    couleur: couleur,
                    date: new Date().toISOString().split('T')[0],
                    prof_id: teacherInfo?.id || null,
                    commentaire: commentaire.trim() || null
                }

                // Ajouter les informations de devoir si sélectionné
                if (devoirActifMemoire && devoirActifMemoire.devoirKey) {
                    // Utiliser la clé stockée en mémoire (solution état mémoire)
                    nouvelleNote.devoirKey = devoirActifMemoire.devoirKey
                    nouvelleNote.devoir_label = devoirActifMemoire.label
                    console.log('🔑 Utilisation devoirKey en mémoire pour nouvelle note:', devoirActifMemoire.devoirKey)
                } else if (devoirSelectionne) {
                    // Fallback: utiliser un devoir existant (ancien système)
                    const devoir = devoirs.find(d => d.devoirKey === devoirSelectionne)
                    if (devoir) {
                        nouvelleNote.devoirKey = devoir.devoirKey
                        nouvelleNote.devoir_label = devoir.devoir_label
                    }
                } else if (nouveauDevoirNom.trim()) {
                    // Fallback: créer un nouveau devoir (ancien système)
                    nouvelleNote.devoir_label = nouveauDevoirNom.trim()
                    // La devoirKey sera générée côté serveur
                }

                const response = await apiFetch(`/notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(nouvelleNote)
                })

                if (response.ok) {
                    const noteAjoutee = await response.json()
                    // Tracker cette nouvelle évaluation comme la dernière directe
                    setDernieresEvaluationsDirectes(prev => new Map(prev.set(cleEleveCompetence, noteAjoutee)))

                    // Recharger toutes les notes depuis la base
                    const notesResponse = await apiFetch(`/notes`)
                    const toutesLesNotes = await notesResponse.json()
                    setNotes(toutesLesNotes)
                    
                    // Après la première évaluation, passer en mode édition
                    localStorage.setItem('mode_evaluation', 'edition')
                    
                    // Ne pas vider le commentaire, le laisser visible pour montrer qu'il a été sauvegardé
                    // L'utilisateur peut voir que son commentaire est pris en compte
                }
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout/modification de la note:', error)
        }
    }
export { ajouterNoteDirecte };


    // Fonction pour obtenir le commentaire de la dernière évaluation directe
    const getCommentaireDerniereEvaluation = (eleveId, competenceCode,dernieresEvaluationsDirectes) => {
        const cleEleveCompetence = `${eleveId}-${competenceCode}`
        const derniereEvaluation = dernieresEvaluationsDirectes.get(cleEleveCompetence)
        return derniereEvaluation?.commentaire || ''
    }

export { getCommentaireDerniereEvaluation };

// Fonction pour construire l'URL d'une photo
const getPhotoUrl = (photoPath) => {
    if (!photoPath) {
        return '/default.jpg'
    }
    
    if (photoPath.startsWith('http') || photoPath.startsWith('/')) {
        return photoPath
    }
    
    return `/${photoPath}`
}

export { getPhotoUrl };

