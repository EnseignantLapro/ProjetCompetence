// back/server.js
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const express = require('express')
const sqlite3 = require('sqlite3').verbose()
const cors = require('cors')
const app = express()
const PORT = 3000

app.set('trust proxy', true); // derrière Apache/Nginx
app.use(cors())
app.use(express.json())
app.use(compression())
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store'); 
  next();
});

// si DB_PATH est défini → on l'utilise
// sinon :
//   - en local (Mac) : ./competences.db dans le dossier du back
//   - en prod (VM)   : /opt/efe-app/data/competences.db
const DEFAULT_LOCAL = path.join(__dirname, 'competences.db');
const DEFAULT_PROD = '/opt/efe-app/data/competences.db';

const DB_PATH = process.env.DB_PATH || (process.env.NODE_ENV === 'production' ? DEFAULT_PROD : DEFAULT_LOCAL);

console.log('Using SQLite DB at:', DB_PATH);

const db = new sqlite3.Database(DB_PATH);

// Fonction pour générer un token unique
function generateToken() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Création des tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS competences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL
  )`)
    db.run(`CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  idReferent INTEGER,
  FOREIGN KEY (idReferent) REFERENCES enseignants(id)
)`)

    db.run(`CREATE TABLE IF NOT EXISTS eleves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_moodle INTEGER,
  prenom TEXT,
  nom TEXT,
  photo TEXT,
  classe_id INTEGER,
  token TEXT UNIQUE,
  FOREIGN KEY (classe_id) REFERENCES classes(id)
)`)
    db.run(`CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id INTEGER,
  competence_code TEXT,
  couleur TEXT,
  date TEXT,
  prof_id INTEGER,
  commentaire TEXT
)`)

    // Ajouter la colonne commentaire si elle n'existe pas (pour les bases existantes)
    db.run(`ALTER TABLE notes ADD COLUMN commentaire TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Erreur lors de l\'ajout de la colonne commentaire:', err.message)
        }
    })

    db.run(`CREATE TABLE IF NOT EXISTS competences_n3 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_code TEXT NOT NULL,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  enseignant_id INTEGER,
  FOREIGN KEY (enseignant_id) REFERENCES enseignants(id)
)`)

    // Ajouter la colonne enseignant_id aux compétences existantes si elle n'existe pas
    db.run(`ALTER TABLE competences_n3 ADD COLUMN enseignant_id INTEGER`, (err) => {
        // Cette erreur est normale si la colonne existe déjà
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Erreur lors de l\'ajout de la colonne enseignant_id:', err)
        }
    })

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
db.run(`CREATE TABLE IF NOT EXISTS enseignants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_moodle INTEGER,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  photo TEXT,
  etablissement TEXT,
  token TEXT UNIQUE,
  referent INTEGER DEFAULT 0
)`)

// Table de liaison enseignant-classe
db.run(`CREATE TABLE IF NOT EXISTS enseignant_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enseignant_id INTEGER,
  classe_id INTEGER,
  FOREIGN KEY (enseignant_id) REFERENCES enseignants(id),
  FOREIGN KEY (classe_id) REFERENCES classes(id),
  UNIQUE(enseignant_id, classe_id)
)`)

});


// Routes API
// Récupérer toutes les classes de l'établissement du référent à partir du token
app.get('/classes/by-token/:token', (req, res) => {
    const { token } = req.params;
    // Récupérer l'établissement du référent
    db.get('SELECT etablissement FROM enseignants WHERE token = ?', [token], (err, enseignant) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!enseignant || !enseignant.etablissement) {
            return res.status(404).json({ error: "Enseignant ou établissement non trouvé" });
        }
        // Récupérer toutes les classes dont le référent appartient à cet établissement
        db.all(`
            SELECT c.*, e.prenom as referent_prenom, e.nom as referent_nom, e.etablissement as referent_etablissement
            FROM classes c
            LEFT JOIN enseignants e ON c.idReferent = e.id
            WHERE e.etablissement = ?
            ORDER BY c.nom
        `, [enseignant.etablissement], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});



// GET : liste des niveau 3 par parent ou toutes si pas de parent_code
app.get('/competences-n3', (req, res) => {
    const { parent_code, etablissement, enseignant_id, mode } = req.query
    let query = `
        SELECT c.*, e.prenom as enseignant_prenom, e.nom as enseignant_nom, e.etablissement 
        FROM competences_n3 c
        LEFT JOIN enseignants e ON c.enseignant_id = e.id
        WHERE 1=1
    `
    let params = []

    if (parent_code) {
        query += ' AND c.parent_code = ?'
        params.push(parent_code)
    }

    // Trois modes de filtrage selon le cas d'usage
    if (etablissement) {
        if (mode === 'admin') {
            // Mode administration : TOUTES les compétences de l'établissement (pour gestion)
            query += ' AND (c.enseignant_id IS NULL OR e.etablissement = ?)'
            params.push(etablissement)
        } else if (mode === 'choice') {
            // Mode choix : seulement compétences officielles + ses propres compétences
            query += ' AND (c.enseignant_id IS NULL'
            if (enseignant_id) {
                query += ' OR c.enseignant_id = ?'
                params.push(enseignant_id)
            }
            query += ')'
        } else {
            // Mode utilisation par défaut (bilan) : compétences officielles + toutes les compétences de l'établissement
            query += ' AND (c.enseignant_id IS NULL OR e.etablissement = ?'
            params.push(etablissement)
            
            // Si un enseignant spécifique est fourni, inclure aussi ses compétences personnelles
            if (enseignant_id) {
                query += ' OR c.enseignant_id = ?'
                params.push(enseignant_id)
            }
            
            query += ')'
        }
    }

    query += ' ORDER BY c.code'

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(rows)
    })
})

app.post('/competences-n3', (req, res) => {
    const { parent_code, code, nom, enseignant_id } = req.body
    db.run(
        'INSERT INTO competences_n3 (parent_code, code, nom, enseignant_id) VALUES (?, ?, ?, ?)',
        [parent_code, code, nom, enseignant_id || null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            res.json({ id: this.lastID, parent_code, code, nom, enseignant_id: enseignant_id || null })
        }
    )
})

// Modifier une compétence N3
app.put('/competences-n3/:id', (req, res) => {
    const { id } = req.params
    const { parent_code, code, nom, enseignant_id } = req.body

    db.run(
        'UPDATE competences_n3 SET parent_code = ?, code = ?, nom = ?, enseignant_id = ? WHERE id = ?',
        [parent_code, code, nom, enseignant_id || null, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Compétence non trouvée' })
            res.json({ id: parseInt(id), parent_code, code, nom, enseignant_id: enseignant_id || null })
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

    query += ' ORDER BY nom, prenom'

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
    const { nom, prenom, moodle_id, classe_id, photo, token } = req.body
    const finalToken = token || generateToken() // Utiliser le token fourni ou en générer un

    db.run(
        'INSERT INTO eleves (nom, prenom, id_moodle, classe_id, photo, token) VALUES (?, ?, ?, ?, ?, ?)',
        [nom, prenom, moodle_id, classe_id, photo || 'default.jpg', finalToken],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            res.json({
                id: this.lastID,
                nom,
                prenom,
                id_moodle: moodle_id,
                classe_id,
                photo: photo || 'default.jpg',
                token: finalToken
            })
        }
    )
})

// Modifier un élève
app.put('/eleves/:id', (req, res) => {
    const { id } = req.params
    const { nom, prenom, moodle_id, classe_id, photo, token } = req.body

    db.run(
        'UPDATE eleves SET nom = ?, prenom = ?, id_moodle = ?, classe_id = ?, photo = ?, token = ? WHERE id = ?',
        [nom, prenom, moodle_id, classe_id, photo || 'default.jpg', token, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Élève non trouvé' })
            res.json({
                id: parseInt(id),
                nom,
                prenom,
                id_moodle: moodle_id,
                classe_id,
                photo: photo || 'default.jpg',
                token
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

// Régénérer le token d'un élève
app.post('/eleves/:id/regenerate-token', (req, res) => {
    const { id } = req.params
    const newToken = generateToken()

    db.run(
        'UPDATE eleves SET token = ? WHERE id = ?',
        [newToken, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Élève non trouvé' })
            res.json({ id: parseInt(id), token: newToken })
        }
    )
})

// Routes d'authentification pour les élèves
// Vérifier un token d'élève
app.post('/auth/verify-token', (req, res) => {
    const { token } = req.body

    if (!token) {
        return res.status(400).json({ error: 'Token manquant' })
    }

    db.get(
        'SELECT id, prenom, nom, id_moodle, classe_id, photo FROM eleves WHERE token = ?',
        [token],
        (err, eleve) => {
            if (err) {
                console.error('Erreur lors de la vérification du token:', err)
                return res.status(500).json({ error: err.message })
            }

            if (!eleve) {
                return res.json({ valid: false, message: 'Token invalide' })
            }

            res.json({
                valid: true,
                eleve: {
                    id: eleve.id,
                    prenom: eleve.prenom,
                    nom: eleve.nom,
                    id_moodle: eleve.id_moodle,
                    classe_id: eleve.classe_id,
                    photo: eleve.photo
                }
            })
        }
    )
})

// Routes pour les enseignants
// Récupérer tous les enseignants (avec filtrage optionnel par établissement)
app.get('/enseignants', (req, res) => {
    const { etablissement } = req.query
    
    let query = 'SELECT * FROM enseignants'
    let params = []
    
    if (etablissement) {
        query += ' WHERE etablissement = ?'
        params.push(etablissement)
    }
    
    query += ' ORDER BY nom, prenom'
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(rows)
    })
})

// Récupérer un enseignant par ID
app.get('/enseignants/:id', (req, res) => {
    const { id } = req.params
    db.get('SELECT * FROM enseignants WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!row) return res.status(404).json({ error: 'Enseignant non trouvé' })
        res.json(row)
    })
})

// Ajouter un enseignant
app.post('/enseignants', (req, res) => {
    const { id_moodle, nom, prenom, photo, etablissement, referent } = req.body
    const token = generateToken()

    db.run(
        'INSERT INTO enseignants (id_moodle, nom, prenom, photo, etablissement, token, referent) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id_moodle, nom, prenom, photo || 'default.jpg', etablissement, token, referent ? 1 : 0],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            res.json({
                id: this.lastID,
                id_moodle,
                nom,
                prenom,
                photo: photo || 'default.jpg',
                etablissement,
                token,
                referent: referent ? true : false
            })
        }
    )
})

// Modifier un enseignant
app.put('/enseignants/:id', (req, res) => {
    const { id } = req.params
    const { id_moodle, nom, prenom, photo, etablissement, token, referent } = req.body

    db.run(
        'UPDATE enseignants SET id_moodle = ?, nom = ?, prenom = ?, photo = ?, etablissement = ?, token = ?, referent = ? WHERE id = ?',
        [id_moodle, nom, prenom, photo || 'default.jpg', etablissement, token, referent ? 1 : 0, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Enseignant non trouvé' })
            res.json({
                id: parseInt(id),
                id_moodle,
                nom,
                prenom,
                photo: photo || 'default.jpg',
                etablissement,
                token,
                referent: referent ? true : false
            })
        }
    )
})

// Supprimer un enseignant
app.delete('/enseignants/:id', (req, res) => {
    const { id } = req.params

    // Supprimer d'abord les associations enseignant-classe
    db.run('DELETE FROM enseignant_classes WHERE enseignant_id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message })

        // Puis supprimer l'enseignant
        db.run('DELETE FROM enseignants WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Enseignant non trouvé' })
            res.json({ message: 'Enseignant supprimé' })
        })
    })
})

// Régénérer le token d'un enseignant
app.post('/enseignants/:id/regenerate-token', (req, res) => {
    const { id } = req.params
    const newToken = generateToken()

    db.run(
        'UPDATE enseignants SET token = ? WHERE id = ?',
        [newToken, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Enseignant non trouvé' })
            res.json({ id: parseInt(id), token: newToken })
        }
    )
})

// Routes pour l'association enseignant-classe
// Récupérer les classes d'un enseignant
app.get('/enseignants/:id/classes', (req, res) => {
    const { id } = req.params
    const query = `
    SELECT c.* 
    FROM classes c
    JOIN enseignant_classes ec ON c.id = ec.classe_id
    WHERE ec.enseignant_id = ?
    ORDER BY c.nom
  `

    db.all(query, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(rows)
    })
})

// Récupérer les enseignants d'une classe
app.get('/classes/:id/enseignants', (req, res) => {
    const { id } = req.params
    const query = `
    SELECT e.* 
    FROM enseignants e
    JOIN enseignant_classes ec ON e.id = ec.enseignant_id
    WHERE ec.classe_id = ?
    ORDER BY e.nom, e.prenom
  `

    db.all(query, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(rows)
    })
})

// Associer un enseignant à une classe
app.post('/enseignant-classes', (req, res) => {
    const { enseignant_id, classe_id } = req.body

    db.run(
        'INSERT INTO enseignant_classes (enseignant_id, classe_id) VALUES (?, ?)',
        [enseignant_id, classe_id],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Cet enseignant est déjà associé à cette classe' })
                }
                return res.status(500).json({ error: err.message })
            }
            res.json({ id: this.lastID, enseignant_id, classe_id })
        }
    )
})

// Supprimer l'association enseignant-classe
app.delete('/enseignant-classes/:enseignantId/:classeId', (req, res) => {
    const { enseignantId, classeId } = req.params

    db.run(
        'DELETE FROM enseignant_classes WHERE enseignant_id = ? AND classe_id = ?',
        [enseignantId, classeId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Association non trouvée' })
            res.json({ message: 'Association supprimée' })
        }
    )
})

// Vérifier un token d'enseignant
app.post('/auth/verify-teacher-token', (req, res) => {
    const { token } = req.body

    if (!token) {
        return res.status(400).json({ error: 'Token manquant' })
    }

    // Vérifier si c'est le token super admin
    const SUPER_ADMIN_TOKEN = 'wyj4zi9yan5qktoby5alm'
    if (token === SUPER_ADMIN_TOKEN) {
        // Récupérer les données de l'enseignant ID 1 pour le super admin
        db.get(
            'SELECT id, prenom, nom, id_moodle, photo, etablissement, referent FROM enseignants WHERE id = 1',
            [],
            (err, enseignant) => {
                if (err) {
                    console.error('Erreur lors de la récupération du super admin:', err)
                    return res.status(500).json({ error: err.message })
                }

                if (!enseignant) {
                    return res.status(404).json({ error: 'Enseignant super admin (ID 1) non trouvé dans la base' })
                }

                // Récupérer les classes de l'enseignant ID 1
                const query = `
                    SELECT c.* 
                    FROM classes c
                    JOIN enseignant_classes ec ON c.id = ec.classe_id
                    WHERE ec.enseignant_id = 1
                    ORDER BY c.nom
                `

                db.all(query, [], (err, classes) => {
                    if (err) {
                        console.error('Erreur lors de la récupération des classes du super admin:', err)
                        return res.status(500).json({ error: err.message })
                    }

                    return res.json({
                        valid: true,
                        isSuperAdmin: true,
                        enseignant: {
                            id: enseignant.id,
                            prenom: enseignant.prenom,
                            nom: enseignant.nom,
                            id_moodle: enseignant.id_moodle,
                            photo: enseignant.photo,
                            etablissement: enseignant.etablissement,
                            referent: enseignant.referent ? true : false,
                            superAdmin: true,
                            classes: classes
                        }
                    })
                })
            }
        )
        return // Important : sortir de la fonction pour éviter d'exécuter le reste
    }

    // Récupérer l'enseignant et ses classes
    db.get(
        'SELECT id, prenom, nom, id_moodle, photo, etablissement, referent FROM enseignants WHERE token = ?',
        [token],
        (err, enseignant) => {
            if (err) {
                console.error('Erreur lors de la vérification du token enseignant:', err)
                return res.status(500).json({ error: err.message })
            }

            if (!enseignant) {
                return res.json({ valid: false, message: 'Token invalide' })
            }

            // Récupérer les classes de l'enseignant
            const query = `
        SELECT c.* 
        FROM classes c
        JOIN enseignant_classes ec ON c.id = ec.classe_id
        WHERE ec.enseignant_id = ?
        ORDER BY c.nom
      `

            db.all(query, [enseignant.id], (err, classes) => {
                if (err) {
                    console.error('Erreur lors de la récupération des classes:', err)
                    return res.status(500).json({ error: err.message })
                }

                res.json({
                    valid: true,
                    isSuperAdmin: false,
                    enseignant: {
                        id: enseignant.id,
                        prenom: enseignant.prenom,
                        nom: enseignant.nom,
                        id_moodle: enseignant.id_moodle,
                        photo: enseignant.photo,
                        etablissement: enseignant.etablissement,
                        referent: enseignant.referent ? true : false,
                        superAdmin: false,
                        classes: classes
                    }
                })
            })
        }
    )
})

app.post('/notes', (req, res) => {
    const { eleve_id, competence_code, couleur, date, prof_id, commentaire } = req.body
    db.run(
        'INSERT INTO notes (eleve_id, competence_code, couleur, date, prof_id, commentaire) VALUES (?, ?, ?, ?, ?, ?)',
        [eleve_id, competence_code, couleur, date, prof_id, commentaire || null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            res.json({ id: this.lastID, eleve_id, competence_code, couleur, date, prof_id, commentaire })
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
    const { eleve_id, competence_code, couleur, date, prof_id, commentaire } = req.body

    db.run(
        'UPDATE notes SET eleve_id = ?, competence_code = ?, couleur = ?, date = ?, prof_id = ?, commentaire = ? WHERE id = ?',
        [eleve_id, competence_code, couleur, date, prof_id, commentaire || null, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Note non trouvée' })
            res.json({ id: parseInt(id), eleve_id, competence_code, couleur, date, prof_id, commentaire })
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

// Récupérer toutes les classes
app.get('/classes', (req, res) => {
    db.all(`
    SELECT c.*, e.prenom as referent_prenom, e.nom as referent_nom 
    FROM classes c 
    LEFT JOIN enseignants e ON c.idReferent = e.id 
    ORDER BY c.nom
  `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(rows)
    })
})

// Récupérer toutes les classes avec le nombre d'élèves
app.get('/classes/with-counts', (req, res) => {
    db.all(`
    SELECT c.id, c.nom, c.idReferent, COUNT(eleves.id) as student_count, e.prenom as referent_prenom, e.nom as referent_nom 
    FROM classes c 
    LEFT JOIN eleves ON c.id = eleves.classe_id 
    LEFT JOIN enseignants e ON c.idReferent = e.id 
    GROUP BY c.id, c.nom, c.idReferent
    ORDER BY c.nom
  `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        // S'assurer que idReferent est bien présent dans chaque objet
        const result = rows.map(row => ({
            id: row.id,
            nom: row.nom,
            idReferent: row.idReferent,
            student_count: row.student_count,
            referent_prenom: row.referent_prenom,
            referent_nom: row.referent_nom
        }))
        res.json(result)
    })
})

// Ajouter une classe
app.post('/classes', (req, res) => {
    const { nom, idReferent, creatorTeacherId } = req.body
    // Correction : si idReferent n'est pas fourni, on utilise creatorTeacherId si présent
    let referentId = null
    if (idReferent) {
        referentId = idReferent
    } else if (creatorTeacherId) {
        referentId = creatorTeacherId
    } else {
        referentId = null
    }
    db.run('INSERT INTO classes (nom, idReferent) VALUES (?, ?)', [nom, referentId], function (err) {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ id: this.lastID, nom, idReferent: referentId })
    })
})

// Modifier une classe
app.put('/classes/:id', (req, res) => {
    const { nom, idReferent } = req.body
    db.run(
        'UPDATE classes SET nom = ?, idReferent = ? WHERE id = ?',
        [nom, idReferent || null, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message })
            res.json({ id: parseInt(req.params.id), nom, idReferent: idReferent || null })
        }
    )
})

// Assigner un professeur à une classe
app.put('/classes/:id/assign-teacher', (req, res) => {
    const { id } = req.params
    const { teacherId } = req.body

    if (!teacherId) {
        return res.status(400).json({ error: 'teacherId est requis' })
    }

    // Vérifier que l'enseignant existe
    db.get('SELECT id, nom, prenom FROM enseignants WHERE id = ?', [teacherId], (err, teacher) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!teacher) return res.status(404).json({ error: 'Enseignant non trouvé' })

        // Vérifier que la classe existe
        db.get('SELECT id, nom FROM classes WHERE id = ?', [id], (err, classe) => {
            if (err) return res.status(500).json({ error: err.message })
            if (!classe) return res.status(404).json({ error: 'Classe non trouvée' })

            // Vérifier si l'enseignant est déjà assigné à cette classe
            db.get('SELECT * FROM enseignant_classes WHERE enseignant_id = ? AND classe_id = ?', 
                [teacherId, id], (err, existing) => {
                if (err) return res.status(500).json({ error: err.message })
                
                if (existing) {
                    return res.status(400).json({ error: 'Cet enseignant est déjà assigné à cette classe' })
                }

                // Assigner l'enseignant à la classe
                db.run('INSERT INTO enseignant_classes (enseignant_id, classe_id) VALUES (?, ?)', 
                    [teacherId, id], function (err) {
                    if (err) return res.status(500).json({ error: err.message })
                    
                    res.json({ 
                        message: `${teacher.prenom} ${teacher.nom} a été assigné(e) à la classe ${classe.nom}`,
                        enseignant_id: teacherId,
                        classe_id: id
                    })
                })
            })
        })
    })
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
    const { etablissement } = req.query

    let query, params

    if (etablissement) {
        // Avec filtrage par établissement : ne compter que les évaluations/positionnements du bon établissement
        query = `
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
              AND (n.prof_id IS NULL OR n.prof_id IN (SELECT id FROM enseignants WHERE etablissement = ?))
            LEFT JOIN positionnements_enseignant p ON e.id = p.eleve_id 
              AND (p.prof_id IS NULL OR p.prof_id IN (SELECT id FROM enseignants WHERE etablissement = ?))
            WHERE e.classe_id = ?
            GROUP BY e.id, e.prenom, e.nom, e.id_moodle, e.photo, e.classe_id
            ORDER BY e.nom, e.prenom
        `
        params = [etablissement, etablissement, classeId]
    } else {
        // Sans filtrage : compter toutes les évaluations/positionnements
        query = `
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
        params = [classeId]
    }

    db.all(query, params, (err, rows) => {
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

    db.run('DELETE FROM notes WHERE eleve_id = ?', [eleveId], function (err) {
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
                            function (err) {
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
                const token = generateToken()
                db.run(
                    'INSERT INTO eleves (id_moodle, prenom, nom, classe_id, token) VALUES (?, ?, ?, ?, ?)',
                    [idMoodleNum, prenom, nom, classeIdNum, token],
                    function (err) {
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

app.get('/debug/db', (req, res) => res.json({ dbPath: DB_PATH }));

//PARTIE REACT
const staticDir = path.join(__dirname, 'frontend-dist')

// Headers spéciaux pour index.html (jamais de cache)
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('ETag', Date.now().toString()); // ETag unique
  res.sendFile(path.join(staticDir, 'index.html'))
})

// Fichiers statiques (cache court pour éviter les problèmes de proxy)
app.use(express.static(staticDir, {
  maxAge: '1h', // Réduit de 30d à 1h
  index: false,
  setHeaders: (res, path) => {
    // Pour les fichiers JS/CSS avec hash, on peut garder un cache plus long
    if (path.match(/\.(js|css)$/) && path.includes('.')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 jour
    } else {
      // Pour tous les autres fichiers, cache minimal
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('ETag', Date.now().toString());
    }
  }
}))

// SPA fallback : toutes les routes non-API renvoient index.html avec headers anti-cache
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('ETag', Date.now().toString());
  res.sendFile(path.join(staticDir, 'index.html'))
})




app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur API disponible sur http://localhost:${PORT}`)
    console.log(`Serveur API également accessible sur http://192.168.1.109:${PORT}`)
    console.log('En attente de requêtes...')
})

process.on('uncaughtException', (err) => {
    console.error('Erreur non attrapée :', err)
})

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesse rejetée non attrapée :', reason)
})