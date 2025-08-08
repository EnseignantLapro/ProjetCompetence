import { useState, useEffect } from 'react'

function AdminEleve({ classe }) {
    const [eleves, setEleves] = useState([])
    const [nouvelEleve, setNouvelEleve] = useState({
        nom: '',
        prenom: '',
        id_moodle: '',
        photo: 'default.jpg'
    })
    const [eleveEnEdition, setEleveEnEdition] = useState(null)
    const [loading, setLoading] = useState(false)

    // Charger les élèves de la classe avec les comptes de notes/positionnements
    const chargerEleves = async () => {
        try {
            setLoading(true)
            const response = await fetch(`http://${window.location.hostname}:3001/eleves/with-counts?classe_id=${classe.id}`)
            if (response.ok) {
                const data = await response.json()
                setEleves(data)
            }
        } catch (error) {
            console.error('Erreur lors du chargement des élèves:', error)
            alert('Erreur lors du chargement des élèves')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (classe) {
            chargerEleves()
        }
    }, [classe])

    // Ajouter un nouvel élève
    const ajouterEleve = async (e) => {
        e.preventDefault()
        if (!nouvelEleve.nom.trim() || !nouvelEleve.prenom.trim()) {
            alert('Le nom et le prénom sont requis')
            return
        }

        try {
            const response = await fetch(`http://${window.location.hostname}:3001/eleves`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...nouvelEleve,
                    classe_id: classe.id,
                    moodle_id: nouvelEleve.id_moodle || null
                })
            })

            if (response.ok) {
                setNouvelEleve({ nom: '', prenom: '', id_moodle: '', photo: 'default.jpg' })
                chargerEleves()
                alert('Élève ajouté avec succès')
            } else {
                alert('Erreur lors de l\'ajout de l\'élève')
            }
        } catch (error) {
            console.error('Erreur:', error)
            alert('Erreur lors de l\'ajout de l\'élève')
        }
    }

    // Modifier un élève
    const modifierEleve = async (e) => {
        e.preventDefault()
        if (!eleveEnEdition.nom.trim() || !eleveEnEdition.prenom.trim()) {
            alert('Le nom et le prénom sont requis')
            return
        }

        try {
            const response = await fetch(`http://${window.location.hostname}:3001/eleves/${eleveEnEdition.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...eleveEnEdition,
                    classe_id: classe.id,
                    moodle_id: eleveEnEdition.id_moodle || null
                })
            })

            if (response.ok) {
                setEleveEnEdition(null)
                chargerEleves()
                alert('Élève modifié avec succès')
            } else {
                alert('Erreur lors de la modification de l\'élève')
            }
        } catch (error) {
            console.error('Erreur:', error)
            alert('Erreur lors de la modification de l\'élève')
        }
    }

    // Supprimer un élève
    const supprimerEleve = async (eleve) => {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer l'élève ${eleve.prenom} ${eleve.nom} ?`)) {
            return
        }

        try {
            // Tentative de suppression normale
            const response = await fetch(`http://${window.location.hostname}:3001/eleves/${eleve.id}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                const data = await response.json()
                chargerEleves()
                alert(data.message || 'Élève supprimé avec succès')
            } else if (response.status === 400) {
                // L'élève a des notes/positionnements
                const errorData = await response.json()
                const forceDelete = confirm(
                    `${errorData.message}\n\n` +
                    `⚠️ ATTENTION : Si vous continuez, toutes les données de cet élève seront définitivement supprimées !\n\n` +
                    `Détails :\n` +
                    `• ${errorData.notesCount} note(s)\n` +
                    `• ${errorData.positionnementsCount} positionnement(s)\n\n` +
                    `Voulez-vous vraiment supprimer ${eleve.prenom} ${eleve.nom} ET toutes ses données ?`
                )
                
                if (forceDelete) {
                    // Suppression forcée
                    const forceResponse = await fetch(`http://${window.location.hostname}:3001/eleves/${eleve.id}?forceDelete=true`, {
                        method: 'DELETE'
                    })
                    
                    if (forceResponse.ok) {
                        const forceData = await forceResponse.json()
                        chargerEleves()
                        alert(`✅ ${forceData.message}`)
                    } else {
                        alert('Erreur lors de la suppression forcée')
                    }
                }
            } else {
                alert('Erreur lors de la suppression de l\'élève')
            }
        } catch (error) {
            console.error('Erreur:', error)
            alert('Erreur de connexion lors de la suppression')
        }
    }

    // Commencer l'édition d'un élève
    const commencerEdition = (eleve) => {
        setEleveEnEdition({
            ...eleve,
            id_moodle: eleve.id_moodle || ''
        })
    }

    // Annuler l'édition
    const annulerEdition = () => {
        setEleveEnEdition(null)
    }

    if (!classe) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>Sélectionnez une classe pour gérer les élèves</h3>
            </div>
        )
    }

    return (
        <div style={{ padding: '20px' }}>
            <h2>Gestion des élèves - {classe.nom}</h2>
            
            {/* Formulaire d'ajout */}
            <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '20px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                border: '1px solid #dee2e6'
            }}>
                <h3>Ajouter un nouvel élève</h3>
                <form onSubmit={ajouterEleve} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label>Nom *</label>
                        <input
                            type="text"
                            value={nouvelEleve.nom}
                            onChange={(e) => setNouvelEleve({ ...nouvelEleve, nom: e.target.value })}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label>Prénom *</label>
                        <input
                            type="text"
                            value={nouvelEleve.prenom}
                            onChange={(e) => setNouvelEleve({ ...nouvelEleve, prenom: e.target.value })}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label>ID Moodle</label>
                        <input
                            type="number"
                            value={nouvelEleve.id_moodle}
                            onChange={(e) => setNouvelEleve({ ...nouvelEleve, id_moodle: e.target.value })}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label>Photo</label>
                        <input
                            type="text"
                            value={nouvelEleve.photo}
                            onChange={(e) => setNouvelEleve({ ...nouvelEleve, photo: e.target.value })}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                            placeholder="nom_fichier.jpg"
                        />
                    </div>
                    <button 
                        type="submit"
                        style={{
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Ajouter
                    </button>
                </form>
            </div>

            {/* Liste des élèves */}
            <div>
                <h3>Liste des élèves ({eleves.length})</h3>
                {loading ? (
                    <p>Chargement...</p>
                ) : eleves.length === 0 ? (
                    <p style={{ fontStyle: 'italic', color: '#666' }}>Aucun élève dans cette classe</p>
                ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {eleves.map(eleve => (
                            <div key={eleve.id} style={{ 
                                border: '1px solid #ddd', 
                                borderRadius: '8px', 
                                padding: '15px',
                                backgroundColor: eleveEnEdition?.id === eleve.id ? '#fff3cd' : 'white'
                            }}>
                                {eleveEnEdition?.id === eleve.id ? (
                                    // Mode édition
                                    <form onSubmit={modifierEleve} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <img 
                                                src={`/${eleveEnEdition.photo || 'default.jpg'}`} 
                                                alt={`${eleveEnEdition.prenom} ${eleveEnEdition.nom}`}
                                                style={{ 
                                                    width: '40px', 
                                                    height: '40px', 
                                                    borderRadius: '50%', 
                                                    objectFit: 'cover',
                                                    border: '2px solid #ddd'
                                                }}
                                                onError={(e) => {
                                                    e.target.src = '/default.jpg'
                                                }}
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value={eleveEnEdition.nom}
                                            onChange={(e) => setEleveEnEdition({ ...eleveEnEdition, nom: e.target.value })}
                                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '100px' }}
                                            placeholder="Nom"
                                            required
                                        />
                                        <input
                                            type="text"
                                            value={eleveEnEdition.prenom}
                                            onChange={(e) => setEleveEnEdition({ ...eleveEnEdition, prenom: e.target.value })}
                                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '100px' }}
                                            placeholder="Prénom"
                                            required
                                        />
                                        <input
                                            type="number"
                                            value={eleveEnEdition.id_moodle}
                                            onChange={(e) => setEleveEnEdition({ ...eleveEnEdition, id_moodle: e.target.value })}
                                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', width: '100px' }}
                                            placeholder="ID Moodle"
                                        />
                                        <input
                                            type="text"
                                            value={eleveEnEdition.photo}
                                            onChange={(e) => setEleveEnEdition({ ...eleveEnEdition, photo: e.target.value })}
                                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '120px' }}
                                            placeholder="Photo"
                                        />
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button 
                                                type="submit"
                                                style={{
                                                    backgroundColor: '#28a745',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px'
                                                }}
                                            >
                                                Sauvegarder
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={annulerEdition}
                                                style={{
                                                    backgroundColor: '#6c757d',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px'
                                                }}
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    // Mode affichage
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <img 
                                                src={`/${eleve.photo || 'default.jpg'}`} 
                                                alt={`${eleve.prenom} ${eleve.nom}`}
                                                style={{ 
                                                    width: '50px', 
                                                    height: '50px', 
                                                    borderRadius: '50%', 
                                                    objectFit: 'cover',
                                                    border: '2px solid #ddd'
                                                }}
                                                onError={(e) => {
                                                    e.target.src = '/default.jpg'
                                                }}
                                            />
                                            <div>
                                                <h4 style={{ margin: '0', color: '#333' }}>
                                                    {eleve.prenom} {eleve.nom}
                                                </h4>
                                                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                                                    {eleve.id_moodle && <span>ID Moodle: {eleve.id_moodle} • </span>}
                                                    <span>Photo: {eleve.photo || 'default.jpg'}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                                    <span style={{ 
                                                        backgroundColor: eleve.notes_count > 0 ? '#28a745' : '#6c757d', 
                                                        color: 'white', 
                                                        padding: '2px 6px', 
                                                        borderRadius: '10px', 
                                                        fontSize: '11px',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {eleve.notes_count} note{eleve.notes_count !== 1 ? 's' : ''}
                                                    </span>
                                                    <span style={{ 
                                                        backgroundColor: eleve.positionnements_count > 0 ? '#17a2b8' : '#6c757d', 
                                                        color: 'white', 
                                                        padding: '2px 6px', 
                                                        borderRadius: '10px', 
                                                        fontSize: '11px',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {eleve.positionnements_count} positionnement{eleve.positionnements_count !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button 
                                                onClick={() => commencerEdition(eleve)}
                                                style={{
                                                    backgroundColor: '#007bff',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 16px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px'
                                                }}
                                            >
                                                Modifier
                                            </button>
                                            <button 
                                                onClick={() => supprimerEleve(eleve)}
                                                style={{
                                                    backgroundColor: eleve.total_data_count > 0 ? '#fd7e14' : '#dc3545',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 16px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px'
                                                }}
                                                title={eleve.total_data_count > 0 ? `Attention: ${eleve.total_data_count} donnée(s) liée(s) à cet élève` : 'Supprimer l\'élève'}
                                            >
                                                Supprimer
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default AdminEleve
