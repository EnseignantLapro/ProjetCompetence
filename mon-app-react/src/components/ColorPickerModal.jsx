import './ColorPickerModal.css'
import { apiFetch } from '../utils/api'
import { useState, useEffect } from 'react'

const couleurs = [
  { code: 'rouge', label: 'Non acquis', hex: '#e74c3c' },
  { code: 'jaune', label: 'En progression', hex: '#f1c40f' },
  { code: 'bleu', label: 'Acquis', hex: '#3498db' },
  { code: 'vert', label: 'Maîtrisé', hex: '#2ecc71' },
]

function ColorPickerModal({ eleve, competenceCode, devoirs: devoirsProp = [], onClose, ajouterNote, teacherInfo }) {
  const [commentaire, setCommentaire] = useState('')
  const [devoirLabel, setDevoirLabel] = useState('')
  const [devoirExistant, setDevoirExistant] = useState('')
  const [devoirs, setDevoirs] = useState([])
  const [showDevoirInput, setShowDevoirInput] = useState(false)

  // Utiliser les devoirs passés en props au lieu de faire un appel API
  useEffect(() => {
    if (devoirsProp.length > 0) {
      // Dédoublonner les devoirs par devoirKey (au cas où)
      const devoirsMap = new Map()
      devoirsProp.forEach(devoir => {
        if (devoir && devoir.devoirKey) {
          const existant = devoirsMap.get(devoir.devoirKey)
          // Garder celui avec le label le plus long ou la date la plus récente
          if (!existant || 
              devoir.devoir_label.length > existant.devoir_label.length ||
              (devoir.devoir_label.length === existant.devoir_label.length && new Date(devoir.date) > new Date(existant.date))) {
            devoirsMap.set(devoir.devoirKey, devoir)
          }
        }
      })
      
      const devoirsUniques = Array.from(devoirsMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date))
      setDevoirs(devoirsUniques)
    } else {
      setDevoirs([])
    }
  }, [devoirsProp])

  const handleChoixCouleur = async (couleur) => {
    const note = {
      eleve_id: eleve.id,
      competence_code: competenceCode,
      couleur,
      date: new Date().toISOString(),
      prof_id: teacherInfo?.id || null,
      commentaire: commentaire.trim() || null
    }

    // Ajouter les informations de devoir si nécessaire
    if (devoirExistant) {
      // Utiliser un devoir existant
      const devoir = devoirs.find(d => d.devoirKey === devoirExistant)
      if (devoir) {
        note.devoirKey = devoir.devoirKey
        note.devoir_label = devoir.devoir_label
      }
    } else if (devoirLabel.trim()) {
      // Créer un nouveau devoir
      note.devoir_label = devoirLabel.trim()
      // La devoirKey sera générée côté serveur
    }

    const res = await apiFetch(`/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note)
    })

    const savedNote = await res.json()
    ajouterNote(savedNote)
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Noter {eleve.prenom} {eleve.nom}</h3>
        <p><strong>Compétence :</strong> {competenceCode}</p>
        
        {/* Champ commentaire/remédiation */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Commentaire / Remédiation (facultatif) :
          </label>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Ajouter un commentaire ou une remédiation..."
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Gestion des devoirs */}
        <div style={{ marginBottom: '1rem', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontWeight: 'bold', marginRight: '10px' }}>
              Associer à un devoir (facultatif) : d
            </label>
            <button
              type="button"
              onClick={() => setShowDevoirInput(!showDevoirInput)}
              style={{
                background: 'none',
                border: 'none',
                color: '#007bff',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              {showDevoirInput ? 'Masquer' : 'Afficher les options'}
            </button>
          </div>

          {/* Zone d'information devoir - en dehors de showDevoirInput pour être toujours visible */}

          {showDevoirInput && (
            <div>
              {/* Devoir existant */}
              {devoirs.length > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '14px' }}>
                    Associer à un devoir existant :
                  </label>
                  <select
                    value={devoirExistant}
                    onChange={(e) => {
                      setDevoirExistant(e.target.value)
                      if (e.target.value) setDevoirLabel('') // Effacer le nouveau devoir si on sélectionne un existant
                    }}
                    style={{
                      width: '100%',
                      padding: '6px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">-- Sélectionner un devoir existant --</option>
                    {devoirs.map(devoir => (
                      <option key={devoir.devoirKey} value={devoir.devoirKey}>
                        {devoir.devoir_label} ({new Date(devoir.date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* OU nouveau devoir */}
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '14px' }}>
                  {devoirs.length > 0 ? 'OU créer un nouveau devoir :' : 'Créer un nouveau devoir :'}
                </label>
                <input
                  type="text"
                  value={devoirLabel}
                  onChange={(e) => {
                    
                    setDevoirLabel(e.target.value)
                    if (e.target.value) setDevoirExistant('') // Effacer la sélection existante si on tape un nouveau
                  }}
                  placeholder="Ex: TP Chimie 12/09/25, Contrôle Math..."
                  style={{
                    width: '100%',
                    padding: '6px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px'
                  }}
                />
                
                {/* Zone d'information quand on saisit un nouveau devoir - maintenant au bon endroit */}
              
                {devoirLabel.trim().length >= 1 && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px',
                    backgroundColor: '#e8f5e8',
                    border: '1px solid #4caf50',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#2e7d32'
                  }}>
                    ✅ <strong>Vous positionnez la compétence "{competenceCode}" sur le devoir "{devoirLabel.trim()}"</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <p>Choisis une couleur :</p>
        <div className="couleur-options">
          {couleurs.map(c => (
            <button
              key={c.code}
              style={{
                backgroundColor: c.hex,
                border: 'none',
                padding: '10px 20px',
                margin: '0.5rem',
                color: '#fff',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
              onClick={() => handleChoixCouleur(c.code)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: '1rem' }}>Annuler</button>
      </div>
    </div>
  )
}

export default ColorPickerModal
