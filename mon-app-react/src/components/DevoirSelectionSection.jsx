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
    setDernieresEvaluationsDirectes
}) => {
    const [showDevoirSelection, setShowDevoirSelection] = useState(false)
    const [devoirValide, setDevoirValide] = useState(false) // Tracker si le devoir a été validé
    
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
    const afficherPopupNotesEclaircie = (devoirSelectionneParam = null) => {
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
                            onConfirmCallback: () => {
                                // Continuer le processus d'attachement
                                console.log('⚠️ Utilisateur a choisi de continuer malgré les doublons')
                                // Fermer la popup
                                setConfirmationDialog(prev => ({ ...prev, isVisible: false }))
                                // Continuer avec la confirmation normale
                                const confirmation = confirm(`⚠️ ATTENTION ! Il y a ${totalNotes} note(s) déjà saisie(s) pour la compétence ${codeCompetence} :\n\n${notesDejasSaisiesInfo.join('\n')}\n\n🔗 Voulez-vous les attacher au devoir "${nomDevoir}" ?\n\nOui = Attacher les notes au devoir\nAnnuler = Laisser les notes sans devoir`)
                                if (confirmation) {
                                    attacherNotesAuDevoir(notesAAttacher, nomDevoir, devoirActuel)
                                }
                            }
                        })
                        return // Sortir de la fonction, la popup gère la suite
                    }
                }
                
                const confirmation = confirm(`⚠️ ATTENTION ! Il y a ${totalNotes} note(s) déjà saisie(s) pour la compétence ${codeCompetence} :\n\n${notesDejasSaisiesInfo.join('\n')}\n\n🔗 Voulez-vous les attacher au devoir "${nomDevoir}" ?\n\nOui = Attacher les notes au devoir\nAnnuler = Laisser les notes sans devoir`)
                
                if (confirmation) {
                    attacherNotesAuDevoir(notesAAttacher, nomDevoir, devoirActuel)
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
                devoirKey = generateDevoirKey(classeId, teacherInfo.id, codeCompetence)
            } else if (devoirActuel) {
                // Devoir existant sélectionné - utiliser sa devoirKey
                devoirKey = devoirActuel
            } else {
                // Essayer de trouver le devoir par son nom dans la liste des devoirs existants
                const devoirExistant = devoirs.find(d => d.devoir_label === nomDevoir)
                if (devoirExistant) {
                    devoirKey = devoirExistant.devoirKey
                } else {
                    console.error('Impossible de déterminer la devoirKey pour:', nomDevoir)
                    showAlert('Impossible de déterminer la clé du devoir.', 'error')
                    return
                }
            }
            
            console.log('🔑 DevoirKey générée:', devoirKey)
            
            // Mettre à jour chaque note
            for (const noteId of idsNotes) {
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
                } else {
                    console.log(`✅ Note ${noteId} mise à jour avec succès`)
                }
            }
            
            // Au lieu de recharger toutes les notes, mettre à jour seulement les notes modifiées
            setNotes(prevNotes => {
                return prevNotes.map(note => {
                    if (idsNotes.includes(note.id)) {
                        return {
                            ...note,
                            devoir_key: devoirKey,
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
                                devoir_key: devoirKey,
                                devoir_label: nomDevoir
                            })
                            break
                        }
                    }
                })
                return newMap
            })
            
            showAlert(`${idsNotes.length} note(s) attachée(s) au devoir "${nomDevoir}" avec succès !`, 'success')
            
        } catch (error) {
            console.error('Erreur lors de l\'attachement des notes:', error)
            showAlert('Erreur lors de l\'attachement des notes au devoir.', 'error')
        }
    }

    const handleCreerDevoir = () => {
        if (nouveauDevoirNom.trim()) {
            // Afficher la popup des notes eclaircie AVANT de valider le devoir
            afficherPopupNotesEclaircie()
            
            setDevoirValide(true)
            console.log('✅ Devoir validé:', nouveauDevoirNom.trim())
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
                                    
                                    setDevoirSelectionne(nouveauDevoir)
                                    if (nouveauDevoir) {
                                        setNouveauDevoirNom('') // Effacer le nouveau devoir si on sélectionne un existant
                                        // Afficher la popup des notes eclaircie quand un devoir est sélectionné
                                        afficherPopupNotesEclaircie(nouveauDevoir)
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