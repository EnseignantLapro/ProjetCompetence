import { useState, useEffect } from 'react'

function AdminEleve({ classe }) {
    const [eleves, setEleves] = useState([])
    const [nouvelEleve, setNouvelEleve] = useState({
        nom: '',
        prenom: '',
        id_moodle: '',
        photo: 'default.jpg',
        token: ''
    })
    const [eleveEnEdition, setEleveEnEdition] = useState(null)
    const [loading, setLoading] = useState(false)
    const [csvFile, setCsvFile] = useState(null)
    
    // États pour les sections collapsibles
    const [importSectionVisible, setImportSectionVisible] = useState(false)
    const [exportSectionVisible, setExportSectionVisible] = useState(false)

    // Composant bouton sandwich
    const BoutonSandwich = ({ onClick, isOpen }) => (
        <button
            onClick={onClick}
            style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                width: '32px',
                height: '32px',
                transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            title={isOpen ? 'Masquer la section' : 'Afficher la section'}
        >
            <div style={{ 
                width: '20px', 
                height: '3px', 
                backgroundColor: '#666', 
                borderRadius: '1px',
                transform: isOpen ? 'rotate(45deg) translateY(6px)' : 'none',
                transition: 'transform 0.2s'
            }}></div>
            <div style={{ 
                width: '20px', 
                height: '3px', 
                backgroundColor: '#666', 
                borderRadius: '1px',
                opacity: isOpen ? 0 : 1,
                transition: 'opacity 0.2s'
            }}></div>
            <div style={{ 
                width: '20px', 
                height: '3px', 
                backgroundColor: '#666', 
                borderRadius: '1px',
                transform: isOpen ? 'rotate(-45deg) translateY(-6px)' : 'none',
                transition: 'transform 0.2s'
            }}></div>
        </button>
    )

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

    // Fonction pour gérer correctement les URLs de photos
    const getPhotoUrl = (photoPath) => {
        if (!photoPath) return '/default.jpg'
        
        // Si c'est déjà une URL complète (http:// ou https://), la retourner telle quelle
        if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
            return photoPath
        }
        
        // Sinon, c'est un chemin relatif, ajouter le / devant
        return `/${photoPath}`
    }

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
                    moodle_id: nouvelEleve.id_moodle || null,
                    token: nouvelEleve.token || undefined // Laisser undefined pour génération auto
                })
            })

            if (response.ok) {
                setNouvelEleve({ nom: '', prenom: '', id_moodle: '', photo: 'default.jpg', token: '' })
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

    // Régénérer le token d'un élève
    const regenererToken = async (eleve) => {
        if (!confirm(`Êtes-vous sûr de vouloir régénérer le token de ${eleve.prenom} ${eleve.nom} ?\n\nL'ancien token ne fonctionnera plus !`)) {
            return
        }

        try {
            const response = await fetch(`http://${window.location.hostname}:3001/eleves/${eleve.id}/regenerate-token`, {
                method: 'POST'
            })

            if (response.ok) {
                const data = await response.json()
                chargerEleves() // Recharger la liste pour afficher le nouveau token
                alert(`Token régénéré avec succès !\nNouveau token : ${data.token}`)
            } else {
                alert('Erreur lors de la régénération du token')
            }
        } catch (error) {
            console.error('Erreur:', error)
            alert('Erreur de connexion lors de la régénération du token')
        }
    }

    // Fonctions pour l'import CSV
    const handleCSVChange = (e) => {
        setCsvFile(e.target.files[0])
    }

    const handleCSVUpload = () => {
        if (!csvFile) {
            alert('Sélectionnez un fichier CSV.')
            return
        }

        const reader = new FileReader()
        reader.onload = async (e) => {
            try {
                const lines = e.target.result.split('\n').filter(l => l.trim() !== '')
                let successCount = 0
                let errorCount = 0
                
                // Parcourir les lignes (en sautant l'en-tête ligne 0)
                for (let i = 1; i < lines.length; i++) {
                    const [id_moodle, prenom, nom] = lines[i].split(',').map(s => s.trim())
                    if (!id_moodle || !prenom || !nom) {
                        console.log(`Ligne ${i+1} ignorée: données manquantes`)
                        errorCount++
                        continue
                    }

                    try {
                        const response = await fetch(`http://${window.location.hostname}:3001/eleves`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                nom,
                                prenom,
                                id_moodle: id_moodle,
                                classe_id: classe.id
                            })
                        })
                        
                        if (response.ok) {
                            successCount++
                        } else {
                            console.error(`Erreur ligne ${i+1}:`, await response.text())
                            errorCount++
                        }
                    } catch (error) {
                        console.error(`Erreur ligne ${i+1}:`, error)
                        errorCount++
                    }
                }

                alert(`Import terminé ! ${successCount} élèves ajoutés, ${errorCount} erreurs.`)
                // Réinitialiser les champs
                setCsvFile(null)
                document.querySelector('input[type="file"]').value = ''
                // Recharger la liste des élèves
                chargerEleves()
            } catch (error) {
                console.error('Erreur lors de la lecture du fichier:', error)
                alert('Erreur lors de la lecture du fichier CSV')
            }
        }
        reader.readAsText(csvFile)
    }

    // Fonction pour exporter les élèves en CSV
    const exporterElevesCSV = () => {
        if (!classe || !eleves || eleves.length === 0) {
            alert('Aucun élève à exporter dans cette classe')
            return
        }

        try {
            // Créer les en-têtes CSV
            const headers = ['id_moodle', 'prenom', 'nom']
            
            // Créer les lignes de données
            const csvLines = [headers.join(',')]
            
            eleves.forEach(eleve => {
                const ligne = [
                    eleve.id_moodle || '',
                    eleve.prenom || '',
                    eleve.nom || ''
                ]
                csvLines.push(ligne.join(','))
            })

            // Créer et télécharger le fichier
            const csvContent = csvLines.join('\n')
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob)
                link.setAttribute('href', url)
                link.setAttribute('download', `eleves_${classe.nom.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
                link.style.visibility = 'hidden'
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                
                alert(`Export terminé ! Fichier téléchargé : eleves_${classe.nom.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
            }
        } catch (error) {
            console.error('Erreur lors de l\'export:', error)
            alert('Erreur lors de l\'export des élèves')
        }
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
            <h2>Gestion des élèves de la classe {classe.nom}</h2>
            
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
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label>Token (optionnel)</label>
                        <input
                            type="text"
                            value={nouvelEleve.token}
                            onChange={(e) => setNouvelEleve({ ...nouvelEleve, token: e.target.value })}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                            placeholder="Auto-généré si vide"
                            title="Laissez vide pour génération automatique"
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

            {/* Section Import CSV */}
            <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '20px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                border: '1px solid #dee2e6'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: importSectionVisible ? '15px' : '0' }}>
                    <h3 style={{ margin: 0 }}>Import des élèves par CSV</h3>
                    <BoutonSandwich 
                        onClick={() => setImportSectionVisible(!importSectionVisible)}
                        isOpen={importSectionVisible}
                    />
                </div>
                
                {importSectionVisible && (
                    <>
                        <div style={{ marginBottom: '15px' }}>
                            <input 
                                type="file" 
                                accept=".csv" 
                                onChange={handleCSVChange} 
                                style={{ marginBottom: '10px' }}
                            />
                            <br />
                            <button 
                                onClick={handleCSVUpload} 
                                disabled={!csvFile}
                                style={{
                                    backgroundColor: !csvFile ? '#6c757d' : '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '4px',
                                    cursor: !csvFile ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Importer le CSV
                            </button>
                        </div>
                        
                        <div style={{ 
                            backgroundColor: '#fff3cd', 
                            padding: '10px', 
                            borderRadius: '4px',
                            border: '1px solid #ffeaa7'
                        }}>
                            <h4>Format attendu du fichier CSV :</h4>
                            <code style={{ 
                                backgroundColor: '#e9ecef', 
                                padding: '10px', 
                                display: 'block', 
                                borderRadius: '4px',
                                fontFamily: 'monospace',
                                fontSize: '12px'
                            }}>
                                id_moodle,prenom,nom<br />
                                12345,Jean,Dupont<br />
                                67890,Marie,Martin
                            </code>
                            <p style={{ marginTop: '10px', fontSize: '14px', color: '#6c757d' }}>
                                La première ligne doit contenir les en-têtes de colonnes.
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Section Export CSV */}
            <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '20px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                border: '1px solid #dee2e6'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: exportSectionVisible ? '15px' : '0' }}>
                    <h3 style={{ margin: 0 }}>Exporter les élèves en CSV</h3>
                    <BoutonSandwich 
                        onClick={() => setExportSectionVisible(!exportSectionVisible)}
                        isOpen={exportSectionVisible}
                    />
                </div>
                
                {exportSectionVisible && (
                    <>
                        <div style={{ marginBottom: '15px' }}>
                            <p style={{ marginBottom: '10px', color: '#6c757d' }}>
                                Téléchargez la liste des élèves de la classe au format CSV compatible avec l'import.
                            </p>
                            <button 
                                onClick={exporterElevesCSV} 
                                disabled={!eleves || eleves.length === 0}
                                style={{
                                    backgroundColor: !eleves || eleves.length === 0 ? '#6c757d' : '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '4px',
                                    cursor: !eleves || eleves.length === 0 ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}
                                title={!eleves || eleves.length === 0 ? 'Aucun élève dans cette classe' : 'Télécharger le fichier CSV'}
                            >
                                📥 Exporter les élèves CSV
                            </button>
                        </div>
                        
                        <div style={{ 
                            backgroundColor: '#d1ecf1', 
                            padding: '10px', 
                            borderRadius: '4px',
                            border: '1px solid #bee5eb'
                        }}>
                            <h4>Fichier généré :</h4>
                            <p style={{ marginTop: '5px', fontSize: '14px', color: '#0c5460' }}>
                                📄 <strong>eleves_[NomClasse]_[Date].csv</strong><br />
                                • Format identique à celui utilisé pour l'import<br />
                                • Contient tous les élèves de la classe avec leurs informations<br />
                                • Compatible pour import dans une autre classe
                            </p>
                        </div>
                    </>
                )}
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
                                                src={getPhotoUrl(eleveEnEdition.photo)} 
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
                                        <input
                                            type="text"
                                            value={eleveEnEdition.token || ''}
                                            onChange={(e) => setEleveEnEdition({ ...eleveEnEdition, token: e.target.value })}
                                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '150px' }}
                                            placeholder="Token"
                                            title="Token d'accès pour l'élève"
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
                                                src={getPhotoUrl(eleve.photo)} 
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
                                                    {eleve.token && <span> • Token: {eleve.token}</span>}
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
                                                onClick={() => regenererToken(eleve)}
                                                style={{
                                                    backgroundColor: '#6f42c1',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 16px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px'
                                                }}
                                                title="Régénérer le token d'accès pour cet élève"
                                            >
                                                🔄 Token
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
