import React from 'react'

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

    const handleNoteClick = (couleur) => {
        // Si un devoir est ouvert, ajouter la compétence temporairement
        if (devoirViewVisible && devoirViewRef.current) {
            devoirViewRef.current.ajouterCompetence(codeCompetence)
        }
        
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

    const couleurs = [
        { nom: 'rouge', label: 'Non acquis', css: '#e74c3c' },
        { nom: 'jaune', label: 'Maîtrise fragile', css: '#f1c40f' },
        { nom: 'bleu', label: 'Maîtrise satisfaisante', css: '#3498db' },
        { nom: 'vert', label: 'Très bonne maîtrise !', css: '#2ecc71' }
    ]

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