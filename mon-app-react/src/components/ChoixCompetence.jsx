import { useState, useEffect } from 'react'
import { competencesN1N2 } from '../data/competences'

function ChoixCompetence({ onChoixFinal }) {
  const [niveau1, setNiveau1] = useState('')
  const [niveau2, setNiveau2] = useState('')
  const [niveau3, setNiveau3] = useState('')
  const [niveau3Texte, setNiveau3Texte] = useState('')
  const [niveau3EnBase, setNiveau3EnBase] = useState([])

  const OPTION_AJOUTER = '__ajouter__'

  useEffect(() => {
    const saved = localStorage.getItem('choix_competence')
    if (saved) {
      const { niveau1, niveau2, niveau3 } = JSON.parse(saved)
      setNiveau1(niveau1)
      setNiveau2(niveau2 || '')
      setNiveau3(niveau3 || '')
    } else {
      // Si aucune sauvegarde, réinitialiser complètement
      setNiveau1('')
      setNiveau2('')
      setNiveau3('')
      setNiveau3Texte('')
      setNiveau3EnBase([])
    }
  }, [])

useEffect(() => {
  if (niveau2) {
    fetch(`http://${window.location.hostname}:3001/competences-n3?parent_code=${niveau2}`)
      .then(res => res.json())
      .then(data => {
        setNiveau3EnBase(data)
        // NE PAS auto-sélectionner le premier élément
        // L'utilisateur peut vouloir juste une compétence de niveau 2
      })
  } else {
    setNiveau3EnBase([])
    setNiveau3('')
  }
}, [niveau2])

  const competence1 = competencesN1N2.find(c => c.code === niveau1)
  const sousCompetences = competence1?.enfants || []

  const genererCodeN3 = () => {
    const index = niveau3EnBase.length + 1
    return `${niveau2}.${index}`
  }

  const enregistrerNiveau3 = async () => {
    const nom = niveau3Texte.trim()
    if (!nom) return
    const code = genererCodeN3()

    const res = await fetch(`http://${window.location.hostname}:3001/competences-n3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_code: niveau2, code, nom }),
    })

    const data = await res.json()
    const newList = [...niveau3EnBase, data]
    setNiveau3EnBase(newList)
    setNiveau3(data.code) // sélection automatique
    setNiveau3Texte('')
  }

  const valider = () => {
    if (!niveau1) return
    const selection = {
      niveau1,
      niveau2: niveau2 || null,
      niveau3: niveau3 || null,
    }
    localStorage.setItem('choix_competence', JSON.stringify(selection))
    onChoixFinal(selection)
  }

  return (
    <div>
      <h3>Choisir une compétence</h3>

      {/* Niveau 1 */}
      <label>Compétence Principale :</label>
      <select value={niveau1} onChange={e => {
        setNiveau1(e.target.value)
        setNiveau2('')
        setNiveau3('')
        setNiveau3Texte('')
      }}>
        <option value="">-- Choisir --</option>
        {competencesN1N2.map(c => (
          <option key={c.code} value={c.code}>{c.code} — {c.nom}</option>
        ))}
      </select>
<br></br>
      {/* Niveau 2 */}
      {sousCompetences.length > 0 && (
        <>
          <label>Sous - compétence :</label>
          <select value={niveau2} onChange={e => {
            setNiveau2(e.target.value)
            setNiveau3('')
            setNiveau3Texte('')
          }}>
            <option value="">-- Choisir --</option>
            {sousCompetences.map(sc => (
              <option key={sc.code} value={sc.code}>{sc.code} — {sc.nom}</option>
            ))}
          </select>
        </>
      )}
<br></br>
      {/* Niveau 3 */}
      {niveau2 && (
        <>
          <label>Critère d'évaluation (optionnel) :</label>
          <select value={niveau3} onChange={e => setNiveau3(e.target.value)}>
            <option value="">-- Laisser vide pour évaluer la sous-compétence uniquement --</option>
            {niveau3EnBase.map(c => (
              <option key={c.code} value={c.code}>{c.code} — {c.nom}</option>
            ))}
            <option value={OPTION_AJOUTER}>➕ Ajouter une nouvelle sous-compétence</option>
          </select>

          {niveau3 === OPTION_AJOUTER && (
            <><br></br>
              <label>Nouvelle sous-compétence :</label>
              <input
                type="text"
                value={niveau3Texte}
                onChange={e => setNiveau3Texte(e.target.value)}
                placeholder="Ex. : Oral clair et fort"
              />
              <button onClick={enregistrerNiveau3}>Ajouter</button>
            </>
          )}
        </>
      )}

      <br />
      <button className='btn btn-primary' onClick={valider}>Valider le choix</button>
    </div>
  )
}

export default ChoixCompetence