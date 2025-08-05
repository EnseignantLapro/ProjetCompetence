// back/server.js
const express = require('express')
const sqlite3 = require('sqlite3').verbose()
const cors = require('cors')
const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

const db = new sqlite3.Database('./competences.db')

// Création des tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS competences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL
  )`)
    db.run(`CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL
)`)
    db.run(`CREATE TABLE IF NOT EXISTS eleves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_moodle INTEGER,
  prenom TEXT,
  nom TEXT,
  photo TEXT,
  classe_id INTEGER,
  FOREIGN KEY (classe_id) REFERENCES classes(id)
)`)
    db.run(`CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id INTEGER,
  competence_code TEXT,
  couleur TEXT,
  date TEXT,
  prof_id INTEGER
)`)

    db.run(`CREATE TABLE IF NOT EXISTS competences_n3 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_code TEXT NOT NULL,
  code TEXT NOT NULL,
  nom TEXT NOT NULL
)`)



})

// Routes API

// GET : liste des niveau 3 par parent ou toutes si pas de parent_code
app.get('/competences-n3', (req, res) => {
    const { parent_code } = req.query
    let query = 'SELECT * FROM competences_n3'
    let params = []
    
    if (parent_code) {
        query += ' WHERE parent_code = ?'
        params.push(parent_code)
    }
    
    query += ' ORDER BY code'
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(rows)
    })
})

app.post('/competences-n3', (req, res) => {
    const { parent_code, code, nom } = req.body
    db.run(
        'INSERT INTO competences_n3 (parent_code, code, nom) VALUES (?, ?, ?)',
        [parent_code, code, nom],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            res.json({ id: this.lastID, parent_code, code, nom })
        }
    )
})



app.get('/eleves', (req, res) => {
  const { classe_id } = req.query
  let query = 'SELECT * FROM eleves'
  const params = []

  if (classe_id) {
    query += ' WHERE classe_id = ?'
    params.push(classe_id)
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})

app.post('/eleves', (req, res) => {
  const { nom, prenom, moodle_id, classe_id } = req.body
  db.run(
    'INSERT INTO eleves (nom, prenom, id_moodle, classe_id) VALUES (?, ?, ?, ?)',
    [nom, prenom, moodle_id, classe_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ 
        id: this.lastID, 
        nom, 
        prenom, 
        id_moodle: moodle_id, 
        classe_id 
      })
    }
  )
})

app.post('/notes', (req, res) => {
    const { eleve_id, competence_code, couleur, date, prof_id } = req.body
    db.run(
        'INSERT INTO notes (eleve_id, competence_code, couleur, date, prof_id) VALUES (?, ?, ?, ?, ?)',
        [eleve_id, competence_code, couleur, date, prof_id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            res.json({ id: this.lastID, eleve_id, competence_code, couleur, date, prof_id })
        }
    )
})

app.get('/notes', (req, res) => {
    db.all('SELECT * FROM notes', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(rows)
    })
})

app.delete('/notes/:id', (req, res) => {
    const { id } = req.params
    db.run('DELETE FROM notes WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message })
        if (this.changes === 0) return res.status(404).json({ error: 'Note non trouvée' })
        res.json({ message: 'Note supprimée', id: parseInt(id) })
    })
})

// Ajouter un élève
// (Cette route est en doublon, supprimée)

// Récupérer toutes les classes
app.get('/classes', (req, res) => {
  db.all('SELECT * FROM classes', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})

// Ajouter une classe
app.post('/classes', (req, res) => {
  const { nom } = req.body
  db.run('INSERT INTO classes (nom) VALUES (?)', [nom], function (err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ id: this.lastID, nom })
  })
})

// Modifier une classe
app.put('/classes/:id', (req, res) => {
  const { nom } = req.body
  db.run(
    'UPDATE classes SET nom = ? WHERE id = ?',
    [nom, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ id: parseInt(req.params.id), nom })
    }
  )
})

// Supprimer une classe
app.delete('/classes/:id', (req, res) => {
  db.run('DELETE FROM classes WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message })
    res.status(204).end()
  })
})

app.listen(PORT, () => {
    console.log(`Serveur API disponible sur http://localhost:${PORT}`)
    console.log('En attente de requêtes...')
})

process.on('uncaughtException', (err) => {
    console.error('Erreur non attrapée :', err)
})

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesse rejetée non attrapée :', reason)
})