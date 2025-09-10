// components/NotePastille.jsx
const couleurMap = {
  rouge: '#e53935',    // Non acquis
  jaune: '#fdd835',    // En progression
  bleu: '#42a5f5',     // Acquis
  vert: '#43a047',     // Maîtrisé
}

function NotePastille({ note, onClick, tooltip, size = 'normal' }) {
  
  const dimensions = size === 'small' ? { width: '12px', height: '12px' } : { width: '20px', height: '20px' }
  
  const style = {
    backgroundColor: couleurMap[note.couleur],
    borderRadius: '50%',
    ...dimensions,
    display: 'inline-block',
    margin: '2px',
    cursor: 'pointer',
    border: '1px solid #333',
  }
  
  return <div 
    style={style} 
    title={tooltip || note.competence_code} 
    onClick={() => onClick(note)}
  />
}

export default NotePastille
