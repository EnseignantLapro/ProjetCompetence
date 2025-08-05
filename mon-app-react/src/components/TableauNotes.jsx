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

    // États pour la modal de positionnement enseignant
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
        fetch('http://localhost:3001/positionnements').then(res => res.json()).then(setPositionnementsEnseignant)
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

    // Fonctions pour le positionnement enseignant
    const handleClickPositionnement = (eleve, competenceCode) => {
        setElevePositionnement(eleve)
        setCompetencePositionnement(competenceCode)
        setModalPositionnementOuvert(true)
    }

    const handleSavePositionnement = async (couleur) => {
        if (!elevePositionnement || !competencePositionnement) return

        try {
            const response = await fetch('http://localhost:3001/positionnements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    eleve_id: elevePositionnement.id,
                    competence_code: competencePositionnement,
                    couleur: couleur,
                    prof_id: 1 // À adapter selon l'utilisateur connecté
                })
            })

            if (response.ok) {
                // Recharger les positionnements enseignant
                const positionnementsResponse = await fetch('http://localhost:3001/positionnements')
                if (positionnementsResponse.ok) {
                    const nouveauxPositionnements = await positionnementsResponse.json()
                    setPositionnementsEnseignant(nouveauxPositionnements)
                }
                
                // Fermer la modal
                setModalPositionnementOuvert(false)
                setElevePositionnement(null)
                setCompetencePositionnement(null)
            } else {
                alert('Erreur lors de la sauvegarde du positionnement')
            }
        } catch (error) {
            console.error('Erreur:', error)
            alert('Erreur lors de la sauvegarde du positionnement')
        }
    }

    const getPositionnementEnseignant = (eleveId, competenceCode) => {
        const positionnement = positionnementsEnseignant.find(p => 
            p.eleve_id === eleveId && p.competence_code === competenceCode
        )
        return positionnement ? positionnement.couleur : null
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

    // Fonction pour générer les lignes complètes avec toutes les compétences du référentiel
    const genererLignesCompletes = (eleveId) => {
        const lignes = []
        const notesEleve = notes.filter(n => n.eleve_id === eleveId)
        
        // Parcourir toutes les compétences du référentiel
        competencesN1N2.forEach(comp1 => {
            let premiereLignePourNiveau1 = true
            
            // Ajouter la compétence de niveau 1 (parent)
            const notesComp1 = notesEleve.filter(note => note.competence_code === comp1.code)
            lignes.push({
                niveau1: { code: comp1.code, nom: comp1.nom },
                niveau2: null,
                niveau3: null,
                notes: notesComp1,
                competence: comp1 // Référence pour le bilan
            })
            premiereLignePourNiveau1 = false
            
            // Ajouter les compétences de niveau 2 (enfants)
            comp1.enfants.forEach(comp2 => {
                let premiereLignePourNiveau2 = true
                
                // Chercher les notes pour cette compétence niveau 2
                const notesComp2 = notesEleve.filter(note => note.competence_code === comp2.code)
                lignes.push({
                    niveau1: null, // Ne pas répéter le niveau 1
                    niveau2: { code: comp2.code, nom: comp2.nom },
                    niveau3: null,
                    notes: notesComp2,
                    competence: comp2 // Référence pour le bilan
                })
                premiereLignePourNiveau2 = false
                
                // Ajouter les compétences de niveau 3 pour ce parent niveau 2
                const comp3List = competencesN3.filter(c3 => c3.parent_code === comp2.code)
                comp3List.forEach(comp3 => {
                    const notesComp3 = notesEleve.filter(note => note.competence_code === comp3.code)
                    // Ne pas ajouter les compétences niveau 3 sans évaluation
                    if (notesComp3.length > 0) {
                        lignes.push({
                            niveau1: null, // Ne pas répéter le niveau 1
                            niveau2: premiereLignePourNiveau2 ? { code: comp2.code, nom: comp2.nom } : null, // Ne répéter le niveau 2 que pour la première ligne N3
                            niveau3: { code: comp3.code, nom: comp3.nom },
                            notes: notesComp3,
                            competence: comp3 // Référence pour le bilan
                        })
                        if (premiereLignePourNiveau2) premiereLignePourNiveau2 = false
                    }
                })
            })
        })
        
        return lignes
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

    // Fonction pour construire la hiérarchie complète (toutes les compétences du référentiel)
    const construireHierarchieComplete = (eleveId) => {
        const hierarchie = {}
        const notesEleve = notes.filter(n => n.eleve_id === eleveId)

        // Parcourir toutes les compétences du référentiel
        competencesN1N2.forEach(comp1 => {
            // Initialiser le niveau 1
            hierarchie[comp1.code] = {
                code: comp1.code,
                nom: comp1.nom,
                sousNiveaux: {},
                notes: notesEleve.filter(note => note.competence_code === comp1.code)
            }

            // Ajouter les compétences de niveau 2
            comp1.enfants.forEach(comp2 => {
                hierarchie[comp1.code].sousNiveaux[comp2.code] = {
                    code: comp2.code,
                    nom: comp2.nom,
                    niveau3: {},
                    notes: notesEleve.filter(note => note.competence_code === comp2.code)
                }

                // Ajouter les compétences de niveau 3 pour ce niveau 2
                const comp3List = competencesN3.filter(c3 => c3.parent_code === comp2.code)
                comp3List.forEach(comp3 => {
                    const notesComp3 = notesEleve.filter(note => note.competence_code === comp3.code)
                    // Ne pas ajouter les compétences niveau 3 sans évaluation
                    if (notesComp3.length > 0) {
                        hierarchie[comp1.code].sousNiveaux[comp2.code].niveau3[comp3.code] = {
                            code: comp3.code,
                            nom: comp3.nom,
                            notes: notesComp3
                        }
                    }
                })
            })
        })

        return hierarchie
    }

    // Fonction modifiée pour inclure les lignes de bilan
    const genererLignesTableauAvecBilan = (hierarchie, eleveId, modeComplet = false) => {
        // En mode complet, vérifier que les compétences N3 sont chargées
        if (modeComplet && competencesN3.length === 0) {
            return [] // Retourner un tableau vide si les données ne sont pas encore chargées
        }
        
        // En mode complet (vue d'ensemble), construire la hiérarchie complète
        const hierarchieAUtiliser = modeComplet ? construireHierarchieComplete(eleveId) : hierarchie
        const lignesBase = genererLignesTableau(hierarchieAUtiliser)
        const lignesAvecBilan = []
        
        // Enrichir les lignes de base avec le positionnement
        const lignesEnrichies = lignesBase.map(ligne => {
            const codeCompetence = ligne.niveau1?.code || ligne.niveau2?.code
            return {
                ...ligne,
                positionnementAuto: codeCompetence ? calculerPositionnementAuto(codeCompetence, eleveId) : null,
                positionnementEnseignant: ligne.niveau2?.code ? getPositionnementEnseignant(eleveId, ligne.niveau2.code) : null,
                positionnement: ligne.niveau1 ? calculerPositionnement(ligne.niveau1.code, eleveId) :
                               ligne.niveau2 ? calculerPositionnement(ligne.niveau2.code, eleveId) : null
            }
        })
        
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
            
            // Ajouter la ligne de bilan - différent selon le mode
            const positionnementBilan = modeComplet ? 
                calculerPositionnementPondere(codeNiveau1, eleveId) : // Mode vue d'ensemble : bilan pondéré
                calculerPositionnementSimple(codeNiveau1, eleveId)     // Mode filtré : bilan simple
                
            if (positionnementBilan) {
                lignesAvecBilan.push({
                    niveau1: null,
                    niveau2: null,
                    niveau3: null,
                    notes: [],
                    positionnement: null,
                    estBilan: true,
                    codeCompetence: codeNiveau1,
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

    // Fonction pour obtenir la couleur de fond selon le bloc de la compétence
    const getCouleurFondCompetence = (codeCompetence) => {
        if (!codeCompetence) return 'transparent'
        
        // Trouver la compétence principale (niveau 1)
        const niveau1 = codeCompetence.split('.')[0]
        const competencePrincipale = competencesN1N2.find(c => c.code === niveau1)
        
        if (!competencePrincipale) return 'transparent'
        
        // Déterminer le bloc majoritaire de cette compétence principale
        // (au cas où une compétence aurait des enfants dans plusieurs blocs)
        const blocs = competencePrincipale.enfants.map(enfant => enfant.bloc)
        const blocMajoritaire = blocs.sort((a, b) =>
            blocs.filter(v => v === a).length - blocs.filter(v => v === b).length
        ).pop()
        
        // Couleurs par bloc
        switch(blocMajoritaire) {
            case 1: 
                return 'rgba(33, 150, 243, 0.1)' // Bleu transparent - Bloc 1 (Analyse et conception)
            case 2: 
                return 'rgba(76, 175, 80, 0.1)' // Vert transparent - Bloc 2 (Infrastructure)
            case 3: 
                return 'rgba(255, 165, 0, 0.1)' // Orange transparent - Bloc 3 (Développement et projet)
            default: 
                return 'transparent'
        }
    }

    // Fonction pour calculer la moyenne des notes d'une compétence
    // Fonction pour calculer le positionnement simple (mode filtré)
    // Moyenne simple des positionnements enseignant existants
    const calculerPositionnementSimple = (codeCompetence, eleveid) => {
        const notesCompetence = notes.filter(note => 
            note.eleve_id === eleveid && 
            note.competence_code && 
            note.competence_code.startsWith(codeCompetence)
        )
        
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
        
        // Conversion de la moyenne de points en couleur de positionnement
        if (moyennePoints >= 17.5) return 'vert'
        else if (moyennePoints >= 12.5) return 'bleu'
        else if (moyennePoints >= 7.5) return 'jaune'
        else return 'rouge'
    }

    // Fonction pour calculer le positionnement pondéré (mode vue d'ensemble)
    // Prend en compte les poids des N2 et la répartition des N1
    const calculerPositionnementPondere = (codeCompetence, eleveid) => {
        const competenceN1 = competencesN1N2.find(comp => comp.code === codeCompetence)
        if (!competenceN1) return null

        // Chercher les notes N1 directes
        const notesN1 = notes.filter(note => 
            note.eleve_id === eleveid && 
            note.competence_code === codeCompetence
        )
        
        const enfantsN2 = competenceN1.enfants
        let totalPoints = 0
        let totalPoids = 0
        let nombreContributions = 0
        
        enfantsN2.forEach(enfantN2 => {
            let pointsN2 = 0
            let contributionsN2 = 0
            
            // D'abord vérifier s'il y a un positionnement enseignant pour ce N2
            const positionnementEnseignant = getPositionnementEnseignant(eleveid, enfantN2.code)
            
            if (positionnementEnseignant) {
                // Utiliser le positionnement enseignant manuel
                let pointsPositionnement = 0
                switch(positionnementEnseignant.toLowerCase()) {
                    case 'rouge': pointsPositionnement = 5; break
                    case 'jaune': pointsPositionnement = 10; break
                    case 'bleu': pointsPositionnement = 15; break
                    case 'vert': pointsPositionnement = 20; break
                    default: pointsPositionnement = 0
                }
                
                if (pointsPositionnement > 0) {
                    pointsN2 = pointsPositionnement
                    contributionsN2 = 1
                }
            } else {
                // Pas de positionnement enseignant, utiliser les notes comme avant
                
                // Contribution des notes N1 réparties sur ce N2
                if (notesN1.length > 0) {
                    notesN1.forEach(noteN1 => {
                        let pointsNote = 0
                        switch(noteN1.couleur.toLowerCase()) {
                            case 'rouge': pointsNote = 5; break
                            case 'jaune': pointsNote = 10; break
                            case 'bleu': pointsNote = 15; break
                            case 'vert': pointsNote = 20; break
                            default: pointsNote = 0
                        }
                        
                        if (pointsNote > 0) {
                            // Répartition équitable entre tous les N2
                            pointsN2 += pointsNote / enfantsN2.length
                            contributionsN2 += 1 / enfantsN2.length
                        }
                    })
                }
                
                // Contribution des notes N2 directes
                const notesN2 = notes.filter(note => 
                    note.eleve_id === eleveid && 
                    note.competence_code === enfantN2.code
                )
                
                notesN2.forEach(noteN2 => {
                    let pointsNote = 0
                    switch(noteN2.couleur.toLowerCase()) {
                        case 'rouge': pointsNote = 5; break
                        case 'jaune': pointsNote = 10; break
                        case 'bleu': pointsNote = 15; break
                        case 'vert': pointsNote = 20; break
                        default: pointsNote = 0
                    }
                    
                    if (pointsNote > 0) {
                        pointsN2 += pointsNote
                        contributionsN2 += 1
                    }
                })
                
                // Contribution des notes N3 rattachées à ce N2
                const competencesN3Enfant = competencesN3.filter(c3 => c3.parent_code === enfantN2.code)
                competencesN3Enfant.forEach(compN3 => {
                    const notesN3 = notes.filter(note => 
                        note.eleve_id === eleveid && 
                        note.competence_code === compN3.code
                    )
                    
                    notesN3.forEach(noteN3 => {
                        let pointsNote = 0
                        switch(noteN3.couleur.toLowerCase()) {
                            case 'rouge': pointsNote = 5; break
                            case 'jaune': pointsNote = 10; break
                            case 'bleu': pointsNote = 15; break
                            case 'vert': pointsNote = 20; break
                            default: pointsNote = 0
                        }
                        
                        if (pointsNote > 0) {
                            pointsN2 += pointsNote
                            contributionsN2 += 1
                        }
                    })
                })
            }
            
            // Ajouter au total pondéré si il y a des contributions (notes ou positionnement enseignant)
            if (contributionsN2 > 0) {
                const moyenneN2 = pointsN2 / contributionsN2
                totalPoints += moyenneN2 * enfantN2.poid
                totalPoids += enfantN2.poid
                nombreContributions += 1
            }
        })
        
        if (nombreContributions === 0 || totalPoids === 0) return null
        
        const moyennePonderee = totalPoints / totalPoids
        
        // Conversion de la moyenne pondérée en couleur
        if (moyennePonderee >= 17.5) return 'vert'
        else if (moyennePonderee >= 12.5) return 'bleu'
        else if (moyennePonderee >= 7.5) return 'jaune'
        else return 'rouge'
    }

    // Fonction pour calculer le positionnement automatique (basé sur les notes)
    const calculerPositionnementAuto = (codeCompetence, eleveid) => {
        // Si c'est une compétence de niveau 1, calculer avec répartition sur les N2
        const competenceN1 = competencesN1N2.find(comp => comp.code === codeCompetence)
        
        if (competenceN1) {
            // C'est une compétence N1, répartir les évaluations sur les N2
            const notesN1 = notes.filter(note => 
                note.eleve_id === eleveid && 
                note.competence_code === codeCompetence
            )
            
            const enfantsN2 = competenceN1.enfants
            let totalPoints = 0
            let totalContributions = 0
            
            // Si il y a des notes N1, les répartir équitablement
            if (notesN1.length > 0) {
                notesN1.forEach(noteN1 => {
                    let pointsNote = 0
                    switch(noteN1.couleur.toLowerCase()) {
                        case 'rouge': pointsNote = 5; break
                        case 'jaune': pointsNote = 10; break
                        case 'bleu': pointsNote = 15; break
                        case 'vert': pointsNote = 20; break
                        default: pointsNote = 0
                    }
                    
                    if (pointsNote > 0) {
                        // Chaque note N1 contribue équitablement à chaque N2
                        totalPoints += pointsNote
                        totalContributions += 1
                    }
                })
            }
            
            // Ajouter aussi les évaluations directes des N2
            enfantsN2.forEach(enfantN2 => {
                const notesN2 = notes.filter(note => 
                    note.eleve_id === eleveid && 
                    note.competence_code === enfantN2.code
                )
                
                notesN2.forEach(noteN2 => {
                    let pointsNote = 0
                    switch(noteN2.couleur.toLowerCase()) {
                        case 'rouge': pointsNote = 5; break
                        case 'jaune': pointsNote = 10; break
                        case 'bleu': pointsNote = 15; break
                        case 'vert': pointsNote = 20; break
                        default: pointsNote = 0
                    }
                    
                    if (pointsNote > 0) {
                        totalPoints += pointsNote
                        totalContributions += 1
                    }
                })
            })
            
            if (totalContributions === 0) return null
            
            const moyennePoints = totalPoints / totalContributions
            console.log(`Calcul N1 ${codeCompetence}: ${totalPoints}/${totalContributions} = ${moyennePoints}`)
            
            // Conversion de la moyenne de points en couleur de positionnement
            if (moyennePoints >= 17.5) return 'vert'
            else if (moyennePoints >= 12.5) return 'bleu'
            else if (moyennePoints >= 7.5) return 'jaune'
            else return 'rouge'
        } else {
            // C'est une compétence N2 ou N3, logique modifiée pour prendre en compte la distillation
            
            // D'abord chercher les notes directes sur cette compétence
            const notesDirectes = notes.filter(note => 
                note.eleve_id === eleveid && 
                note.competence_code && 
                note.competence_code.startsWith(codeCompetence)
            )
            
            let totalPoints = 0
            let totalContributions = 0
            
            // Ajouter les notes directes
            notesDirectes.forEach(note => {
                let pointsNote = 0
                switch(note.couleur.toLowerCase()) {
                    case 'rouge': pointsNote = 5; break
                    case 'jaune': pointsNote = 10; break
                    case 'bleu': pointsNote = 15; break
                    case 'vert': pointsNote = 20; break
                    default: pointsNote = 0
                }
                
                if (pointsNote > 0) {
                    totalPoints += pointsNote
                    totalContributions += 1
                }
            })
            
            // Si c'est une compétence N2, ajouter aussi les notes N3 enfants
            const parts = codeCompetence.split('.')
            if (parts.length === 2) { // C'est une N2 (ex: C01.1)
                // Chercher les notes N3 rattachées à cette N2
                const competencesN3Enfant = competencesN3.filter(c3 => c3.parent_code === codeCompetence)
                competencesN3Enfant.forEach(compN3 => {
                    const notesN3 = notes.filter(note => 
                        note.eleve_id === eleveid && 
                        note.competence_code === compN3.code
                    )
                    
                    notesN3.forEach(noteN3 => {
                        let pointsNote = 0
                        switch(noteN3.couleur.toLowerCase()) {
                            case 'rouge': pointsNote = 5; break
                            case 'jaune': pointsNote = 10; break
                            case 'bleu': pointsNote = 15; break
                            case 'vert': pointsNote = 20; break
                            default: pointsNote = 0
                        }
                        
                        if (pointsNote > 0) {
                            totalPoints += pointsNote
                            totalContributions += 1
                        }
                    })
                })
                
                // Chercher les notes N1 du parent à distiller
                const codeParentN1 = parts[0] // ex: C01
                const competenceParentN1 = competencesN1N2.find(comp => comp.code === codeParentN1)
                
                if (competenceParentN1) {
                    // Chercher les notes N1 du parent
                    const notesN1Parent = notes.filter(note => 
                        note.eleve_id === eleveid && 
                        note.competence_code === codeParentN1
                    )
                    
                    // Distiller les notes N1 sur cette N2 (répartition équitable)
                    const nombreEnfantsN2 = competenceParentN1.enfants.length
                    
                    notesN1Parent.forEach(noteN1 => {
                        let pointsNote = 0
                        switch(noteN1.couleur.toLowerCase()) {
                            case 'rouge': pointsNote = 5; break
                            case 'jaune': pointsNote = 10; break
                            case 'bleu': pointsNote = 15; break
                            case 'vert': pointsNote = 20; break
                            default: pointsNote = 0
                        }
                        
                        if (pointsNote > 0) {
                            // Chaque note N1 est répartie équitablement sur tous les enfants N2
                            totalPoints += pointsNote / nombreEnfantsN2
                            totalContributions += 1 / nombreEnfantsN2
                        }
                    })
                }
            }
            
            if (totalContributions === 0) return null
            
            const moyennePoints = totalPoints / totalContributions
            
            // Conversion de la moyenne de points en couleur de positionnement
            if (moyennePoints >= 17.5) return 'vert'
            else if (moyennePoints >= 12.5) return 'bleu'
            else if (moyennePoints >= 7.5) return 'jaune'
            else return 'rouge'
        }
    }

    // Fonction principale pour calculer le positionnement (priorise le positionnement enseignant)
    const calculerPositionnement = (codeCompetence, eleveid) => {
        // D'abord, vérifier s'il y a un positionnement enseignant manuel
        const positionnementManuel = getPositionnementEnseignant(eleveid, codeCompetence)
        if (positionnementManuel) {
            return positionnementManuel
        }
        
        // Sinon, utiliser le calcul automatique
        return calculerPositionnementAuto(codeCompetence, eleveid)
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

    // Fonction pour organiser les compétences par bloc
    const organiserParBloc = (competencesData) => {
        const parBloc = {}
        
        competencesData.forEach(competence => {
            competence.enfants.forEach(enfant => {
                const bloc = enfant.bloc
                if (!parBloc[bloc]) {
                    parBloc[bloc] = []
                }
                parBloc[bloc].push({
                    ...enfant,
                    parent: competence
                })
            })
        })
        
        return parBloc
    }

    // Fonction pour obtenir le nom du bloc
    const getNomBloc = (numeroBloc) => {
        switch(numeroBloc) {
            case 1: return 'Bloc 1 - Étude et conception de réseaux informatiques'
            case 2: return 'Bloc 2 - Exploitation et maintenance de réseaux informatiques'
            case 3: return 'Bloc 3 - Valorisation de la donnée et cybersécurité'
            default: return `Bloc ${numeroBloc}`
        }
    }

    // Fonction pour calculer le bilan d'un bloc avec moyenne pondérée
    const calculerBilanBloc = (numeroBloc, eleveId) => {
        const competencesParBloc = organiserParBloc(competencesN1N2)
        const competencesBloc = competencesParBloc[numeroBloc] || []
        
        if (competencesBloc.length === 0) return null
        
        // Grouper les compétences N2 par leur parent N1
        const competencesParParent = {}
        competencesBloc.forEach(competence => {
            const parentCode = competence.parent.code
            if (!competencesParParent[parentCode]) {
                competencesParParent[parentCode] = {
                    parent: competence.parent,
                    enfants: []
                }
            }
            competencesParParent[parentCode].enfants.push(competence)
        })
        
        let totalPoints = 0
        let totalPoids = 0
        let nombreCompetences = 0
        
        // Pour chaque compétence N1 du bloc, utiliser le calcul pondéré
        Object.values(competencesParParent).forEach(groupe => {
            const parentCode = groupe.parent.code
            const positionnementPondere = calculerPositionnementPondere(parentCode, eleveId)
            
            if (positionnementPondere) {
                // Convertir la couleur en points
                let pointsCompetence = 0
                switch(positionnementPondere.toLowerCase()) {
                    case 'rouge': pointsCompetence = 5; break
                    case 'jaune': pointsCompetence = 10; break
                    case 'bleu': pointsCompetence = 15; break
                    case 'vert': pointsCompetence = 20; break
                    default: pointsCompetence = 0
                }
                
                if (pointsCompetence > 0) {
                    // Pour le bilan de bloc, on peut donner un poids égal à chaque compétence N1
                    // ou utiliser la somme des poids de ses enfants N2
                    const poidsCompetence = groupe.enfants.reduce((sum, enfant) => sum + enfant.poid, 0)
                    
                    totalPoints += pointsCompetence * poidsCompetence
                    totalPoids += poidsCompetence
                    nombreCompetences++
                }
            }
        })
        
        if (nombreCompetences === 0 || totalPoids === 0) return null
        
        const moyennePonderee = totalPoints / totalPoids
        
        // Conversion de la moyenne pondérée en couleur
        if (moyennePonderee >= 17.5) return { couleur: 'vert', moyenne: moyennePonderee }
        if (moyennePonderee >= 12.5) return { couleur: 'bleu', moyenne: moyennePonderee }
        if (moyennePonderee >= 7.5) return { couleur: 'jaune', moyenne: moyennePonderee }
        return { couleur: 'rouge', moyenne: moyennePonderee }
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
            
            {/* Si mode vue d'ensemble, organiser par élève avec leurs blocs */}
            {!codeCompetence ? (
                eleves.map(eleve => {
                    const hierarchie = organiserNotesParHierarchie(eleve.id)
                    const lignes = genererLignesTableauAvecBilan(hierarchie, eleve.id, true) // Mode complet activé
                    
                    // En mode complet, on affiche toujours l'élève même sans notes
                    
                    // Organiser les lignes par bloc
                    const competencesParBloc = organiserParBloc(competencesN1N2)
                    const blocsOrdonnes = Object.keys(competencesParBloc).sort((a, b) => parseInt(a) - parseInt(b))
                    
                    return (
                        <div key={eleve.id} className="eleve-card">
                            <div className="eleve-header">
                                <div className="eleve-info">
                                   
                                        <img
                                            src={`/${eleve.photo}`}
                                            alt={eleve.prenom}
                                            className="photo-eleve"
                                            onError={(e) => {
                                                e.target.onerror = null
                                                e.target.src = '/default.jpg'
                                            }}
                                        />
                                    
                                    <div>
                                        <h3>{eleve.prenom} {eleve.nom}</h3>
                                        <p>Classe: {getNomClasse(eleve.classe_id)}</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Afficher les 3 blocs pour cet élève */}
                            {blocsOrdonnes.map(numeroBloc => {
                                // Filtrer les lignes pour ce bloc
                                const lignesBloc = lignes.filter(ligne => {
                                    if (ligne.estBilan) {
                                        // Vérifier si le bilan appartient à ce bloc
                                        const competenceParent = competencesN1N2.find(c => c.code === ligne.codeCompetence)
                                        return competenceParent?.enfants.some(enfant => enfant.bloc === parseInt(numeroBloc))
                                    }
                                    
                                    // Utiliser la référence competence pour vérifier le bloc
                                    if (ligne.competence) {
                                        return ligne.competence.bloc === parseInt(numeroBloc)
                                    }
                                    
                                    if (ligne.niveau3) {
                                        // Vérifier si la compétence niveau 3 appartient à ce bloc
                                        // Trouver la compétence niveau 2 parent
                                        const codeNiveau2 = ligne.niveau3.code.split('.').slice(0, 2).join('.')
                                        return competencesParBloc[numeroBloc].some(comp => comp.code === codeNiveau2)
                                    }
                                    
                                    if (ligne.niveau2) {
                                        // Vérifier si la compétence niveau 2 appartient à ce bloc
                                        return competencesParBloc[numeroBloc].some(comp => comp.code === ligne.niveau2.code)
                                    }
                                    
                                    if (ligne.niveau1) {
                                        // Vérifier si le niveau 1 a des enfants dans ce bloc
                                        const competenceParent = competencesN1N2.find(c => c.code === ligne.niveau1.code)
                                        return competenceParent?.enfants.some(enfant => enfant.bloc === parseInt(numeroBloc))
                                    }
                                    
                                    return false
                                })
                                
                                if (lignesBloc.length === 0) {
                                    // Afficher un bloc vide si pas de notes
                                    return (
                                        <div key={numeroBloc} className="bloc-section-eleve" >
                                            <h4 className={`bloc-titre-eleve bloc-titre-eleve${parseInt(numeroBloc)}`}>{getNomBloc(parseInt(numeroBloc))}</h4>
                                            <div className="aucune-note-bloc">
                                                <em>Aucune évaluation pour ce bloc</em>
                                            </div>
                                        </div>
                                    )
                                }
                                
                                return (
                                    <div key={numeroBloc} className="bloc-section-eleve">
                                        <h4 className={`bloc-titre-eleve bloc-titre-eleve${parseInt(numeroBloc)}`}>{getNomBloc(parseInt(numeroBloc))}</h4>

                                        <table className="tableau-hierarchique">
                                            <thead>
                                                <tr>
                                                    <th>Compétence principale</th>
                                                    <th>Sous-compétence</th>
                                                    <th>Critères d'évaluations</th>
                                                    <th>Evaluations</th>
                                                    <th>Positionnement Enseignant</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Afficher les lignes normales (sans les bilans par compétence) */}
                                                {lignesBloc.filter(ligne => !ligne.estBilan).map((ligne, index) => (
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
                                                            {ligne.notes.length > 0 ? (
                                                                ligne.notes.map((note, i) => (
                                                                    <NotePastille key={i} note={note} onClick={setNoteDetail} />
                                                                ))
                                                            ) : (
                                                                // Afficher pastille grise seulement pour niveau 1 et 2, pas pour niveau 3
                                                                ligne.niveau3 ? null : (
                                                                    <div 
                                                                        style={{
                                                                            display: 'inline-block',
                                                                            width: '20px',
                                                                            height: '20px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: '#cccccc',
                                                                            border: '2px solid #999',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                        title="Non évalué - Cliquer pour évaluer"
                                                                        onClick={() => {
                                                                            if (ligne.niveau2) {
                                                                                handleClickEleve(eleve)
                                                                            }
                                                                        }}
                                                                    ></div>
                                                                )
                                                            )}
                                                        </td>
                                                        <td className="cell-positionnement">
                                                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', justifyContent: 'center' }}>
                                                                {/* Pastille automatique seulement pour les compétences N2 */}
                                                                {ligne.niveau2?.code && (
                                                                    <div 
                                                                        style={{
                                                                            display: 'inline-block',
                                                                            width: '20px',
                                                                            height: '20px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: getCouleurCss(ligne.positionnementAuto || 'Gris'),
                                                                            border: '2px solid #333',
                                                                            cursor: 'pointer',
                                                                            position: 'relative',
                                                                            fontSize: '10px',
                                                                            color: 'white',
                                                                            fontWeight: 'bold',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                        title={`Positionnement automatique: ${ligne.positionnementAuto || 'Non évalué'}`}
                                                                    >
                                                                        A
                                                                    </div>
                                                                )}
                                                                
                                                                {/* Pastille enseignant si elle existe ET si c'est une compétence N2 */}
                                                                {ligne.positionnementEnseignant && ligne.niveau2?.code ? (
                                                                    <div 
                                                                        style={{
                                                                            display: 'inline-block',
                                                                            width: '20px',
                                                                            height: '20px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: getCouleurCss(ligne.positionnementEnseignant),
                                                                            border: '2px solid #333',
                                                                            cursor: 'pointer',
                                                                            fontSize: '10px',
                                                                            color: 'white',
                                                                            fontWeight: 'bold',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                        title={`Positionnement enseignant: ${ligne.positionnementEnseignant}`}
                                                                        onClick={() => {
                                                                            // Le positionnement enseignant n'est disponible que pour les compétences N2
                                                                            const codeCompetence = ligne.niveau2?.code
                                                                            if (codeCompetence) {
                                                                                handleClickPositionnement(eleve, codeCompetence)
                                                                            }
                                                                        }}
                                                                    >
                                                                        E
                                                                    </div>
                                                                ) : (
                                                                    // Bouton pour créer un positionnement enseignant (seulement pour N2)
                                                                    ligne.niveau2?.code && (
                                                                        <button 
                                                                            className="btn-positionner"
                                                                            style={{marginLeft: '5px'}}
                                                                            title="Cliquer pour définir un positionnement enseignant"
                                                                            onClick={() => {
                                                                                handleClickPositionnement(eleve, ligne.niveau2.code)
                                                                            }}
                                                                        >
                                                                            + Positionner
                                                                        </button>
                                                                    )
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                
                                                {/* Ajouter le bilan du bloc */}
                                                {(() => {
                                                    const bilanBloc = calculerBilanBloc(parseInt(numeroBloc), eleve.id)
                                                    if (!bilanBloc) return null
                                                    
                                                    return (
                                                        <tr key="bilan-bloc" 
                                                            className={`bloc-section-bilan bloc-section-bilan${parseInt(numeroBloc)}`}>
                                                           
                                                            <td className="cell-niveau1"></td>
                                                            <td className="cell-niveau2"></td>
                                                            <td className="cell-niveau3">
                                                                <div style={{ fontStyle: 'italic', color: '#667eea', fontWeight: 'bold' }}>
                                                                    <strong>🏆 BILAN {getNomBloc(parseInt(numeroBloc))}</strong>
                                                                </div>
                                                            </td>
                                                            <td className="cell-notes-hierarchique">
                                                                <span style={{ fontSize: '0.85em', color: '#667eea', fontWeight: 'bold' }}>
                                                                    Moyenne: {bilanBloc.moyenne.toFixed(1)}/20
                                                                </span>
                                                            </td>
                                                            <td className="cell-positionnement">
                                                                <div 
                                                                    style={{
                                                                        display: 'inline-block',
                                                                        width: '24px',
                                                                        height: '24px',
                                                                        borderRadius: '50%',
                                                                        backgroundColor: getCouleurCss(bilanBloc.couleur),
                                                                        border: '3px solid #667eea',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    title={`Positionnement bloc: ${bilanBloc.couleur} (${bilanBloc.moyenne.toFixed(1)}/20)`}
                                                                ></div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            })}
                        </div>
                    )
                })
            ) : (
                /* Mode compétence spécifique - affichage classique */
                eleves.map(eleve => {
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
                                    + Evaluer
                                </button>
                            </div>
                            <div className="aucune-note">
                                <em>Aucune évaluation pour cette compétence</em>
                            </div>
                        </div>
                    )
                }
                
                if (lignes.length === 0) return null // En mode vue d'ensemble, ne pas afficher les élèves sans notes

                return (
                    <div key={eleve.id} className="eleve-card">
                        <div className="eleve-header">
                            <div className="eleve-info">
                                {eleve && (
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
                                + Evaluer
                            </button>
                        </div>
                        
                        <table className="tableau-hierarchique">
                            <thead>
                                <tr>
                                    <th>Compétence principale</th>
                                    <th>Sous-compétence</th>
                                    <th>Critères d'évaluations spécifiques</th>
                                    <th>Evaluations</th>
                                    <th>Positionnement Enseignant</th>
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
                                                    <span style={{ fontSize: '0.9em', color: '#666', fontStyle: 'italic' }}>
                                                        Bilan de la compétence
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
                                            {ligne.notes.length > 0 ? (
                                                ligne.notes.map((note, i) => (
                                                    <NotePastille key={i} note={note} onClick={setNoteDetail} />
                                                ))
                                            ) : (
                                                // Afficher pastille grise seulement pour niveau 1 et 2, pas pour niveau 3
                                                ligne.niveau3 ? null : (
                                                    <div 
                                                        style={{
                                                            display: 'inline-block',
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#cccccc',
                                                            border: '2px solid #999',
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Non évalué - Cliquer pour évaluer"
                                                        onClick={() => {
                                                            if (ligne.niveau2) {
                                                                handleClickEleve(eleve)
                                                            }
                                                        }}
                                                    ></div>
                                                )
                                            )}
                                        </td>
                                        <td className="cell-positionnement">
                                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', justifyContent: 'center' }}>
                                                {/* Pastille automatique seulement pour les compétences N2 */}
                                                {ligne.niveau2?.code && (
                                                    <div 
                                                        style={{
                                                            display: 'inline-block',
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            backgroundColor: getCouleurCss(ligne.positionnementAuto || 'Gris'),
                                                            border: '2px solid #333',
                                                            cursor: 'pointer',
                                                            position: 'relative',
                                                            fontSize: '10px',
                                                            color: 'white',
                                                            fontWeight: 'bold',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        title={`Positionnement automatique: ${ligne.positionnementAuto || 'Non évalué'}`}
                                                    >
                                                        A
                                                    </div>
                                                )}
                                                
                                                {/* Pastille enseignant si elle existe ET si c'est une compétence N2 */}
                                                {ligne.positionnementEnseignant && ligne.niveau2?.code ? (
                                                    <div 
                                                        style={{
                                                            display: 'inline-block',
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            backgroundColor: getCouleurCss(ligne.positionnementEnseignant),
                                                            border: '2px solid #333',
                                                            cursor: 'pointer',
                                                            fontSize: '10px',
                                                            color: 'white',
                                                            fontWeight: 'bold',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        title={`Positionnement enseignant: ${ligne.positionnementEnseignant}`}
                                                        onClick={() => {
                                                            // Le positionnement enseignant n'est disponible que pour les compétences N2
                                                            const codeCompetence = ligne.niveau2?.code
                                                            if (codeCompetence) {
                                                                handleClickPositionnement(eleve, codeCompetence)
                                                            }
                                                        }}
                                                    >
                                                        E
                                                    </div>
                                                ) : (
                                                    // En mode filtré, pas de positionnement manuel
                                                    null
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            }))}

            {modalOuvert && eleveActuel && (
                <ColorPickerModal
                    eleve={eleveActuel}
                    competenceCode={codeCompetence}
                    onClose={() => setModalOuvert(false)}
                    onSave={handleSaveNote}
                    ajouterNote={(note) => setNotes(prev => [...prev, note])}
                />
            )}

            {modalPositionnementOuvert && elevePositionnement && competencePositionnement && (
                <PositionnementModal
                    eleve={elevePositionnement}
                    competenceCode={competencePositionnement}
                    competenceNom={getNomCompetence(competencePositionnement)}
                    positionnementActuel={getPositionnementEnseignant(elevePositionnement.id, competencePositionnement)}
                    onClose={() => {
                        setModalPositionnementOuvert(false)
                        setElevePositionnement(null)
                        setCompetencePositionnement(null)
                    }}
                    onSave={handleSavePositionnement}
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