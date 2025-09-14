import React from 'react'
import NoteCompetence from './NoteCompetence'
import NotePastille from './NotePastille'

function SaisieNoteEtDevoir({ 
    // Props pour les élèves et données
    elevesVisibles,
    isStudentMode,
    studentInfo,
    codeCompetence,
    
    // Props pour l'organisation des notes
    organiserNotesParHierarchie,
    isCompetenceN1,
    genererLignesTableauAvecBilan,
    
    // Props pour l'affichage
    eleveRefs,
    getPhotoUrl,
    getNomClasse,
    tableauVisible,
    toggleTableauVisible,
    
    // Props pour NoteCompetence
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
    setNotes,
    
    // Props pour le tableau hiérarchique
    ouvertureModalEnCours,
    creerTooltipEnrichi,
    setNoteDetail,
    setEleveActuel,
    setCompetenceModalCode,
    setModalOuvert,
    getCouleurCss,
    getCouleurFondCompetence,
    getPositionnementEnseignant,
    setElevePositionnement,
    setCompetencePositionnement,
    setModalPositionnementOuvert
}) {
    return (
        <>
            {/* Mode compétence spécifique - affichage classique */}
            {elevesVisibles
                .filter(eleve => !isStudentMode || eleve.id === studentInfo?.id) // En mode étudiant, afficher seulement l'élève connecté
                .map(eleve => {
                    const hierarchie = organiserNotesParHierarchie(eleve.id)
                    // Activer le mode complet si on sélectionne une compétence N1 pour voir toutes les N2
                    const modeComplet = isCompetenceN1(codeCompetence)
                    const lignes = genererLignesTableauAvecBilan(hierarchie, eleve.id, modeComplet)

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
                                <NoteCompetence
                                    eleve={eleve}
                                    codeCompetence={codeCompetence}
                                    isStudentMode={isStudentMode}
                                    getDerniereCouleurDirecte={getDerniereCouleurDirecte}
                                    commentairesEleves={commentairesEleves}
                                    setCommentairesEleves={setCommentairesEleves}
                                    getCommentaireDerniereEvaluation={getCommentaireDerniereEvaluation}
                                    ajouterNoteDirecte={ajouterNoteDirecte}
                                    devoirViewVisible={devoirViewVisible}
                                    devoirViewRef={devoirViewRef}
                                    notes={notes}
                                    dernieresEvaluationsDirectes={dernieresEvaluationsDirectes}
                                    teacherInfo={teacherInfo}
                                    devoirKeyVisible={devoirKeyVisible}
                                    devoirSelectionne={devoirSelectionne}
                                    devoirs={devoirs}
                                    setDernieresEvaluationsDirectes={setDernieresEvaluationsDirectes}
                                    nouveauDevoirNom={nouveauDevoirNom}
                                    setNotes={setNotes}
                                />
                            </div>

                            {/** Affichage conditionnel : message si pas d'évaluations, sinon tableau */}
                            {lignes.length === 0 && codeCompetence ? (
                                <div className="aucune-note">
                                    <em>Aucune évaluation pour cette compétence</em>
                                </div>
                            ) : (
                                <>
                                    <div style={{ textAlign: 'right', margin: '15px 20px 15px 0' }}>
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
                                                    const competenceDetails = ligne.niveau3 || ligne.niveau2 || ligne.niveau1
                                                    
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
                                                                </div>
                                                            </td>
                                                            <td className="cell-notes-hierarchique">
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    {ligne.notes.length > 0 ? (
                                                                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                            {ligne.notes.map((note, i) => (
                                                                                <NotePastille
                                                                                    key={i}
                                                                                    note={note}
                                                                                    disabled={ouvertureModalEnCours}
                                                                                    tooltip={creerTooltipEnrichi(note)}
                                                                                    onClick={(note) => {
                                                                                        
                                                                                        setNoteDetail(note)
                                                                                    }}
                                                                                />
                                                                            ))}
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
                                                                                        e.stopPropagation()
                                                                                        const competenceCodeSpecifique = ligne.niveau3?.code || ligne.niveau2?.code || ligne.niveau1?.code
                                                                                        
                                                                                        setEleveActuel(eleve)
                                                                                        setCompetenceModalCode(competenceCodeSpecifique)
                                                                                        setModalOuvert(true)
                                                                                    }}
                                                                                >+</button>
                                                                            )}
                                                                        </div>
                                                                    ) : (
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
                                                                                e.stopPropagation()
                                                                                const competenceCodeSpecifique = ligne.niveau3?.code || ligne.niveau2?.code || ligne.niveau1?.code
                                                                                
                                                                                setEleveActuel(eleve)
                                                                                setCompetenceModalCode(competenceCodeSpecifique)
                                                                                setModalOuvert(true)
                                                                            } : undefined}
                                                                        >+</div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="cell-positionnement">
                                                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {ligne.niveau2?.code && (
                                                                        <>
                                                                            {((!ligne.positionnementEnseignant && isStudentMode) || (!isStudentMode)) && (
                                                                                <div
                                                                                    className="pastille-auto"
                                                                                    style={{
                                                                                        backgroundColor: getCouleurCss(ligne.positionnementAuto || 'Gris')
                                                                                    }}
                                                                                    title={`Positionnement automatique: ${ligne.positionnementAuto || 'Non évalué'}`}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation()
                                                                                    }}
                                                                                >
                                                                                    {isStudentMode ? 'P' : 'A'}
                                                                                </div>
                                                                            )}

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
                                                                                        e.stopPropagation()
                                                                                        if (!isStudentMode) {
                                                                                            setElevePositionnement(eleve)
                                                                                            setCompetencePositionnement(ligne.niveau2.code)
                                                                                            setModalPositionnementOuvert(true)
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    {isStudentMode ? 'P' : 'E'}
                                                                                </div>
                                                                            )}

                                                                            {!ligne.positionnementEnseignant && !isStudentMode && (
                                                                                <button
                                                                                    className="btn-positionner"
                                                                                    style={{ marginLeft: '5px' }}
                                                                                    title="Cliquer pour définir un positionnement enseignant"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation()
                                                                                        setElevePositionnement(eleve)
                                                                                        setCompetencePositionnement(ligne.niveau2.code)
                                                                                        setModalPositionnementOuvert(true)
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
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </>
                            )}
                        </div>
                    )
                })
            }
        </>
    )
}

export default SaisieNoteEtDevoir