import React, { useEffect, useState } from 'react'
import './TableauNotes.css'
import ColorPickerModal from './ColorPickerModal'
import NotePastille from './NotePastille'
import { competencesN1N2 } from '../data/competences'

function TableauNotes({ competenceChoisie, classeChoisie, classes }) {
    const [eleves, setEleves] = useState([])
    const [notes, setNotes] = useState([])

    const [modalOuvert, setModalOuvert] = useState(false)
    const [eleveActuel, setEleveActuel] = useState(null)
    const [noteDetail, setNoteDetail] = useState(null)

    const codeCompetence = competenceChoisie
        ? competenceChoisie.niveau3 || competenceChoisie.niveau2 || competenceChoisie.niveau1
        : null

   

    const [competencesN3, setCompetencesN3] = useState([])

    useEffect(() => {
        const idClasse = classeChoisie
        if (!idClasse) {
            fetch('http://localhost:3001/eleves')
                .then(res => res.json())
                .then(setEleves)
            return
        }

        fetch(`http://localhost:3001/eleves?classe_id=${idClasse}`)
            .then(res => res.json())
            .then(setEleves)
        fetch('http://localhost:3001/notes').then(res => res.json()).then(setNotes)
        fetch('http://localhost:3001/competences-n3').then(res => res.json()).then(setCompetencesN3)
    }, [classeChoisie])

    const getCouleur = (eleveId) => {
        const note = notes.find(n => n.eleve_id === eleveId && n.competence_code === codeCompetence)
        return note ? note.couleur : ''
    }

    // Fonction pour vérifier si une compétence fait partie de la hiérarchie sélectionnée
    const isCompetenceInHierarchy = (competenceCode) => {
        // Si aucune compétence n'est sélectionnée, on affiche tout
        if (!codeCompetence) return true
        
        if (!competenceCode) return false
        
        // Si c'est exactement la même compétence
        if (competenceCode === codeCompetence) return true
        
        // Si la compétence sélectionnée est un parent de cette compétence
        // Par exemple : sélection "C01" et compétence "C01.1" ou "C01.1.2"
        if (competenceCode.startsWith(codeCompetence + '.')) return true
        
        return false
    }

    // Fonction pour obtenir toutes les notes visibles pour un élève
    const getNotesVisibles = (eleveId) => {
        return notes.filter(n => 
            n.eleve_id === eleveId && 
            n.competence_code && 
            isCompetenceInHierarchy(n.competence_code)
        )
    }

    const handleClickEleve = (eleve) => {
        // Si aucune compétence n'est sélectionnée, on ne peut pas ajouter de note
        if (!codeCompetence) {
            alert('Sélectionnez d\'abord une compétence pour pouvoir noter un élève.')
            return
        }
        setEleveActuel(eleve)
        setModalOuvert(true)
    }

    const handleSaveNote = (nouvelleNote) => {
        // Remplace la note s'il y en avait une
        const autres = notes.filter(n => !(n.eleve_id === nouvelleNote.eleve_id && n.competence_code === codeCompetence))
        setNotes([...autres, nouvelleNote])
    }

    const handleDeleteNote = async (noteId) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) {
            return
        }

        try {
            const res = await fetch(`http://localhost:3001/notes/${noteId}`, {
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

        const c3 = competencesN3.find(c => c.code === code)
        return c3 ? `${c3.code} — ${c3.nom}` : code
    }

    // Fonction pour organiser les notes par hiérarchie pour un élève
    const organiserNotesParHierarchie = (eleveId) => {
        const notesEleve = getNotesVisibles(eleveId)
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

    // Fonction modifiée pour inclure les lignes de bilan
    const genererLignesTableauAvecBilan = (hierarchie, eleveId) => {
        const lignesBase = genererLignesTableau(hierarchie)
        const lignesAvecBilan = []
        
        // Enrichir les lignes de base avec le positionnement
        const lignesEnrichies = lignesBase.map(ligne => ({
            ...ligne,
            positionnement: ligne.niveau1 ? calculerPositionnement(ligne.niveau1.code, eleveId) :
                           ligne.niveau2 ? calculerPositionnement(ligne.niveau2.code, eleveId) : null
        }))
        
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
            
            // Ajouter la ligne de bilan
            const couleurMoyenne = calculerMoyenneCompetence(codeNiveau1, eleveId)
            const positionnementBilan = calculerPositionnement(codeNiveau1, eleveId)
            if (couleurMoyenne) {
                lignesAvecBilan.push({
                    niveau1: null,
                    niveau2: null,
                    niveau3: null,
                    notes: [],
                    positionnement: null,
                    estBilan: true,
                    codeCompetence: codeNiveau1,
                    couleurMoyenne: couleurMoyenne,
                    positionnementBilan: positionnementBilan
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

    // Fonction pour obtenir la couleur de fond selon la compétence principale
    const getCouleurFondCompetence = (codeCompetence) => {
        if (!codeCompetence) return 'transparent'
        
        const niveau1 = codeCompetence.split('.')[0]
        
        // Orange transparent : C01, C04, C07, C09, C10
        if (['C01', 'C04', 'C07', 'C09', 'C10'].includes(niveau1)) {
            return 'rgba(255, 165, 0, 0.1)' // Orange transparent
        }
        
        // Vert transparent : C02, C05, C11
        if (['C02', 'C05', 'C11'].includes(niveau1)) {
            return 'rgba(76, 175, 80, 0.1)' // Vert transparent
        }
        
        // Bleu transparent : C03, C06, C08
        if (['C03', 'C06', 'C08'].includes(niveau1)) {
            return 'rgba(33, 150, 243, 0.1)' // Bleu transparent
        }
        
        return 'transparent'
    }

    // Fonction pour calculer la moyenne des notes d'une compétence
    const calculerMoyenneCompetence = (codeCompetence, eleveid) => {
        const notesCompetence = notes.filter(note => 
            note.eleve_id === eleveid && 
            note.competence_code && 
            note.competence_code.startsWith(codeCompetence)
        )
        
        if (notesCompetence.length === 0) return null
        
        // Conversion des couleurs en valeurs numériques
        const valeursNumeriques = notesCompetence.map(note => {
            switch(note.couleur.toLowerCase()) {
                case 'rouge': return 1
                case 'orange': return 2
                case 'jaune': return 3
                case 'vert': return 4
                default: return 0
            }
        })
        
        const moyenne = valeursNumeriques.reduce((sum, val) => sum + val, 0) / valeursNumeriques.length
        
        // Conversion de la moyenne en couleur
        if (moyenne >= 3.5) return 'vert'
        if (moyenne >= 2.5) return 'jaune'
        if (moyenne >= 1.5) return 'orange'
        return 'rouge'
    }

    // Fonction pour calculer le positionnement avec système de points
    const calculerPositionnement = (codeCompetence, eleveid) => {
        const notesCompetence = notes.filter(note => 
            note.eleve_id === eleveid && 
            note.competence_code && 
            note.competence_code.startsWith(codeCompetence)
        )
        
        console.log(`Calcul positionnement pour ${codeCompetence}, élève ${eleveid}:`, notesCompetence)
        
        if (notesCompetence.length === 0) return null
        
        // Conversion des couleurs en points (5, 10, 15, 20)
        const points = notesCompetence.map(note => {
            switch(note.couleur.toLowerCase()) {
                case 'rouge': return 5
                case 'jaune': return 10
                case 'bleu': return 15
                case 'vert': return 20
                default: return 0
            }
        })
        
        const moyennePoints = points.reduce((sum, val) => sum + val, 0) / points.length
        console.log(`Points:`, points, `Moyenne:`, moyennePoints)
        
        // Conversion de la moyenne de points en couleur de positionnement
        let couleurPositionnement
        if (moyennePoints >= 17.5) couleurPositionnement = 'vert'     // 17.5-20 : vert
        else if (moyennePoints >= 12.5) couleurPositionnement = 'bleu'     // 12.5-17.4 : bleu
        else if (moyennePoints >= 7.5) couleurPositionnement = 'jaune'     // 7.5-12.4 : jaune
        else couleurPositionnement = 'rouge'                               // 5-7.4 : rouge
        
        console.log(`Couleur positionnement:`, couleurPositionnement)
        return couleurPositionnement
    }

    // Fonction pour convertir nos noms de couleurs en couleurs CSS
    const getCouleurCss = (nomCouleur) => {
        switch(nomCouleur?.toLowerCase()) {
            case 'rouge': return '#e53935'
            case 'jaune': return '#fdd835'
            case 'bleu': return '#1e88e5'
            case 'vert': return '#43a047'
            case 'orange': return '#fb8c00'
            default: return '#cccccc'
        }
    }

    const getTitreNotation = () => {
        if (!codeCompetence) return 'Vue d\'ensemble : Toutes les notes de toutes les compétences'
        
        const parts = codeCompetence.split('.')
        if (parts.length === 1) {
            // Niveau 1 : affiche toutes les sous-compétences
            return `Notation pour : ${codeCompetence} et toutes ses sous-compétences`
        } else if (parts.length === 2) {
            // Niveau 2 : affiche toutes les sous-compétences de niveau 3
            return `Notation pour : ${codeCompetence} et toutes ses sous-compétences`
        } else {
            // Niveau 3 : affiche uniquement cette compétence
            return `Notation pour : ${codeCompetence}`
        }
    }

    return (
        <div className="tableau-container">
            <h2>{getTitreNotation()}</h2>
            
            {eleves.map(eleve => {
                const hierarchie = organiserNotesParHierarchie(eleve.id)
                const lignes = genererLignesTableauAvecBilan(hierarchie, eleve.id)
                
                if (lignes.length === 0 && codeCompetence) {
                    // Afficher l'élève même s'il n'a pas de notes pour la compétence sélectionnée
                    return (
                        <div key={eleve.id} className="eleve-card">
                            <div className="eleve-header">
                                <div className="eleve-info">
                                    {eleve.photo && (
                                        <img
                                            src={`/${eleve.photo}`}
                                            alt={eleve.prenom}
                                            className="photo-eleve"
                                            onError={(e) => {
                                                e.target.onerror = null
                                                e.target.src = '/default.jpg'
                                            }}
                                        />
                                    )}
                                    <div>
                                        <h3>{eleve.prenom} {eleve.nom}</h3>
                                        <p>Classe: {getNomClasse(eleve.classe_id)}</p>
                                    </div>
                                </div>
                                <button 
                                    className="btn-noter"
                                    onClick={() => handleClickEleve(eleve)}
                                    disabled={!codeCompetence}
                                    title={codeCompetence ? 'Cliquer pour noter cet élève' : 'Sélectionnez d\'abord une compétence'}
                                >
                                    + Noter
                                </button>
                            </div>
                            <div className="aucune-note">
                                <em>Aucune note pour cette compétence</em>
                            </div>
                        </div>
                    )
                }
                
                if (lignes.length === 0) return null // En mode vue d'ensemble, ne pas afficher les élèves sans notes

                return (
                    <div key={eleve.id} className="eleve-card">
                        <div className="eleve-header">
                            <div className="eleve-info">
                                {eleve.photo && (
                                    <img
                                        src={`/${eleve.photo}`}
                                        alt={eleve.prenom}
                                        className="photo-eleve"
                                        onError={(e) => {
                                            e.target.onerror = null
                                            e.target.src = '/default.jpg'
                                        }}
                                    />
                                )}
                                <div>
                                    <h3>{eleve.prenom} {eleve.nom}</h3>
                                    <p>Classe: {getNomClasse(eleve.classe_id)}</p>
                                </div>
                            </div>
                            <button 
                                className="btn-noter"
                                onClick={() => handleClickEleve(eleve)}
                                disabled={!codeCompetence}
                                title={codeCompetence ? 'Cliquer pour noter cet élève' : 'Sélectionnez d\'abord une compétence'}
                            >
                                + Noter
                            </button>
                        </div>
                        
                        <table className="tableau-hierarchique">
                            <thead>
                                <tr>
                                    <th>Compétence principale</th>
                                    <th>Sous-compétence</th>
                                    <th>Compétence spécifique</th>
                                    <th>Notes</th>
                                    <th>Positionnement</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lignes.map((ligne, index) => {
                                    // Cas spécial pour les lignes de bilan
                                    if (ligne.estBilan) {
                                        return (
                                            <tr key={index} 
                                                style={{ 
                                                    backgroundColor: getCouleurFondCompetence(ligne.codeCompetence),
                                                    borderTop: '2px solid #ddd',
                                                    fontWeight: 'bold'
                                                }}>
                                                <td className="cell-niveau1"></td>
                                                <td className="cell-niveau2"></td>
                                                <td className="cell-niveau3">
                                                    <div style={{ fontStyle: 'italic', color: '#666' }}>
                                                        <strong>BILAN</strong>
                                                    </div>
                                                </td>
                                                <td className="cell-notes-hierarchique">
                                                    <div 
                                                        style={{
                                                            display: 'inline-block',
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            backgroundColor: getCouleurCss(ligne.couleurMoyenne),
                                                            border: '2px solid #333',
                                                            marginRight: '5px'
                                                        }}
                                                        title={`Moyenne: ${ligne.couleurMoyenne}`}
                                                    ></div>
                                                    <span style={{ fontSize: '0.9em', color: '#666' }}>
                                                        Moyenne générale
                                                    </span>
                                                </td>
                                                <td className="cell-positionnement">
                                                    {ligne.positionnementBilan ? (
                                                        <div 
                                                            style={{
                                                                display: 'inline-block',
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '50%',
                                                                backgroundColor: getCouleurCss(ligne.positionnementBilan),
                                                                border: '2px solid #333',
                                                                cursor: 'pointer'
                                                            }}
                                                            title={`Positionnement global: ${ligne.positionnementBilan}`}
                                                            onClick={() => console.log('Pastille bilan:', ligne.positionnementBilan)}
                                                        ></div>
                                                    ) : (
                                                        <span style={{fontSize: '0.8em', color: '#999'}}>-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    }
                                    
                                    // Cas normal pour les autres lignes
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
                                            {ligne.niveau3 && (
                                                <div>
                                                    <strong>{ligne.niveau3.code}</strong>
                                                    <br />
                                                    <small>{ligne.niveau3.nom}</small>
                                                </div>
                                            )}
                                        </td>
                                        <td className="cell-notes-hierarchique">
                                            {ligne.notes.map((note, i) => (
                                                <NotePastille key={i} note={note} onClick={setNoteDetail} />
                                            ))}
                                        </td>
                                        <td className="cell-positionnement">
                                            {ligne.positionnement ? (
                                                <div 
                                                    style={{
                                                        display: 'inline-block',
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '50%',
                                                        backgroundColor: getCouleurCss(ligne.positionnement),
                                                        border: '2px solid #333',
                                                        cursor: 'pointer'
                                                    }}
                                                    title={`Positionnement: ${ligne.positionnement}`}
                                                    onClick={() => console.log('Pastille positionnement:', ligne.positionnement)}
                                                ></div>
                                            ) : (
                                                <span style={{fontSize: '0.8em', color: '#999'}}>-</span>
                                            )}
                                        </td>
                                    </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            })}

            {modalOuvert && eleveActuel && (
                <ColorPickerModal
                    eleve={eleveActuel}
                    competenceCode={codeCompetence}
                    onClose={() => setModalOuvert(false)}
                    onSave={handleSaveNote}
                    ajouterNote={(note) => setNotes(prev => [...prev, note])}
                />
            )}

            {noteDetail && (
                <div className="modal-note-detail">
                    <div className="modal-content">
                        <h4>Détail de la note</h4>
                        <p><strong>Compétence :</strong> {getNomCompetence(noteDetail.competence_code)}</p>
                        <p><strong>Couleur :</strong> {noteDetail.couleur}</p>
                        <p><strong>Date :</strong> {noteDetail.date}</p>
                        <p><strong>Prof :</strong> ID {noteDetail.prof_id}</p>
                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button onClick={() => setNoteDetail(null)}>Fermer</button>
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TableauNotes