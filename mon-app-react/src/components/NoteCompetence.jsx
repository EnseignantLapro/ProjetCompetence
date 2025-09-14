import React, { useState } from 'react'
import { apiFetch } from '../utils/api'
import { generateDevoirKey } from './TableauNotesUtils'

function NoteCompetence({ 
    eleve, 
    codeCompetence, 
    isStudentMode,
    getDerniereCouleurDirecte,
    commentairesEleves,
    setCommentairesEleves,
    getCommentaireDerniereEvaluation,
    ajouterNoteDirecte,
    devoirViewVisible,
    devoirViewRef,
    notes,
    dernieresEvaluationsDirectes,
    teacherInfo,
    devoirKeyVisible,
    devoirSelectionne,
    devoirs,
    setDernieresEvaluationsDirectes,
    nouveauDevoirNom,
    setNotes
}) {
    if (isStudentMode) {
        return null // Ne rien afficher en mode étudiant
    }

    const derniereCouleur = getDerniereCouleurDirecte(eleve.id, codeCompetence)
    const [notesEnEclaircie, setNotesEnEclaircie] = useState([])

    const couleurs = [
        { nom: 'rouge', label: 'Non acquis', css: '#e74c3c' },
        { nom: 'jaune', label: 'Maîtrise fragile', css: '#f1c40f' },
        { nom: 'bleu', label: 'Maîtrise satisfaisante', css: '#3498db' },
        { nom: 'vert', label: 'Très bonne maîtrise !', css: '#2ecc71' }
    ]

    const getNotesEnCoursDeNotation = () => {
        const notesDejasSaisies = []
        
        // Récupérer la note actuelle de cet élève pour cette compétence
        const cleEleveCompetence = `${eleve.id}-${codeCompetence}`
        const noteActuelle = dernieresEvaluationsDirectes.get(cleEleveCompetence)
        
        if (noteActuelle && noteActuelle.id) {
            notesDejasSaisies.push({
                id: noteActuelle.id,
                eleveId: eleve.id,
                competence: codeCompetence,
                couleur: noteActuelle.couleur
            })
        }
        
        console.log(`Note en cours pour élève ${eleve.prenom} ${eleve.nom} - compétence ${codeCompetence}:`)
        if (notesDejasSaisies.length > 0) {
            console.log(`- Note ID: ${notesDejasSaisies[0].id} (couleur: ${notesDejasSaisies[0].couleur})`)
        } else {
            console.log(`- Aucune note en cours`)
        }
        
        return notesDejasSaisies
    }

    // Effet pour tracker les notes en état "eclaircie" (opacity 0.4)
    React.useEffect(() => {
        if (derniereCouleur) {
            const couleursEnEclaircie = couleurs
                .filter(couleur => couleur.nom !== derniereCouleur)
                .map(couleur => `${eleve.id}-${codeCompetence}-${couleur.nom}`)
            setNotesEnEclaircie(couleursEnEclaircie)
        } else {
            setNotesEnEclaircie([])
        }
    }, [derniereCouleur, eleve.id, codeCompetence])

    // Exposer la fonction globalement pour debug
    React.useEffect(() => {
        if (!window.debugNotes) window.debugNotes = {}
        window.debugNotes[`${eleve.id}-${codeCompetence}`] = getNotesEnCoursDeNotation
        
        // Fonction globale pour afficher toutes les notes en eclaircie
        window.afficherToutesNotesEclaircie = () => {
            console.log('=== TOUTES LES NOTES EN ÉTAT ECLAIRCIE ===')
            if (window.debugNotes) {
                Object.keys(window.debugNotes).forEach(key => {
                    const [eleveId, competence] = key.split('-')
                    console.log(`Élève ${eleveId} - Compétence ${competence}:`)
                    window.debugNotes[key]()
                })
            } else {
                console.log('Aucune note en eclaircie trouvée.')
            }
        }
    }, [getNotesEnCoursDeNotation, eleve.id, codeCompetence])

    const handleNoteClick = async (couleur) => {
        // Si un devoir est ouvert, ajouter la compétence temporairement
        if (devoirViewVisible && devoirViewRef.current) {
            devoirViewRef.current.ajouterCompetence(codeCompetence)
        }
        
        // Récupérer la dernière évaluation directe existante pour cet élève/compétence
        const cleEleveCompetence = `${eleve.id}-${codeCompetence}`
        const derniereEvaluationDirecte = dernieresEvaluationsDirectes.get(cleEleveCompetence)
        
        // Si une note existe déjà et qu'on est en train de saisir un devoir
        if (derniereEvaluationDirecte && (devoirSelectionne || nouveauDevoirNom.trim() || devoirKeyVisible)) {
            try {
                // Modifier la note existante pour y ajouter les informations du devoir
                const noteModifiee = {
                    ...derniereEvaluationDirecte,
                    couleur: couleur,
                    date: new Date().toISOString().split('T')[0]
                }
                
                // Ajouter les informations de devoir selon le contexte
                if (devoirViewVisible && devoirKeyVisible) {
                    // Si on est dans une vue de devoir ouverte, utiliser cette devoirKey
                    noteModifiee.devoirKey = devoirKeyVisible
                    // Récupérer le label du devoir depuis les données existantes si possible
                    const devoirExistant = devoirs.find(d => d.devoirKey === devoirKeyVisible)
                    if (devoirExistant) {
                        noteModifiee.devoir_label = devoirExistant.devoir_label
                    }
                } else if (devoirSelectionne) {
                    // Utiliser un devoir existant sélectionné
                    const devoir = devoirs.find(d => d.devoirKey === devoirSelectionne)
                    if (devoir) {
                        noteModifiee.devoirKey = devoir.devoirKey
                        noteModifiee.devoir_label = devoir.devoir_label
                    }
                } else if (nouveauDevoirNom.trim()) {
                    // Créer un nouveau devoir avec génération de devoirKey côté front
                    noteModifiee.devoir_label = nouveauDevoirNom.trim()
                    // Générer la devoirKey avec le bon format: idClass_idProf_CodeCompetence_JJMM
                    noteModifiee.devoirKey = generateDevoirKey(eleve.classe_id, teacherInfo.id, codeCompetence)
                    console.log('🔑 Génération nouvelle devoirKey:', noteModifiee.devoirKey)
                }
                
                console.log('🔄 Modification de la note existante avec infos devoir:', noteModifiee)
                
                // Modifier la note existante
                const response = await apiFetch(`/notes/${derniereEvaluationDirecte.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(noteModifiee)
                })
                
                if (response.ok) {
                    // Récupérer la note mise à jour depuis la réponse (avec devoirKey générée)
                    const noteMiseAJour = await response.json()
                    console.log('📝 Note mise à jour reçue du serveur:', noteMiseAJour)
                    
                    // Mettre à jour l'état local avec la note complète
                    setDernieresEvaluationsDirectes(prev => new Map(prev.set(cleEleveCompetence, noteMiseAJour)))
                    
                    // Recharger toutes les notes
                    const notesResponse = await apiFetch(`/notes`)
                    const toutesLesNotes = await notesResponse.json()
                    setNotes(toutesLesNotes)
                    
                    console.log('✅ Note modifiée avec succès')
                    return
                }
            } catch (error) {
                console.error('Erreur lors de la modification de la note:', error)
            }
        }
        
        // Si pas de note existante ou pas de devoir en cours, utiliser la méthode normale
        ajouterNoteDirecte(
            eleve, 
            codeCompetence, 
            couleur,
            notes,
            isStudentMode,
            dernieresEvaluationsDirectes,
            commentairesEleves,
            teacherInfo,
            devoirViewVisible ? devoirKeyVisible : devoirSelectionne,
            devoirs,
            setDernieresEvaluationsDirectes,
            nouveauDevoirNom,
            setNotes
        )
    }

    const cleEleveCompetence = `${eleve.id}-${codeCompetence}`
    const commentaireValue = commentairesEleves[cleEleveCompetence] !== undefined 
        ? commentairesEleves[cleEleveCompetence] 
        : getCommentaireDerniereEvaluation(eleve.id, codeCompetence, dernieresEvaluationsDirectes)

    return (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {/* Boutons de couleur directs pour éviter la popup */}
            {couleurs.map(couleur => (
                <button
                    key={couleur.nom}
                    className="btn-noter"
                    style={{
                        backgroundColor: couleur.css,
                        color: 'white',
                        fontSize: '11px',
                        height: '50px',
                        padding: '6px 10px',
                        minWidth: '80px',
                        opacity: derniereCouleur && derniereCouleur !== couleur.nom ? 0.4 : 1,
                        boxShadow: derniereCouleur === couleur.nom ? `0 0 8px ${couleur.css}99` : 'none',
                        transform: derniereCouleur === couleur.nom ? 'scale(1.05)' : 'scale(1)',
                        transition: 'all 0.2s ease',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                    onClick={() => handleNoteClick(couleur.nom)}
                    disabled={!codeCompetence}
                >
                    {couleur.label}
                </button>
            ))}
            
            {/* Champ de commentaire pour les évaluations directes */}
            <div style={{ width: '100%', marginTop: '10px' }}>
                <textarea
                    placeholder="Commentaire / Remédiation (facultatif)..."
                    value={commentaireValue}
                    onChange={(e) => {
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
        </div>
    )
}

export default NoteCompetence