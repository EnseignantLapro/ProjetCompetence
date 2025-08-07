import './ColorPickerModal.css'

const couleurs = [
  { code: 'rouge', label: 'Non acquis', hex: '#e74c3c' },
  { code: 'jaune', label: 'En progression', hex: '#f1c40f' },
  { code: 'bleu', label: 'Acquis', hex: '#3498db' },
  { code: 'vert', label: 'Maîtrisé', hex: '#2ecc71' },
]

function ColorPickerModal({ eleve, competenceCode, onClose, ajouterNote }) {
  const handleChoixCouleur = async (couleur) => {
  const note = {
    eleve_id: eleve.id,
    competence_code: competenceCode,
    couleur,
    date: new Date().toISOString(),
    prof_id: 1
  }

  const res = await fetch(`http://${window.location.hostname}:3001/notes`, {
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