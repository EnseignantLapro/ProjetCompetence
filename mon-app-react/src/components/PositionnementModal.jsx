import { useState } from 'react'
import { apiFetch } from '../utils/api'
import './PositionnementModal.css'

const PositionnementModal = ({ 
    eleve, 
    competenceCode, 
    competenceNom,
    positionnementActuel,
    onClose, 
    onSave 
}) => {
    const [couleurSelectionnee, setCouleurSelectionnee] = useState(positionnementActuel || '')

    const couleurs = [
        { nom: 'rouge', label: 'Rouge - Non acquis', css: '#e53935' },
        { nom: 'jaune', label: 'Jaune - En cours d\'acquisition', css: '#fdd835' },
        { nom: 'bleu', label: 'Bleu - Acquis', css: '#1e88e5' },
        { nom: 'vert', label: 'Vert - Expert', css: '#43a047' }
    ]

    const handleSave = () => {
        if (couleurSelectionnee) {
            onSave(couleurSelectionnee)
        }
        onClose()
    }

    const handleSupprimer = () => {
        onSave(null) // Passer null pour supprimer le positionnement
        onClose()
    }

    return (
        <div className="modal-positionnement">
            <div className="modal-positionnement-content">
                <div className="modal-header">
                    <h3>📊 Positionnement Enseignant</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                
                <div className="modal-body">
                    <div className="eleve-info">
                        <strong>{eleve.prenom} {eleve.nom}</strong>
                        <p><small>{competenceCode} - {competenceNom}</small></p>
                    </div>

                    <div className="couleurs-grid">
                        {couleurs.map(couleur => (
                            <div 
                                key={couleur.nom}
                                className={`couleur-option ${couleurSelectionnee === couleur.nom ? 'selected' : ''}`}
                                onClick={() => setCouleurSelectionnee(couleur.nom)}
                            >
                                <div 
                                    className="pastille-preview"
                                    style={{ backgroundColor: couleur.css }}
                                ></div>
                                <span>{couleur.label}</span>
                            </div>
                        ))}
                    </div>

                    {positionnementActuel && (
                        <div className="position-actuelle">
                            <p><small>Positionnement actuel: <strong>{positionnementActuel}</strong></small></p>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    {positionnementActuel && (
                        <button className="btn-supprimer" onClick={handleSupprimer}>
                            Supprimer le positionnement
                        </button>
                    )}
                    <div className="btn-group">
                        <button className="btn-annuler" onClick={onClose}>
                            Annuler
                        </button>
                        <button 
                            className="btn-sauvegarder" 
                            onClick={handleSave}
                            disabled={!couleurSelectionnee}
                        >
                            Sauvegarder
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PositionnementModal
