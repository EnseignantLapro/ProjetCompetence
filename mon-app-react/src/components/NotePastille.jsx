// components/NotePastille.jsx
const couleurMap = {
  rouge: '#e53935',    // Non acquis
  jaune: '#fdd835',    // En progression
  bleu: '#42a5f5',     // Acquis
  vert: '#43a047',     // Maîtrisé
}

function NotePastille({ note, onClick }) {
  
  const style = {
    backgroundColor: couleurMap[note.couleur],
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'inline-block',
    margin: '2px',
    cursor: 'pointer',
  }
  
  return <div 
    style={style} 
    title={note.competence_code} 
    onClick={() => onClick(note)}
  />
}

export default NotePastille
