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

    // Table pour les positionnements manuels des enseignants
    db.run(`CREATE TABLE IF NOT EXISTS positionnements_enseignant (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id INTEGER,
  competence_code TEXT,
  couleur TEXT,
  date TEXT,
  prof_id INTEGER,
  FOREIGN KEY (eleve_id) REFERENCES eleves(id)
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

// Modifier une compétence N3
app.put('/competences-n3/:id', (req, res) => {
    const { id } = req.params
    const { parent_code, code, nom } = req.body
    
    db.run(
        'UPDATE competences_n3 SET parent_code = ?, code = ?, nom = ? WHERE id = ?',
        [parent_code, code, nom, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Compétence non trouvée' })
            res.json({ id: parseInt(id), parent_code, code, nom })
        }
    )
})

// Supprimer une compétence N3
app.delete('/competences-n3/:id', (req, res) => {
    const { id } = req.params
    db.run('DELETE FROM competences_n3 WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message })
        if (this.changes === 0) return res.status(404).json({ error: 'Compétence non trouvée' })
        res.json({ message: 'Compétence supprimée', id: parseInt(id) })
    })
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

// Récupérer les élèves avec le nombre de notes et positionnements
app.get('/eleves/with-counts', (req, res) => {
  const { classe_id } = req.query
  let whereClause = ''
  const params = []

  if (classe_id) {
    whereClause = 'WHERE e.classe_id = ?'
    params.push(classe_id)
  }

  const query = `
    SELECT 
      e.*,
      COUNT(DISTINCT n.id) as notes_count,
      COUNT(DISTINCT p.id) as positionnements_count,
      (COUNT(DISTINCT n.id) + COUNT(DISTINCT p.id)) as total_data_count
    FROM eleves e 
    LEFT JOIN notes n ON e.id = n.eleve_id 
    LEFT JOIN positionnements_enseignant p ON e.id = p.eleve_id 
    ${whereClause}
    GROUP BY e.id, e.nom, e.prenom, e.id_moodle, e.photo, e.classe_id
    ORDER BY e.nom, e.prenom
  `

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})

app.post('/eleves', (req, res) => {
  const { nom, prenom, moodle_id, classe_id, photo } = req.body
  db.run(
    'INSERT INTO eleves (nom, prenom, id_moodle, classe_id, photo) VALUES (?, ?, ?, ?, ?)',
    [nom, prenom, moodle_id, classe_id, photo || 'default.jpg'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ 
        id: this.lastID, 
        nom, 
        prenom, 
        id_moodle: moodle_id, 
        classe_id,
        photo: photo || 'default.jpg'
      })
    }
  )
})

// Modifier un élève
app.put('/eleves/:id', (req, res) => {
  const { id } = req.params
  const { nom, prenom, moodle_id, classe_id, photo } = req.body
  
  db.run(
    'UPDATE eleves SET nom = ?, prenom = ?, id_moodle = ?, classe_id = ?, photo = ? WHERE id = ?',
    [nom, prenom, moodle_id, classe_id, photo || 'default.jpg', id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message })
      if (this.changes === 0) return res.status(404).json({ error: 'Élève non trouvé' })
      res.json({ 
        id: parseInt(id), 
        nom, 
        prenom, 
        id_moodle: moodle_id, 
        classe_id,
        photo: photo || 'default.jpg'
      })
    }
  )
})

// Supprimer un élève
app.delete('/eleves/:id', (req, res) => {
  const { id } = req.params
  const { forceDelete } = req.query // Paramètre pour forcer la suppression
  
  // D'abord, vérifier s'il y a des notes et positionnements pour cet élève
  db.get(`
    SELECT 
      (SELECT COUNT(*) FROM notes WHERE eleve_id = ?) as notes_count,
      (SELECT COUNT(*) FROM positionnements_enseignant WHERE eleve_id = ?) as positionnements_count
  `, [id, id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })
    
    const notesCount = row.notes_count
    const positionnementsCount = row.positionnements_count
    const totalDataCount = notesCount + positionnementsCount
    
    if (totalDataCount > 0 && forceDelete !== 'true') {
      // Il y a des données liées à cet élève et on ne force pas la suppression
      return res.status(400).json({ 
        error: 'Cannot delete student with data', 
        message: `Cet élève possède ${notesCount} note(s) et ${positionnementsCount} positionnement(s). Supprimez d'abord ces données ou utilisez la suppression forcée.`,
        notesCount,
        positionnementsCount,
        totalDataCount
      })
    }
    
    if (forceDelete === 'true' && totalDataCount > 0) {
      // Suppression forcée : supprimer d'abord toutes les données liées
      db.serialize(() => {
        db.run('DELETE FROM notes WHERE eleve_id = ?', [id], (err) => {
          if (err) return res.status(500).json({ error: err.message })
          
          db.run('DELETE FROM positionnements_enseignant WHERE eleve_id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: err.message })
            
            // Puis supprimer l'élève
            db.run('DELETE FROM eleves WHERE id = ?', [id], function (err) {
              if (err) return res.status(500).json({ error: err.message })
              if (this.changes === 0) return res.status(404).json({ error: 'Élève non trouvé' })
              res.json({ 
                message: `Élève supprimé avec ${notesCount} note(s) et ${positionnementsCount} positionnement(s)`,
                deletedNotes: notesCount,
                deletedPositionnements: positionnementsCount
              })
            })
          })
        })
      })
    } else {
      // Pas de données liées à l'élève, suppression normale
      db.run('DELETE FROM eleves WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message })
        if (this.changes === 0) return res.status(404).json({ error: 'Élève non trouvé' })
        res.json({ message: 'Élève supprimé' })
      })
    }
  })
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

// Modifier une note existante
app.put('/notes/:id', (req, res) => {
    const { id } = req.params
    const { eleve_id, competence_code, couleur, date, prof_id } = req.body
    
    db.run(
        'UPDATE notes SET eleve_id = ?, competence_code = ?, couleur = ?, date = ?, prof_id = ? WHERE id = ?',
        [eleve_id, competence_code, couleur, date, prof_id, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Note non trouvée' })
            res.json({ id: parseInt(id), eleve_id, competence_code, couleur, date, prof_id })
        }
    )
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

// Récupérer toutes les classes avec le nombre d'élèves
app.get('/classes/with-counts', (req, res) => {
  db.all(`
    SELECT c.*, COUNT(e.id) as student_count 
    FROM classes c 
    LEFT JOIN eleves e ON c.id = e.classe_id 
    GROUP BY c.id, c.nom 
    ORDER BY c.nom
  `, [], (err, rows) => {
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
  const { id } = req.params
  const { forceDelete } = req.query // Paramètre pour forcer la suppression
  
  // D'abord, vérifier s'il y a des élèves dans cette classe
  db.get('SELECT COUNT(*) as count FROM eleves WHERE classe_id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })
    
    const eleveCount = row.count
    
    if (eleveCount > 0 && forceDelete !== 'true') {
      // Il y a des élèves dans la classe et on ne force pas la suppression
      return res.status(400).json({ 
        error: 'Cannot delete class with students', 
        message: `Cette classe contient ${eleveCount} élève(s). Supprimez d'abord les élèves ou utilisez la suppression forcée.`,
        studentCount: eleveCount
      })
    }
    
    if (forceDelete === 'true' && eleveCount > 0) {
      // Suppression forcée : supprimer d'abord tous les élèves de la classe
      db.run('DELETE FROM eleves WHERE classe_id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message })
        
        // Puis supprimer la classe
        db.run('DELETE FROM classes WHERE id = ?', [id], function (err) {
          if (err) return res.status(500).json({ error: err.message })
          if (this.changes === 0) return res.status(404).json({ error: 'Classe non trouvée' })
          res.json({ 
            message: `Classe supprimée avec ${eleveCount} élève(s)`,
            deletedStudents: eleveCount
          })
        })
      })
    } else {
      // Pas d'élèves dans la classe, suppression normale
      db.run('DELETE FROM classes WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message })
        if (this.changes === 0) return res.status(404).json({ error: 'Classe non trouvée' })
        res.json({ message: 'Classe supprimée' })
      })
    }
  })
})

// Routes pour les positionnements enseignant
// Récupérer tous les positionnements ou filtrer par élève et compétence
app.get('/positionnements', (req, res) => {
  const { eleve_id, competence_code } = req.query
  
  let query = 'SELECT * FROM positionnements_enseignant'
  let params = []
  
  if (eleve_id && competence_code) {
    query += ' WHERE eleve_id = ? AND competence_code = ?'
    params = [eleve_id, competence_code]
  } else if (eleve_id) {
    query += ' WHERE eleve_id = ?'
    params = [eleve_id]
  } else if (competence_code) {
    query += ' WHERE competence_code = ?'
    params = [competence_code]
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})

// Récupérer les positionnements pour un élève
app.get('/positionnements/eleve/:eleveId', (req, res) => {
  db.all(
    'SELECT * FROM positionnements_enseignant WHERE eleve_id = ?',
    [req.params.eleveId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    }
  )
})

// Ajouter ou mettre à jour un positionnement
app.post('/positionnements', (req, res) => {
  const { eleve_id, competence_code, couleur, prof_id } = req.body
  const date = new Date().toISOString()
  
  // Vérifier si un positionnement existe déjà
  db.get(
    'SELECT id FROM positionnements_enseignant WHERE eleve_id = ? AND competence_code = ?',
    [eleve_id, competence_code],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message })
      
      if (row) {
        // Mettre à jour le positionnement existant
        db.run(
          'UPDATE positionnements_enseignant SET couleur = ?, date = ?, prof_id = ? WHERE id = ?',
          [couleur, date, prof_id, row.id],
          function (err) {
            if (err) return res.status(500).json({ error: err.message })
            res.json({ id: row.id, eleve_id, competence_code, couleur, date, prof_id })
          }
        )
      } else {
        // Créer un nouveau positionnement
        db.run(
          'INSERT INTO positionnements_enseignant (eleve_id, competence_code, couleur, date, prof_id) VALUES (?, ?, ?, ?, ?)',
          [eleve_id, competence_code, couleur, date, prof_id],
          function (err) {
            if (err) return res.status(500).json({ error: err.message })
            res.json({ id: this.lastID, eleve_id, competence_code, couleur, date, prof_id })
          }
        )
      }
    }
  )
})

// Supprimer un positionnement
app.delete('/positionnements/:id', (req, res) => {
  db.run('DELETE FROM positionnements_enseignant WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message })
    res.status(204).end()
  })
})

// Route pour récupérer les élèves d'une classe avec leurs statistiques d'évaluations
app.get('/eleves/with-evaluations/:classeId', (req, res) => {
  const classeId = req.params.classeId
  
  const query = `
    SELECT 
      e.id,
      e.prenom,
      e.nom,
      e.id_moodle,
      e.photo,
      e.classe_id,
      COUNT(DISTINCT n.id) as evaluations_count,
      COUNT(DISTINCT p.id) as positionnements_count
    FROM eleves e
    LEFT JOIN notes n ON e.id = n.eleve_id
    LEFT JOIN positionnements_enseignant p ON e.id = p.eleve_id
    WHERE e.classe_id = ?
    GROUP BY e.id, e.prenom, e.nom, e.id_moodle, e.photo, e.classe_id
    ORDER BY e.nom, e.prenom
  `
  
  db.all(query, [classeId], (err, rows) => {
    if (err) {
      console.error('Erreur lors de la récupération des élèves avec évaluations:', err)
      return res.status(500).json({ error: err.message })
    }
    res.json(rows)
  })
})

// Route pour supprimer toutes les évaluations d'un élève
app.delete('/eleves/:id/evaluations', (req, res) => {
  const eleveId = req.params.id
  
  db.run('DELETE FROM notes WHERE eleve_id = ?', [eleveId], function(err) {
    if (err) {
      console.error('Erreur lors de la suppression des évaluations:', err)
      return res.status(500).json({ error: err.message })
    }
    res.json({ 
      message: `${this.changes} évaluation(s) supprimée(s)`,
      deletedCount: this.changes 
    })
  })
})

// Route pour importer des évaluations par CSV
app.post('/evaluations/import', (req, res) => {
  const { id_moodle, prenom, nom, classe_id, evaluations } = req.body
  
  if (!id_moodle || !classe_id || !evaluations || !Array.isArray(evaluations)) {
    return res.status(400).json({ error: 'Données manquantes' })
  }
  
  // Convertir id_moodle en nombre pour s'assurer de la compatibilité
  const idMoodleNum = parseInt(id_moodle)
  const classeIdNum = parseInt(classe_id)
  
  db.get(
    'SELECT id, id_moodle, prenom, nom FROM eleves WHERE id_moodle = ? AND classe_id = ?',
    [idMoodleNum, classeIdNum],
    (err, eleve) => {
      if (err) {
        console.error('Erreur lors de la recherche de l\'élève:', err)
        return res.status(500).json({ error: err.message })
      }
      
      let eleveId = eleve ? eleve.id : null
      
      const processEvaluations = (eleveId) => {
        
        // Insérer les évaluations
        const promises = evaluations.map((evaluation, index) => {
          return new Promise((resolve, reject) => {
            const { code, couleur } = evaluation
            
            if (!code || !couleur) {
              resolve() // Ignorer les évaluations vides
              return
            }
            
            // Toujours créer une nouvelle évaluation (accumulation)
            db.run(
              'INSERT INTO notes (eleve_id, competence_code, couleur, date) VALUES (?, ?, ?, datetime("now"))',
              [eleveId, code, couleur],
              function(err) {
                if (err) {
                  reject(err)
                } else {
                  resolve()
                }
              }
            )
          })
        })
        
        Promise.all(promises)
          .then(() => {
            res.json({ message: 'Évaluations importées avec succès', eleveId })
          })
          .catch(err => {
            console.error('Erreur lors de l\'insertion des évaluations:', err)
            res.status(500).json({ error: err.message })
          })
      }
      
      if (eleveId) {
        // L'élève existe déjà
        processEvaluations(eleveId)
      } else {
        // Créer l'élève
        db.run(
          'INSERT INTO eleves (id_moodle, prenom, nom, classe_id) VALUES (?, ?, ?, ?)',
          [idMoodleNum, prenom, nom, classeIdNum],
          function(err) {
            if (err) {
              console.error('Erreur lors de la création de l\'élève:', err)
              return res.status(500).json({ error: err.message })
            }
            processEvaluations(this.lastID)
          }
        )
      }
    }
  )
})

// Route pour exporter les évaluations en CSV
app.get('/evaluations/export/:classeId', (req, res) => {
  const classeId = req.params.classeId

  // Récupérer tous les élèves de la classe avec leurs évaluations
  const query = `
    SELECT 
      e.id_moodle,
      e.prenom,
      e.nom,
      n.competence_code,
      n.couleur
    FROM eleves e
    LEFT JOIN notes n ON e.id = n.eleve_id
    WHERE e.classe_id = ?
    ORDER BY e.nom, e.prenom, n.competence_code
  `

  db.all(query, [classeId], (err, rows) => {
    if (err) {
      console.error('Erreur lors de l\'export des évaluations:', err)
      return res.status(500).json({ error: 'Erreur lors de l\'export des évaluations' })
    }

    // Récupérer toutes les compétences distinctes pour créer les colonnes
    const competencesQuery = `
      SELECT DISTINCT competence_code as code 
      FROM notes n
      JOIN eleves e ON n.eleve_id = e.id
      WHERE e.classe_id = ?
      ORDER BY competence_code
    `

    db.all(competencesQuery, [classeId], (err, competences) => {
      if (err) {
        console.error('Erreur lors de la récupération des compétences:', err)
        return res.status(500).json({ error: 'Erreur lors de la récupération des compétences' })
      }

      // Organiser les données par élève
      const elevesMap = new Map()
      
      rows.forEach(row => {
        const key = `${row.id_moodle}_${row.prenom}_${row.nom}`
        if (!elevesMap.has(key)) {
          elevesMap.set(key, {
            id_moodle: row.id_moodle,
            prenom: row.prenom,
            nom: row.nom,
            evaluations: []
          })
        }
        
        if (row.competence_code && row.couleur) {
          elevesMap.get(key).evaluations.push({
            competence_code: row.competence_code,
            couleur: row.couleur
          })
        }
      })

      // Convertir en tableau
      const eleves = Array.from(elevesMap.values())

      res.json({
        eleves,
        competences
      })
    })
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