import React, { useState } from 'react'
import DevoirOptions from './DevoirOptions'
import ConfirmationDialog from './ConfirmationDialog'
import AlertDialog from './AlertDialog'
import { apiFetch } from '../utils/api'
import { generateDevoirKey } from './TableauNotesUtils'

/**
 * Composant pour la section de sélection des devoirs
 * Permet d'associer les évaluations à un devoir existant ou d'en créer un nouveau
 * Optimisé avec React.memo pour éviter les re-renders inutiles
 * 
 * Props importantes:
 * - hasNotesForCurrentDevoir: fonction pour détecter si on est en cours de notation (pour l'affichage)
 * - shouldDisableFields: fonction pour déterminer si les champs doivent être désactivés (plus restrictive)
 */
const DevoirSelectionSection = React.memo(({ 
    devoirsSansDoublons, 
    devoirSelectionne, 
    setDevoirSelectionne,
    nouveauDevoirNom,
    setNouveauDevoirNom,
    hasNotesForCurrentDevoir,
    hasNotesForCompetence,
    devoirViewVisible,
    codeCompetence, // Code de compétence pour l'affichage dans la zone de feedback
    shouldDisableFields, // Fonction spécifique pour déterminer si les champs doivent être désactivés
    teacherInfo,
    classeId,
    devoirs,
    notes, // Ajout de notes aux props
    eleves, // Ajout de eleves aux props pour récupérer les noms
    setNotes,
    dernieresEvaluationsDirectes,
    setDernieresEvaluationsDirectes,
    devoirActifMemoire, // État mémoire du devoir actif
    setDevoirActifMemoire, // Setter pour l'état mémoire
    setDevoirViewVisible, // Pour déclencher l'affichage de la vue devoir
    setDevoirKeyVisible // Pour définir la clé du devoir à afficher
}) => {
    const [showDevoirSelection, setShowDevoirSelection] = useState(false)
    const [devoirValide, setDevoirValide] = useState(false) // Tracker si le devoir a été validé
    
    // État pour la modal de changement de devoir
    const [changementDevoirDialog, setChangementDevoirDialog] = useState({
        isVisible: false,
        nouveauDevoir: '',
        nomNouveauDevoir: '',
        notesEclaircie: {
            count: 0,
            details: [],
            idsNotes: []
        },
        competenceExisteDeja: false,
        elevesAvecNotesExistantes: []
    })
    
    // État pour la popup de confirmation des doublons
    const [confirmationDialog, setConfirmationDialog] = useState({
        isVisible: false,
        elevesAvecNotes: '',
        nomDevoir: '',
        onConfirmCallback: null
    })

    // État pour AlertDialog
    const [alertDialog, setAlertDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onOk: null
    })

    // Fonction utilitaire pour afficher une alert modale
    const showAlert = (message, type = 'info', title = '', onOk = null) => {
        setAlertDialog({
            isOpen: true,
            title: title || (type === 'error' ? 'Erreur' : type === 'success' ? 'Succès' : type === 'warning' ? 'Attention' : 'Information'),
            message,
            type,
            onOk: () => {
                setAlertDialog(prev => ({ ...prev, isOpen: false }))
                if (onOk) onOk()
            }
        })
    }

    // Fonction pour afficher la popup des notes déjà saisies avec option d'attachement
    const afficherPopupNotesEclaircie = async (devoirSelectionneParam = null) => {
        const devoirActuel = devoirSelectionneParam || devoirSelectionne
        
        if (window.debugNotes && codeCompetence) {
            const notesDejasSaisiesInfo = []
            const notesAAttacher = []
            let totalNotes = 0
            
            // Filtrer uniquement les clés qui correspondent à la compétence en cours
            Object.keys(window.debugNotes).forEach(key => {
                const [eleveId, competence] = key.split('-')
                
                // Ne considérer que la compétence actuellement sélectionnée
                if (competence === codeCompetence) {
                    const notesAvecIds = window.debugNotes[key]()
                    if (notesAvecIds.length > 0) {
                        notesAvecIds.forEach(note => {
                            const idsNotes = `ID: ${note.id}`
                            notesDejasSaisiesInfo.push(`Élève ${eleveId}: ${idsNotes}`)
                            notesAAttacher.push(note.id)
                            totalNotes += 1
                        })
                    }
                }
            })
            
            if (totalNotes > 0) {
                let nomDevoir
                if (nouveauDevoirNom.trim()) {
                    nomDevoir = nouveauDevoirNom.trim()
                } else if (devoirActuel) {
                    const devoirTrouve = devoirs.find(d => d.devoirKey === devoirActuel)
                    if (devoirTrouve) {
                        nomDevoir = devoirTrouve.devoir_label
                    } else {
                        console.error('Devoir non trouvé pour devoirKey:', devoirActuel)
                        showAlert('Devoir sélectionné introuvable.', 'error')
                        return
                    }
                } else {
                    showAlert('Aucun devoir spécifié.', 'error')
                    return
                }

                // Vérifier s'il y a déjà des notes pour cette compétence dans ce devoir
                if (devoirActuel) {
                    const notesExistantesDansDevoir = notes.filter(note => 
                        note.devoir_key === devoirActuel && 
                        note.competence_code === codeCompetence
                    )
                    
                    console.log('Vérification doublons:', {
                        devoirActuel,
                        codeCompetence,
                        notesExistantes: notesExistantesDansDevoir,
                        totalNotes: notes.length
                    })
                    
                    if (notesExistantesDansDevoir.length > 0) {
                        const elevesAvecNotes = notesExistantesDansDevoir.map(note => {
                            // Chercher l'élève dans la liste des élèves
                            const eleve = eleves?.find(e => e.id === note.eleve_id)
                            if (eleve) {
                                return `${eleve.prenom} ${eleve.nom}`
                            } else if (note.eleve_prenom && note.eleve_nom) {
                                return `${note.eleve_prenom} ${note.eleve_nom}`
                            } else {
                                return `Élève ${note.eleve_id}`
                            }
                        }).join(', ')
                        
                        // Afficher la popup de confirmation au lieu d'un confirm()
                        setConfirmationDialog({
                            isVisible: true,
                            elevesAvecNotes,
                            nomDevoir,
                            onConfirmCallback: async () => {
                                // Continuer le processus d'attachement
                                console.log('⚠️ Utilisateur a choisi de continuer malgré les doublons')
                                // Fermer la popup
                                setConfirmationDialog(prev => ({ ...prev, isVisible: false }))
                                // Continuer avec la confirmation normale
                                const confirmation = confirm(`⚠️ ATTENTION ! Il y a ${totalNotes} note(s) déjà saisie(s) pour la compétence ${codeCompetence} :\n\n${notesDejasSaisiesInfo.join('\n')}\n\n🔗 Voulez-vous les attacher au devoir "${nomDevoir}" ?\n\nOui = Attacher les notes au devoir\nAnnuler = Laisser les notes sans devoir`)
                                if (confirmation) {
                                    await attacherNotesAuDevoir(notesAAttacher, nomDevoir, devoirActuel)
                                }
                            }
                        })
                        return // Sortir de la fonction, la popup gère la suite
                    }
                }
                
                const confirmation = confirm(`⚠️ ATTENTION ! Il y a ${totalNotes} note(s) déjà saisie(s) pour la compétence ${codeCompetence} :\n\n${notesDejasSaisiesInfo.join('\n')}\n\n🔗 Voulez-vous les attacher au devoir "${nomDevoir}" ?\n\nOui = Attacher les notes au devoir\nAnnuler = Laisser les notes sans devoir`)
                
                if (confirmation) {
                    await attacherNotesAuDevoir(notesAAttacher, nomDevoir, devoirActuel)
                }
            } else {
                showAlert(`Aucune note déjà saisie pour la compétence ${codeCompetence}.`, 'info')
            }
        } else {
            showAlert('Système de debug des notes non initialisé ou compétence non sélectionnée.', 'warning')
        }
    }

    // Fonction pour attacher les notes au devoir
    const attacherNotesAuDevoir = async (idsNotes, nomDevoir, devoirSelectionneParam = null) => {
        const devoirActuel = devoirSelectionneParam || devoirSelectionne
        
        try {
            console.log('🔗 Attachement des notes au devoir:', { idsNotes, nomDevoir })
            
            // Déterminer la devoirKey pour le devoir
            let devoirKey
            if (nouveauDevoirNom.trim()) {
                // Nouveau devoir - générer une devoirKey
                devoirKey = generateDevoirKey(codeCompetence, classeId, teacherInfo.id)
            } else if (devoirActuel) {
                // Devoir existant sélectionné - utiliser sa devoirKey
                devoirKey = devoirActuel
            } else {
                console.error('Impossible de déterminer la devoirKey - aucun devoir sélectionné ou créé')
                showAlert('Veuillez sélectionner un devoir existant ou créer un nouveau devoir.', 'error')
                return
            }
            
            console.log('🔑 DevoirKey générée:', devoirKey)
            
            // 🚀 MODIFICATION CRITIQUE : Exécuter toutes les mises à jour en parallèle et attendre qu'elles soient toutes terminées
            console.log('📡 Début des mises à jour en base de données...')
            const updatePromises = idsNotes.map(async (noteId) => {
                const response = await apiFetch(`/notes/${noteId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        devoirKey: devoirKey,
                        devoir_label: nomDevoir,
                        date: new Date().toISOString().split('T')[0]
                    })
                })
                
                if (!response.ok) {
                    console.error(`Erreur lors de la mise à jour de la note ${noteId}`)
                    throw new Error(`Erreur mise à jour note ${noteId}`)
                } else {
                    console.log(`✅ Note ${noteId} mise à jour avec succès`)
                }
                
                return noteId
            })
            
            // ⏳ Attendre que TOUTES les mises à jour en BDD soient terminées
            await Promise.all(updatePromises)
            console.log('🎯 Toutes les mises à jour en base de données sont terminées !')
            
            // 🔄 MAINTENANT SEULEMENT, mettre à jour l'affichage
            console.log('🖥️ Mise à jour de l\'affichage...')
            
            // Mettre à jour l'état notes
            setNotes(prevNotes => {
                return prevNotes.map(note => {
                    if (idsNotes.includes(note.id)) {
                        return {
                            ...note,
                            devoirKey: devoirKey,  // ✅ Correction : devoirKey au lieu de devoir_key
                            devoir_label: nomDevoir
                        }
                    }
                    return note
                })
            })
            
            // Mettre à jour dernieresEvaluationsDirectes pour les notes modifiées
            setDernieresEvaluationsDirectes(prevMap => {
                const newMap = new Map(prevMap)
                idsNotes.forEach(noteId => {
                    // Chercher la note dans dernieresEvaluationsDirectes plutôt que dans notes
                    for (const [cle, noteExistante] of prevMap.entries()) {
                        if (noteExistante.id === noteId) {
                            newMap.set(cle, {
                                ...noteExistante,
                                devoirKey: devoirKey,  // ✅ Correction : devoirKey au lieu de devoir_key
                                devoir_label: nomDevoir
                            })
                            break
                        }
                    }
                })
                return newMap
            })
            
            console.log('✨ Affichage mis à jour avec succès !')
            showAlert(`${idsNotes.length} note(s) attachée(s) au devoir "${nomDevoir}" avec succès !`, 'success')
            
        } catch (error) {
            console.error('Erreur lors de l\'attachement des notes:', error)
            showAlert('Erreur lors de l\'attachement des notes au devoir.', 'error')
        }
    }

    // Fonction pour confirmer le changement de devoir
    const confirmerChangementDevoir = async () => {
        const { nouveauDevoir, nomNouveauDevoir, notesEclaircie, competenceExisteDeja } = changementDevoirDialog
        
        // Fermer la modal de changement
        setChangementDevoirDialog({
            isVisible: false,
            nouveauDevoir: '',
            nomNouveauDevoir: '',
            notesEclaircie: { count: 0, details: [], idsNotes: [] },
            competenceExisteDeja: false,
            elevesAvecNotesExistantes: []
        })
        
        // Si c'est un nouveau devoir (nouveauDevoir est vide)
        if (!nouveauDevoir) {
            // Créer le nouveau devoir - générer une clé unique une seule fois
            const nouvelleCleDevoirMemoire = generateDevoirKey(codeCompetence, classeId, teacherInfo.id)
            
            // Stocker en mémoire la clé et le label du nouveau devoir
            setDevoirActifMemoire({
                devoirKey: nouvelleCleDevoirMemoire,
                label: nomNouveauDevoir
            })
            
            setDevoirValide(true)
            console.log('✅ Nouveau devoir validé:', nomNouveauDevoir, 'avec clé:', nouvelleCleDevoirMemoire)
            
            // Attacher les notes éclaircie s'il y en a
            if (notesEclaircie.count > 0) {
                console.log('✅ Attachement des notes éclaircie au nouveau devoir')
                await attacherNotesAuDevoir(notesEclaircie.idsNotes, nomNouveauDevoir, null)
            }
        } else {
            // Cas d'un devoir existant sélectionné - récupérer sa clé existante
            const devoirExistant = devoirsSansDoublons.find(d => d.devoirKey === nouveauDevoir)
            console.log('🔍 Recherche devoir existant avec clé:', nouveauDevoir)
            console.log('🔍 Devoir trouvé:', devoirExistant)
            console.log('🔍 setDevoirKeyVisible disponible:', typeof setDevoirKeyVisible)
            console.log('🔍 setDevoirViewVisible disponible:', typeof setDevoirViewVisible)
            
            if (devoirExistant) {
                // Stocker en mémoire la clé et le label du devoir existant
                setDevoirActifMemoire({
                    devoirKey: devoirExistant.devoirKey,
                    label: devoirExistant.devoir_label
                })
                
                // Déclencher l'affichage de la vue devoir avec logs détaillés
                console.log('🎯 Appel setDevoirKeyVisible avec:', devoirExistant.devoirKey)
                setDevoirKeyVisible(devoirExistant.devoirKey)
                
                console.log('🎯 Appel setDevoirViewVisible avec: true')
                setDevoirViewVisible(true)
                
                console.log('✅ Devoir existant sélectionné:', devoirExistant.devoir_label, 'avec clé:', devoirExistant.devoirKey)
            } else {
                console.error('❌ Aucun devoir trouvé avec la clé:', nouveauDevoir)
            }
            
            setDevoirSelectionne(nouveauDevoir)
            setNouveauDevoirNom('') // Effacer le nouveau devoir si on sélectionne un existant
            
            // Si la compétence n'existe PAS déjà dans le devoir ET qu'il y a des notes éclaircie, les attacher
            if (!competenceExisteDeja && notesEclaircie.count > 0) {
                console.log('✅ Pas de conflit détecté - Attachement des notes éclaircie au devoir')
                await attacherNotesAuDevoir(notesEclaircie.idsNotes, nomNouveauDevoir, nouveauDevoir)
            } else if (competenceExisteDeja) {
                console.log('⚠️ Conflit détecté - Les notes éclaircie ne seront PAS attachées au devoir')
            } else {
                console.log('ℹ️ Aucune note éclaircie à attacher')
            }
        }
    }

    // Fonction pour annuler le changement de devoir
    const annulerChangementDevoir = () => {
        // Réinitialiser l'état mémoire du devoir
        setDevoirActifMemoire({
            devoirKey: null,
            label: null
        })
        
        // Simplement fermer la modal sans rien changer
        setChangementDevoirDialog({
            isVisible: false,
            nouveauDevoir: '',
            nomNouveauDevoir: '',
            notesEclaircie: { count: 0, details: [], idsNotes: [] },
            competenceExisteDeja: false,
            elevesAvecNotesExistantes: []
        })
    }

    const handleCreerDevoir = () => {
        if (nouveauDevoirNom.trim()) {
            const nomDevoir = nouveauDevoirNom.trim()
            
            // Vérifier si un devoir avec ce nom existe déjà pour cette classe et ce prof
            // Utiliser devoirsSansDoublons pour une recherche plus précise
            const devoirExistant = devoirsSansDoublons.find(d => 
                d.devoir_label === nomDevoir
            )
            
            // Debug: afficher les informations de comparaison
            console.log('🔍 Vérification doublon devoir:', {
                nomSaisi: nomDevoir,
                devoirsExistants: devoirsSansDoublons.map(d => ({
                    label: d.devoir_label,
                    classe: d.classe_id,
                    prof: d.prof_id
                })),
                classeActuelle: classeId,
                profActuel: teacherInfo?.id,
                devoirTrouve: devoirExistant
            })
            
            if (devoirExistant) {
                showAlert(`Un devoir avec le nom "${nomDevoir}" existe déjà pour cette classe. Veuillez choisir un nom différent.`, 'error')
                return
            }
            
            // Collecter les informations sur les notes éclaircie (même logique que pour la sélection)
            let notesEclaircie = {
                count: 0,
                details: [],
                idsNotes: []
            }
            
            if (window.debugNotes && codeCompetence) {
                Object.keys(window.debugNotes).forEach(key => {
                    const [eleveId, competence] = key.split('-')
                    
                    if (competence === codeCompetence) {
                        const notesAvecIds = window.debugNotes[key]()
                        if (notesAvecIds.length > 0) {
                            notesAvecIds.forEach(note => {
                                // Chercher l'élève dans la liste des élèves
                                const eleve = eleves?.find(e => e.id == eleveId)
                                const nomEleve = eleve ? `${eleve.prenom} ${eleve.nom}` : `Élève ${eleveId}`
                                
                                // Déterminer la couleur/niveau de la note en utilisant les vraies couleurs du système
                                let couleurEmoji = ""
                                switch(note.couleur?.toLowerCase()) {
                                    case 'rouge':
                                        couleurEmoji = "🔴"
                                        break
                                    case 'jaune':
                                        couleurEmoji = "🟡"
                                        break
                                    case 'bleu':
                                        couleurEmoji = "🔵"
                                        break
                                    case 'vert':
                                        couleurEmoji = "🟢"
                                        break
                                    default:
                                        couleurEmoji = "⚫"
                                }
                                
                                notesEclaircie.details.push(`- ${nomEleve} (${couleurEmoji})`)
                                notesEclaircie.idsNotes.push(note.id)
                                notesEclaircie.count += 1
                            })
                        }
                    }
                })
            }
            
            // Pour un nouveau devoir, il n'y a jamais de conflit de compétence
            const competenceExisteDeja = false
            const elevesAvecNotesExistantes = []
            
            // Si il n'y a pas de notes en cours de saisie, procéder automatiquement
            if (notesEclaircie.count === 0) {
                // Procéder directement à la création du devoir
                console.log('✅ Création automatique du devoir (pas de notes éclaircie)')
                
                // Créer le nouveau devoir - générer une clé unique une seule fois
                const nouvelleCleDevoirMemoire = generateDevoirKey(codeCompetence, classeId, teacherInfo.id)
                
                // Stocker en mémoire la clé et le label du nouveau devoir
                setDevoirActifMemoire({
                    devoirKey: nouvelleCleDevoirMemoire,
                    label: nomDevoir
                })
                
                setDevoirValide(true)
                console.log('✅ Nouveau devoir créé automatiquement:', nomDevoir, 'avec clé:', nouvelleCleDevoirMemoire)
            } else {
                // Afficher la modal de confirmation seulement s'il y a des notes éclaircie
                setChangementDevoirDialog({
                    isVisible: true,
                    nouveauDevoir: '', // Pas de devoir key pour un nouveau devoir
                    nomNouveauDevoir: nomDevoir,
                    notesEclaircie: notesEclaircie,
                    competenceExisteDeja: competenceExisteDeja,
                    elevesAvecNotesExistantes: elevesAvecNotesExistantes
                })
            }
        }
    }

    return (
        <div style={{
            padding: '15px',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9',
            marginBottom: '20px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, marginRight: '15px' }}>
                    📋 Associer à un devoir (facultatif)
                </h4>
                <button
                    type="button"
                    onClick={() => setShowDevoirSelection(prev => !prev)}
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

            {showDevoirSelection && !devoirViewVisible && (!hasNotesForCurrentDevoir() || nouveauDevoirNom.trim().length > 0) && (
                <div>
                    {/* Devoir existant */}
                    {devoirsSansDoublons.length > 0 && (
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Associer à un devoir existant :
                            </label>
                            <select
                                key="devoir-select-main"
                                value={devoirSelectionne || ''}
                                onChange={(e) => {
                                    const nouveauDevoir = e.target.value
                                    
                                    // Vérifier si des notes ont été saisies avec le devoir actuel
                                    if (shouldDisableFields()) {
                                        showAlert('Impossible de changer de devoir : des notes ont déjà été saisies.', 'warning')
                                        return
                                    }
                                    
                                    // Vérifier s'il y a des notes existantes pour cette compétence
                                    if (hasNotesForCompetence() && devoirSelectionne && nouveauDevoir !== devoirSelectionne) {
                                        showAlert('Impossible de changer l\'association au devoir : des notes ont déjà été saisies pour cette compétence.', 'warning')
                                        return
                                    }
                                    
                                    // Si c'est une déselection (retour à vide), l'appliquer directement
                                    if (!nouveauDevoir) {
                                        setDevoirSelectionne(null)
                                        return
                                    }
                                    
                                    // Sinon, afficher la modal de confirmation avec le nouveau devoir
                                    const devoirTrouve = devoirs.find(d => d.devoirKey === nouveauDevoir)
                                    const nomDevoir = devoirTrouve ? devoirTrouve.devoir_label : nouveauDevoir
                                    
                                    // Collecter les informations sur les notes éclaircie
                                    let notesEclaircie = {
                                        count: 0,
                                        details: [],
                                        idsNotes: []
                                    }
                                    
                                    if (window.debugNotes && codeCompetence) {
                                        Object.keys(window.debugNotes).forEach(key => {
                                            const [eleveId, competence] = key.split('-')
                                            
                                            if (competence === codeCompetence) {
                                                const notesAvecIds = window.debugNotes[key]()
                                                if (notesAvecIds.length > 0) {
                                                    notesAvecIds.forEach(note => {
                                                        // Chercher l'élève dans la liste des élèves
                                                        const eleve = eleves?.find(e => e.id == eleveId)
                                                        const nomEleve = eleve ? `${eleve.prenom} ${eleve.nom}` : `Élève ${eleveId}`
                                                        
                                                        // Déterminer la couleur/niveau de la note en utilisant les vraies couleurs du système
                                                        let couleurEmoji = ""
                                                        switch(note.couleur?.toLowerCase()) {
                                                            case 'rouge':
                                                                couleurEmoji = "🔴"
                                                                break
                                                            case 'jaune':
                                                                couleurEmoji = "🟡"
                                                                break
                                                            case 'bleu':
                                                                couleurEmoji = "🔵"
                                                                break
                                                            case 'vert':
                                                                couleurEmoji = "🟢"
                                                                break
                                                            default:
                                                                couleurEmoji = "⚫"
                                                        }
                                                        
                                                        notesEclaircie.details.push(`- ${nomEleve} (${couleurEmoji})`)
                                                        notesEclaircie.idsNotes.push(note.id)
                                                        notesEclaircie.count += 1
                                                    })
                                                }
                                            }
                                        })
                                    }
                                    
                                    // Vérifier si la compétence existe déjà dans le devoir sélectionné
                                    let competenceExisteDeja = false
                                    let elevesAvecNotesExistantes = []
                                    
                                    if (nouveauDevoir) {
                                        // Vérifier les notes déjà enregistrées en base pour cette compétence dans ce devoir
                                        const notesExistantesDansDevoir = notes.filter(note => 
                                            note.devoirKey === nouveauDevoir && 
                                            note.competence_code === codeCompetence
                                        )
                                        
                                        console.log('🔍 DEBUG DÉTECTION CONFLIT:', {
                                            nouveauDevoir,
                                            codeCompetence,
                                            totalNotes: notes.length,
                                            notesExistantesDansDevoir: notesExistantesDansDevoir.length,
                                            detailsNotes: notesExistantesDansDevoir,
                                            notesPourCeDevoir: notes.filter(n => n.devoirKey === nouveauDevoir),
                                            notesPourCetteCompetence: notes.filter(n => n.competence_code === codeCompetence),
                                            toutesLesNotes: notes.slice(0, 5).map(n => ({ 
                                                devoirKey: n.devoirKey, 
                                                competence_code: n.competence_code, 
                                                eleve_id: n.eleve_id 
                                            }))
                                        })
                                        
                                        // Vérifier aussi si des notes en cours appartiennent déjà à ce devoir
                                        let notesEnCoursConflictuelles = []
                                        if (window.debugNotes && codeCompetence) {
                                            Object.keys(window.debugNotes).forEach(key => {
                                                const [eleveId, competence] = key.split('-')
                                                if (competence === codeCompetence) {
                                                    const notesAvecIds = window.debugNotes[key]()
                                                    if (notesAvecIds.length > 0) {
                                                        notesAvecIds.forEach(note => {
                                                            // Vérifier si cette note appartient déjà au devoir qu'on veut sélectionner
                                                            const noteExistante = notes.find(n => n.id === note.id)
                                                            
                                                            console.log('🔎 Debug note en cours:', {
                                                                noteId: note.id,
                                                                eleveId,
                                                                noteExistanteFound: !!noteExistante,
                                                                noteExistanteDevoir: noteExistante?.devoirKey,
                                                                nouveauDevoir,
                                                                estConflit: noteExistante && noteExistante.devoirKey === nouveauDevoir
                                                            })
                                                            
                                                            if (noteExistante && noteExistante.devoirKey === nouveauDevoir) {
                                                                const eleve = eleves?.find(e => e.id == eleveId)
                                                                const nomEleve = eleve ? `${eleve.prenom} ${eleve.nom}` : `Élève ${eleveId}`
                                                                
                                                                let couleurEmoji = ""
                                                                switch(note.couleur?.toLowerCase()) {
                                                                    case 'rouge':
                                                                        couleurEmoji = "�"
                                                                        break
                                                                    case 'jaune':
                                                                        couleurEmoji = "🟡"
                                                                        break
                                                                    case 'bleu':
                                                                        couleurEmoji = "🔵"
                                                                        break
                                                                    case 'vert':
                                                                        couleurEmoji = "🟢"
                                                                        break
                                                                    default:
                                                                        couleurEmoji = "⚫"
                                                                }
                                                                
                                                                notesEnCoursConflictuelles.push(`${nomEleve} (${couleurEmoji})`)
                                                            }
                                                        })
                                                    }
                                                }
                                            })
                                        }
                                        
                                        console.log('�🔍 Vérification compétence existante:', {
                                            nouveauDevoir,
                                            codeCompetence,
                                            notesExistantesDansDevoir: notesExistantesDansDevoir.length,
                                            detailsNotes: notesExistantesDansDevoir,
                                            notesEnCoursConflictuelles: notesEnCoursConflictuelles
                                        })
                                        
                                        // S'il y a des notes existantes (en base OU en cours), c'est un conflit
                                        if (notesExistantesDansDevoir.length > 0) {
                                            competenceExisteDeja = true
                                            elevesAvecNotesExistantes = notesExistantesDansDevoir.map(note => {
                                                    const eleve = eleves?.find(e => e.id === note.eleve_id)
                                                    let nomEleve
                                                    if (eleve) {
                                                        nomEleve = `${eleve.prenom} ${eleve.nom}`
                                                    } else if (note.eleve_prenom && note.eleve_nom) {
                                                        nomEleve = `${note.eleve_prenom} ${note.eleve_nom}`
                                                    } else {
                                                        nomEleve = `Élève ${note.eleve_id}`
                                                    }
                                                    
                                                    let couleurEmoji = ""
                                                    switch(note.couleur?.toLowerCase()) {
                                                        case 'rouge':
                                                            couleurEmoji = "🔴"
                                                            break
                                                        case 'jaune':
                                                            couleurEmoji = "🟡"
                                                            break
                                                        case 'bleu':
                                                            couleurEmoji = "🔵"
                                                            break
                                                        case 'vert':
                                                            couleurEmoji = "🟢"
                                                            break
                                                        default:
                                                            couleurEmoji = "⚫"
                                                    }
                                                    
                                                    return `${nomEleve} (${couleurEmoji})`
                                            })
                                        }
                                    }
                                    
                                    // IMPORTANT : Quand la compétence existe déjà, on garde les notes éclaircie
                                    // pour les afficher dans le message d'avertissement (pour dire qu'elles ne seront pas prises en compte)
                                    // Mais on ne les attachera pas au devoir
                                    
                                    // Si il n'y a pas de notes en cours de saisie ET pas de conflit de compétence,
                                    // procéder automatiquement sans confirmation
                                    if (notesEclaircie.count === 0 && !competenceExisteDeja) {
                                        // Procéder directement à l'association
                                        console.log('✅ Association automatique au devoir (pas de notes éclaircie, pas de conflit)')
                                        
                                        // Mettre à jour la mémoire du devoir actif
                                        setDevoirActifMemoire({
                                            devoirKey: nouveauDevoir,
                                            label: nomDevoir
                                        })
                                        
                                        setDevoirValide(true)
                                        setDevoirViewVisible(true)
                                        setDevoirKeyVisible(nouveauDevoir)
                                        console.log('✅ Devoir existant associé automatiquement:', nomDevoir, 'avec clé:', nouveauDevoir)
                                    } else {
                                        // Afficher la modal de confirmation seulement s'il y a des notes éclaircie OU un conflit
                                        setChangementDevoirDialog({
                                            isVisible: true,
                                            nouveauDevoir: nouveauDevoir,
                                            nomNouveauDevoir: nomDevoir,
                                            notesEclaircie: notesEclaircie,
                                            competenceExisteDeja: competenceExisteDeja,
                                            elevesAvecNotesExistantes: elevesAvecNotesExistantes
                                        })
                                    }
                                }}
                                disabled={shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc',
                                    fontSize: '14px',
                                    backgroundColor: (shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)) ? '#f8f9fa' : 'white',
                                    cursor: (shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <option value="">-- Sélectionner un devoir existant --</option>
                                <DevoirOptions devoirsSansDoublons={devoirsSansDoublons} keyPrefix="component" />
                            </select>
                        </div>
                    )}

                    {/* OU nouveau devoir */}
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            {devoirsSansDoublons.length > 0 ? 'OU créer un nouveau devoir :' : 'Créer un nouveau devoir :'}
                        </label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                            <input
                                type="text"
                                value={nouveauDevoirNom}
                                onChange={(e) => {
                                    setNouveauDevoirNom(e.target.value)
                                    setDevoirValide(false) // Réinitialiser la validation quand on modifie le nom
                                    if (e.target.value.trim() && devoirSelectionne) {
                                        setDevoirSelectionne(null) // Effacer la sélection si on tape un nouveau nom
                                    }
                                }}
                                placeholder="Nom du nouveau devoir"
                                disabled={shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc',
                                    fontSize: '14px',
                                    backgroundColor: (shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)) ? '#f8f9fa' : 'white',
                                    cursor: (shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)) ? 'not-allowed' : 'text'
                                }}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && nouveauDevoirNom.trim()) {
                                        handleCreerDevoir()
                                    }
                                }}
                            />
                            <button
                                onClick={handleCreerDevoir}
                                disabled={!nouveauDevoirNom.trim() || shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    backgroundColor: (!nouveauDevoirNom.trim() || shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)) ? '#e0e0e0' : '#4caf50',
                                    color: (!nouveauDevoirNom.trim() || shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)) ? '#999' : 'white',
                                    cursor: (!nouveauDevoirNom.trim() || shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)) ? 'not-allowed' : 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Créer le devoir
                            </button>
                        </div>
                        
                        {/* Zone d'information quand le devoir a été validé */}
                        {devoirValide && nouveauDevoirNom.trim().length >= 1 && (
                            <div style={{
                                marginTop: '10px',
                                padding: '10px',
                                backgroundColor: '#e8f5e8',
                                border: '1px solid #4caf50',
                                borderRadius: '4px',
                                fontSize: '14px',
                                color: '#2e7d32'
                            }}>
                                ✅ <strong>Vous êtes en train de positionner la compétence "{codeCompetence}" sur le devoir "{nouveauDevoirNom.trim()}"</strong>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Popup de confirmation pour les doublons */}
            <ConfirmationDialog
                isVisible={confirmationDialog.isVisible}
                type="warning"
                title="Compétence déjà présente dans ce devoir"
                message={`La compétence "${codeCompetence}" existe déjà dans le devoir "${confirmationDialog.nomDevoir}" pour les élèves :\n\n${confirmationDialog.elevesAvecNotes}\n\nSi vous continuez, les positions de ces élèves saisies à l'instant seront perdues !`}
                confirmText="Continuer et perdre les positions"
                cancelText="Annuler l'opération"
                onConfirm={confirmationDialog.onConfirmCallback}
                onCancel={() => setConfirmationDialog(prev => ({ ...prev, isVisible: false }))}
            />

            {/* Modal de confirmation pour le changement de devoir */}
            <ConfirmationDialog
                isVisible={changementDevoirDialog.isVisible}
                type={changementDevoirDialog.competenceExisteDeja ? "warning" : "info"}
                title="Confirmer l'association au devoir"
                message={changementDevoirDialog.competenceExisteDeja ? 
                    (changementDevoirDialog.notesEclaircie.count > 0 ? 
                        `⚠️ ATTENTION ! La compétence "${codeCompetence}" existe déjà dans ce devoir.\n\nCes notes en cours de saisie ne seront PAS prises en compte :\n\n${changementDevoirDialog.notesEclaircie.details.join('\n')}` 
                        :
                        `"${changementDevoirDialog.nomNouveauDevoir}"`
                    )
                    : 
                    `Voulez-vous associer la compétence "${codeCompetence}" au devoir "${changementDevoirDialog.nomNouveauDevoir}" ?${changementDevoirDialog.notesEclaircie.count > 0 ? `\n\n📋 ${changementDevoirDialog.notesEclaircie.count} note(s) déjà saisie(s) pour cette compétence seront automatiquement attachées :\n\n${changementDevoirDialog.notesEclaircie.details.join('\n')}` : '\n\nAucune note déjà saisie pour cette compétence.'}`
                }
                confirmText={changementDevoirDialog.competenceExisteDeja ? 'Confirmer' : changementDevoirDialog.notesEclaircie.count > 0 ? `Associer et attacher ${changementDevoirDialog.notesEclaircie.count} note(s)` : 'Associer au devoir'}
                cancelText="Annuler"
                onConfirm={confirmerChangementDevoir}
                onCancel={annulerChangementDevoir}
            />

            {/* Dialog d'alerte pour les messages informatifs */}
            <AlertDialog
                isOpen={alertDialog.isOpen}
                title={alertDialog.title}
                message={alertDialog.message}
                type={alertDialog.type}
                onOk={alertDialog.onOk}
            />
        </div>
    )
})

DevoirSelectionSection.displayName = 'DevoirSelectionSection'

export default DevoirSelectionSection