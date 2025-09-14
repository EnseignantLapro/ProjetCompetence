import React, { useState } from 'react'
import DevoirOptions from './DevoirOptions'

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
    shouldDisableFields // Fonction spécifique pour déterminer si les champs doivent être désactivés
}) => {
    const [showDevoirSelection, setShowDevoirSelection] = useState(false)

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
                                        alert('Impossible de changer de devoir : des notes ont déjà été saisies.')
                                        return
                                    }
                                    
                                    // Vérifier s'il y a des notes existantes pour cette compétence
                                    if (hasNotesForCompetence() && devoirSelectionne && nouveauDevoir !== devoirSelectionne) {
                                        alert('Impossible de changer l\'association au devoir : des notes ont déjà été saisies pour cette compétence.')
                                        return
                                    }
                                    
                                    setDevoirSelectionne(nouveauDevoir)
                                    if (nouveauDevoir) setNouveauDevoirNom('') // Effacer le nouveau devoir si on sélectionne un existant
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
                        <input
                            type="text"
                            value={nouveauDevoirNom}
                            onChange={(e) => {
                                setNouveauDevoirNom(e.target.value)
                                if (e.target.value.trim() && devoirSelectionne) {
                                    setDevoirSelectionne(null) // Effacer la sélection si on tape un nouveau nom
                                }
                            }}
                            placeholder="Nom du nouveau devoir"
                            disabled={shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid #ccc',
                                fontSize: '14px',
                                backgroundColor: (shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)) ? '#f8f9fa' : 'white',
                                cursor: (shouldDisableFields() || (hasNotesForCompetence() && devoirSelectionne)) ? 'not-allowed' : 'text'
                            }}
                        />
                        
                        {/* Zone d'information quand on saisit un nouveau devoir */}
                        {nouveauDevoirNom.trim().length >= 1 && (
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
        </div>
    )
})

DevoirSelectionSection.displayName = 'DevoirSelectionSection'

export default DevoirSelectionSection