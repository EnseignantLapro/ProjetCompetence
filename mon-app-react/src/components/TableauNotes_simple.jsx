import React, { useEffect, useState } from 'react'
import './TableauNotes.css'
import ColorPickerModal from './ColorPickerModal'
import PositionnementModal from './PositionnementModal'
import NotePastille from './NotePastille'
import { competencesN1N2 } from '../data/competences'

function TableauNotes({ competenceChoisie, classeChoisie, classes }) {
    const [eleves, setEleves] = useState([])
    const [notes, setNotes] = useState([])
    const [modalOuvert, setModalOuvert] = useState(false)
    const [eleveActuel, setEleveActuel] = useState(null)
    const [noteDetail, setNoteDetail] = useState(null)
    
    // Modal de positionnement enseignant
    const [modalPositionnementOuvert, setModalPositionnementOuvert] = useState(false)
    const [elevePositionnement, setElevePositionnement] = useState(null)
    const [competencePositionnement, setCompetencePositionnement] = useState(null)

    const codeCompetence = competenceChoisie
        ? competenceChoisie.niveau3 || competenceChoisie.niveau2 || competenceChoisie.niveau1
        : null

    const [competencesN3, setCompetencesN3] = useState([])
    const [positionnementsEnseignant, setPositionnementsEnseignant] = useState([])

    useEffect(() => {
        const idClasse = classeChoisie
        if (!idClasse) {
            fetch(`http://${window.location.hostname}:3001/eleves`)
                .then(res => res.json())
                .then(setEleves)
            return
        }

        fetch(`http://${window.location.hostname}:3001/eleves?classe_id=${idClasse}`)
            .then(res => res.json())
            .then(setEleves)
        fetch(`http://${window.location.hostname}:3001/notes`).then(res => res.json()).then(setNotes)
        fetch(`http://${window.location.hostname}:3001/competences-n3`).then(res => res.json()).then(setCompetencesN3)
        fetch(`http://${window.location.hostname}:3001/positionnements`).then(res => res.json()).then(setPositionnementsEnseignant)
    }, [classeChoisie])

    const getCouleur = (eleveId) => {
        const note = notes.find(n => n.eleve_id === eleveId && n.competence_code === codeCompetence)
        return note ? note.couleur : ''
    }

    const getCouleurPourCompetence = (eleveId, competenceCode) => {
        const note = notes.find(n => n.eleve_id === eleveId && n.competence_code === competenceCode)
        return note ? note.couleur : ''
    }

    const isCompetenceInHierarchy = (competenceCode) => {
        if (!competenceChoisie) return false
        
        // Vérifier tous les niveaux de la hiérarchie
        if (competenceChoisie.niveau1 === competenceCode) return true
        if (competenceChoisie.niveau2 === competenceCode) return true
        if (competenceChoisie.niveau3 === competenceCode) return true
        
        // Vérifier si c'est une sous-compétence du niveau choisi
        const niveau1 = competenceChoisie.niveau1
        const niveau2 = competenceChoisie.niveau2
        
        if (niveau1 && competenceCode.startsWith(niveau1)) return true
        if (niveau2 && competenceCode.startsWith(niveau2)) return true
        
        return false
    }

    const getNotesVisibles = (eleveId) => {
        return notes.filter(note => {
            return note.eleve_id === eleveId && isCompetenceInHierarchy(note.competence_code)
        })
    }

    const handleClickEleve = (eleve, competenceCodeSpecifique = null) => {
        const competenceAUtiliser = competenceCodeSpecifique || codeCompetence
        
        if (!competenceAUtiliser) {
            alert('Impossible de déterminer la compétence à évaluer.')
            return
        }
        
        setEleveActuel(eleve)
        if (competenceCodeSpecifique && competenceCodeSpecifique !== codeCompetence) {
            setNoteDetail({
                eleve_id: eleve.id,
                competence_code: competenceCodeSpecifique,
                couleur: getCouleurPourCompetence(eleve.id, competenceCodeSpecifique)
            })
        }
        setModalOuvert(true)
    }

    const handleSaveNote = (nouvelleNote) => {
        const autres = notes.filter(n => !(n.eleve_id === nouvelleNote.eleve_id && n.competence_code === nouvelleNote.competence_code))
        setNotes([...autres, nouvelleNote])
    }

    const handleDeleteNote = async (noteId) => {
        try {
            const res = await fetch(`http://${window.location.hostname}:3001/notes/${noteId}`, {
                method: 'DELETE'
            })
            
            if (res.ok) {
                setNotes(notes.filter(n => n.id !== noteId))
            }
        } catch (error) {
            console.error('Erreur suppression note:', error)
        }
    }

    // Fonctions de calcul (gardées intactes car elles fonctionnent)
    const calculerPositionnementPondere = (eleveId, competenceN1) => {
        // Récupérer le positionnement enseignant pour cette compétence N1
        const positionnementEnseignant = positionnementsEnseignant.find(p => 
            p.eleve_id === eleveId && p.competence_code === competenceN1
        )
        
        // Si l'enseignant a positionné, utiliser cette valeur avec priorité
        if (positionnementEnseignant) {
            const couleurToPoints = { rouge: 0, jaune: 1, bleu: 2, vert: 3 }
            const points = couleurToPoints[positionnementEnseignant.couleur] || 0
            
            // Pour le retour, on fournit à la fois la couleur et la valeur numérique
            return {
                couleur: positionnementEnseignant.couleur,
                moyenne: points
            }
        }
        
        // Sinon, calculer automatiquement avec pondération
        const competenceData = competencesN1N2.find(c => c.code === competenceN1)
        if (!competenceData || !competenceData.sousCompetences) {
            return { couleur: 'gris', moyenne: 0 }
        }
        
        let totalPoids = 0
        let sommePoidsPoints = 0
        
        competenceData.sousCompetences.forEach(sousComp => {
            const noteEleve = notes.find(n => 
                n.eleve_id === eleveId && n.competence_code === sousComp.code
            )
            
            if (noteEleve) {
                const couleurToPoints = { rouge: 0, jaune: 1, bleu: 2, vert: 3 }
                const points = couleurToPoints[noteEleve.couleur] || 0
                
                totalPoids += sousComp.poids
                sommePoidsPoints += points * sousComp.poids
            }
        })
        
        if (totalPoids === 0) {
            return { couleur: 'gris', moyenne: 0 }
        }
        
        const moyennePonderee = sommePoidsPoints / totalPoids
        
        // Déterminer la couleur basée sur la moyenne
        let couleur = 'gris'
        if (moyennePonderee >= 2.5) couleur = 'vert'
        else if (moyennePonderee >= 1.5) couleur = 'bleu'
        else if (moyennePonderee >= 0.5) couleur = 'jaune'
        else couleur = 'rouge'
        
        return {
            couleur: couleur,
            moyenne: moyennePonderee
        }
    }

    const calculerPositionnementAuto = (eleveId, competenceCode) => {
        // Pour N1: distiller depuis les notes N2 avec pondération
        const competenceN1 = competencesN1N2.find(c => c.code === competenceCode)
        if (competenceN1 && competenceN1.sousCompetences) {
            return calculerPositionnementPondere(eleveId, competenceCode)
        }
        
        // Pour N2: moyenne des notes N3 disponibles
        const notesN3 = competencesN3
            .filter(c => c.code.startsWith(competenceCode + '.'))
            .map(c => notes.find(n => n.eleve_id === eleveId && n.competence_code === c.code))
            .filter(note => note != null)
        
        if (notesN3.length === 0) {
            return { couleur: 'gris', moyenne: 0 }
        }
        
        const couleurToPoints = { rouge: 0, jaune: 1, bleu: 2, vert: 3 }
        const totalPoints = notesN3.reduce((sum, note) => sum + (couleurToPoints[note.couleur] || 0), 0)
        const moyenne = totalPoints / notesN3.length
        
        let couleur = 'gris'
        if (moyenne >= 2.5) couleur = 'vert'
        else if (moyenne >= 1.5) couleur = 'bleu'
        else if (moyenne >= 0.5) couleur = 'jaune'
        else couleur = 'rouge'
        
        return { couleur: couleur, moyenne: moyenne }
    }

    const calculerBilanBloc = (eleveId) => {
        const competencesN1 = competencesN1N2.filter(c => c.niveau === 1)
        
        let sommePonderee = 0
        let totalPonderation = 0
        
        competencesN1.forEach(competence => {
            const resultatPondere = calculerPositionnementPondere(eleveId, competence.code)
            
            // Utiliser la moyenne numérique directement sans conversion couleur->points
            const moyenneNumerique = resultatPondere.moyenne
            
            sommePonderee += moyenneNumerique * competence.ponderation
            totalPonderation += competence.ponderation
        })
        
        if (totalPonderation === 0) return 0
        
        const moyenneFinale = sommePonderee / totalPonderation
        
        // Convertir en note sur 20
        return (moyenneFinale * 20 / 3).toFixed(1)
    }

    const ouvrirPositionnement = (eleve, competenceCode) => {
        setElevePositionnement(eleve)
        setCompetencePositionnement(competenceCode)
        setModalPositionnementOuvert(true)
    }

    const sauvegarderPositionnement = async (couleur) => {
        try {
            const positionnement = {
                eleve_id: elevePositionnement.id,
                competence_code: competencePositionnement,
                couleur: couleur
            }

            const response = await fetch(`http://${window.location.hostname}:3001/positionnements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(positionnement)
            })

            if (response.ok) {
                const nouveauPositionnement = await response.json()
                setPositionnementsEnseignant(prev => {
                    const autres = prev.filter(p => 
                        !(p.eleve_id === positionnement.eleve_id && p.competence_code === positionnement.competence_code)
                    )
                    return [...autres, nouveauPositionnement]
                })
            }
        } catch (error) {
            console.error('Erreur sauvegarde positionnement:', error)
        }
        
        setModalPositionnementOuvert(false)
        setElevePositionnement(null)
        setCompetencePositionnement(null)
    }

    if (!competenceChoisie) {
        return (
            <div className="message-selection">
                <p>Veuillez choisir une compétence à évaluer</p>
            </div>
        )
    }

    return (
        <div className="tableau-notes">
            <h2>Tableau des notes - {competenceChoisie.nom}</h2>
            
            <table>
                <thead>
                    <tr>
                        <th>Élève</th>
                        <th>Évaluations</th>
                        <th>Positionnement</th>
                        <th>Bilan Bloc (/20)</th>
                    </tr>
                </thead>
                <tbody>
                    {eleves.map(eleve => {
                        const notesVisibles = getNotesVisibles(eleve.id)
                        const couleurAuto = calculerPositionnementAuto(eleve.id, codeCompetence)
                        const couleurPondere = calculerPositionnementPondere(eleve.id, competenceChoisie.niveau1)
                        const bilanBloc = calculerBilanBloc(eleve.id)
                        
                        return (
                            <tr key={eleve.id}>
                                <td>{eleve.nom} {eleve.prenom}</td>
                                <td>
                                    {notesVisibles.map(note => (
                                        <NotePastille 
                                            key={`${note.eleve_id}-${note.competence_code}`} 
                                            note={note} 
                                            onClick={() => handleClickEleve(eleve, note.competence_code)} 
                                        />
                                    ))}
                                    <button 
                                        className="btn-ajouter"
                                        onClick={() => handleClickEleve(eleve)}
                                    >
                                        +
                                    </button>
                                </td>
                                <td>
                                    <div 
                                        className={`pastille pastille-${couleurAuto.couleur}`}
                                        title="Positionnement automatique"
                                        style={{ display: 'inline-block', marginRight: '5px' }}
                                    >
                                        A
                                    </div>
                                    <div 
                                        className={`pastille pastille-${couleurPondere.couleur}`}
                                        title="Positionnement enseignant"
                                        onClick={() => ouvrirPositionnement(eleve, competenceChoisie.niveau1)}
                                        style={{ display: 'inline-block', cursor: 'pointer' }}
                                    >
                                        E
                                    </div>
                                </td>
                                <td>{bilanBloc}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>

            {modalOuvert && (
                <ColorPickerModal
                    isOpen={modalOuvert}
                    onClose={() => {
                        setModalOuvert(false)
                        setNoteDetail(null)
                    }}
                    onSave={handleSaveNote}
                    onDelete={handleDeleteNote}
                    eleve={eleveActuel}
                    competenceCode={noteDetail ? noteDetail.competence_code : codeCompetence}
                    couleurActuelle={noteDetail ? noteDetail.couleur : getCouleur(eleveActuel?.id)}
                    notes={notes}
                />
            )}

            {modalPositionnementOuvert && (
                <PositionnementModal
                    isOpen={modalPositionnementOuvert}
                    onClose={() => setModalPositionnementOuvert(false)}
                    onSave={sauvegarderPositionnement}
                    eleve={elevePositionnement}
                    competenceCode={competencePositionnement}
                />
            )}
        </div>
    )
}

export default TableauNotes
