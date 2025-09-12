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

// Middleware de vérification des tokens
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const userType = req.headers['x-user-type'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token manquant' });
    }
    
    const token = authHeader.substring(7);
    
    // Si le type d'utilisateur est spécifié, utiliser la logique existante
    if (userType === 'student') {
        return verifyStudentToken(token, req, res, next);
    } else if (userType === 'teacher') {
        return verifyTeacherToken(token, req, res, next);
    }
    
    // Si pas de type spécifié, essayer d'abord enseignant, puis élève
    verifyTeacherToken(token, req, res, (err) => {
        if (err || !req.user) {
            // Si échec enseignant, essayer élève
            verifyStudentToken(token, req, res, next);
        } else {
            // Succès enseignant
            next();
        }
    });
}

function verifyStudentToken(token, req, res, next) {
    db.get(
        `SELECT e.id, e.prenom, e.nom, e.id_moodle, e.classe_id, e.photo, 
                ref.etablissement 
         FROM eleves e
         JOIN classes c ON e.classe_id = c.id
         LEFT JOIN enseignants ref ON c.idReferent = ref.id
         WHERE e.token = ?`,
        [token],
        (err, eleve) => {
            if (err) {
                console.error('Erreur lors de la vérification du token élève:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (!eleve) {
                return res.status(401).json({ error: 'Token élève invalide' });
            }
            
            // Si pas d'établissement via le référent, chercher via un enseignant associé
            if (!eleve.etablissement) {
                db.get(
                    `SELECT e_ens.etablissement
                     FROM enseignants e_ens
                     JOIN enseignant_classes ec ON e_ens.id = ec.enseignant_id
                     WHERE ec.classe_id = ?
                     LIMIT 1`,
                    [eleve.classe_id],
                    (err2, enseignantAssocie) => {
                        if (err2) {
                            console.error('Erreur lors de la recherche d\'enseignant associé:', err2);
                            return res.status(500).json({ error: err2.message });
                        }
                        
                        // Utiliser l'établissement de l'enseignant associé s'il existe
                        eleve.etablissement = enseignantAssocie ? enseignantAssocie.etablissement : null;
                        req.user = { ...eleve, type: 'student' };
                        next();
                    }
                );
            } else {
                req.user = { ...eleve, type: 'student' };
                next();
            }
        }
    );
}

function verifyTeacherToken(token, req, res, next) {
    const SUPER_ADMIN_TOKEN = 'wyj4zi9yan5qktoby5alm';
    
    if (token === SUPER_ADMIN_TOKEN) {
        // Super admin
        db.get(
            'SELECT id, prenom, nom, id_moodle, photo, etablissement, referent FROM enseignants WHERE id = 1',
            [],
            (err, enseignant) => {
                if (err) {
                    console.error('Erreur lors de la vérification du super admin:', err);
                    return next('Super admin error');
                }
                
                if (!enseignant) {
                    return next('Super admin non trouvé');
                }
                
                req.user = { ...enseignant, type: 'teacher', isSuperAdmin: true };
                next();
            }
        );
    } else {
        // Enseignant normal
        db.get(
            'SELECT id, prenom, nom, id_moodle, photo, etablissement, referent FROM enseignants WHERE token = ?',
            [token],
            (err, enseignant) => {
                if (err) {
                    console.error('Erreur lors de la vérification du token enseignant:', err);
                    return next('Teacher verification error');
                }
                
                if (!enseignant) {
                    return next('Token enseignant invalide');
                }
                
                req.user = { ...enseignant, type: 'teacher', isSuperAdmin: false };
                next();
            }
        );
    }
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
// Récupérer toutes les classes de l'établissement du référent à partir de son token
app.get('/classes/by-token/:token', verifyToken, (req, res) => {
    // Cette route peut être utilisée par les enseignants pour récupérer les classes
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'Hahaha vous n\’avez pas dit le mot magic' });
    }
    const { token } = req.params;
    
    // SÉCURITÉ : Vérifier que le token demandé appartient à l'utilisateur connecté
    // ou que c'est un super admin
    const userToken = req.headers.authorization?.substring(7); // Enlever "Bearer "
    
    if (!req.user.isSuperAdmin && token !== userToken) {
        return res.status(403).json({ 
            error: 'ahaha vous n\'avez pas dit le mot magique'
        });
    }
    
    // Récupérer l'établissement du référent
    db.get('SELECT etablissement FROM enseignants WHERE token = ?', [token], (err, enseignant) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!enseignant || !enseignant.etablissement) {
            return res.status(404).json({ error: "Enseignant ou établissement non trouvé" });
        }
        
        // SÉCURITÉ SUPPLÉMENTAIRE : Vérifier que l'établissement correspond à celui de l'utilisateur connecté
        if (!req.user.isSuperAdmin && enseignant.etablissement !== req.user.etablissement) {
            return res.status(403).json({ 
                error: 'ahaha vous n\'avez pas dit le mot magique' 
            });
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
app.get('/competences-n3', verifyToken, (req, res) => {
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
        // SÉCURITÉ : Vérifier que l'enseignant peut accéder à cet établissement
        if (req.user.type === 'teacher' && !req.user.isSuperAdmin && etablissement !== req.user.etablissement) {
            return res.status(403).json({ 
                error: 'ahaha vous n\'avez pas dit le mot magique   ' 
            });
        }
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

app.post('/competences-n3', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent créer des compétences
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahahah vous n\'avez pas dit le mot magique' });
    }
    
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
app.put('/competences-n3/:id', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent modifier des compétences
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'Hahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { id } = req.params
    const { parent_code, code, nom, enseignant_id } = req.body

    // Si c'est un super admin, autoriser toutes les modifications
    if (req.user.isSuperAdmin) {
        db.run(
            'UPDATE competences_n3 SET parent_code = ?, code = ?, nom = ?, enseignant_id = ? WHERE id = ?',
            [parent_code, code, nom, enseignant_id || null, id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message })
                if (this.changes === 0) return res.status(404).json({ error: 'Compétence non trouvée' })
                res.json({ id: parseInt(id), parent_code, code, nom, enseignant_id: enseignant_id || null })
            }
        )
        return
    }

    // Pour les enseignants normaux, vérifier les permissions d'établissement
    // D'abord récupérer la compétence à modifier pour vérifier les droits
    db.get(`
        SELECT c.*, e.etablissement as createur_etablissement
        FROM competences_n3 c
        LEFT JOIN enseignants e ON c.enseignant_id = e.id
        WHERE c.id = ?
    `, [id], (err, competence) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!competence) return res.status(404).json({ error: 'Compétence non trouvée' })
        
        // Vérifier si l'enseignant peut modifier cette compétence
        const canModify = (
            // Compétence officielle (enseignant_id = null) ET enseignant de l'établissement
            (competence.enseignant_id === null) ||
            // OU c'est sa propre compétence
            (competence.enseignant_id === req.user.id) ||
            // OU compétence créée par quelqu'un du même établissement
            (competence.createur_etablissement && competence.createur_etablissement === req.user.etablissement)
        )
        
        if (!canModify) {
            return res.status(403).json({ 
                error: 'ahaha vous n\'avez pas dit le mot magique' 
            })
        }

        // Effectuer la modification
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
})

// Supprimer une compétence N3
app.delete('/competences-n3/:id', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent supprimer des compétences
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'Hahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { id } = req.params
    
    // Si c'est un super admin, autoriser toutes les suppressions
    if (req.user.isSuperAdmin) {
        db.run('DELETE FROM competences_n3 WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Compétence non trouvée' })
            res.json({ message: 'Compétence supprimée', id: parseInt(id) })
        })
        return
    }

    // Pour les enseignants normaux, vérifier les permissions d'établissement
    // D'abord récupérer la compétence à supprimer pour vérifier les droits
    db.get(`
        SELECT c.*, e.etablissement as createur_etablissement
        FROM competences_n3 c
        LEFT JOIN enseignants e ON c.enseignant_id = e.id
        WHERE c.id = ?
    `, [id], (err, competence) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!competence) return res.status(404).json({ error: 'Compétence non trouvée' })
        
        // Vérifier si l'enseignant peut supprimer cette compétence
        const canDelete = (
            // Compétence officielle (enseignant_id = null) ET enseignant de l'établissement
            (competence.enseignant_id === null) ||
            // OU c'est sa propre compétence
            (competence.enseignant_id === req.user.id) ||
            // OU compétence créée par quelqu'un du même établissement
            (competence.createur_etablissement && competence.createur_etablissement === req.user.etablissement)
        )
        
        if (!canDelete) {
            return res.status(403).json({ 
                error: 'ahaha vous n\'avez pas dit le mot magique' 
            })
        }

        // Effectuer la suppression
        db.run('DELETE FROM competences_n3 WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Compétence non trouvée' })
            res.json({ message: 'Compétence supprimée', id: parseInt(id) })
        })
    })
})



app.get('/eleves', verifyToken, (req, res) => {
    const { classe_id } = req.query
    
    if (req.user.type === 'student') {
        // Pour les élèves : seulement les élèves de leur classe avec données anonymisées
        const classeIdToQuery = req.user.classe_id // Utiliser la classe de l'élève connecté
        
        db.all(
            'SELECT id, classe_id FROM eleves WHERE classe_id = ? ORDER BY id',
            [classeIdToQuery],
            (err, rows) => {
                if (err) return res.status(500).json({ error: err.message })
                
                // Anonymiser les données : garder seulement id et classe_id
                // L'élève connecté garde ses propres informations complètes
                const anonymizedRows = rows.map(eleve => {
                    if (eleve.id === req.user.id) {
                        // Pour l'élève connecté, retourner ses données complètes
                        return {
                            id: req.user.id,
                            prenom: req.user.prenom,
                            nom: req.user.nom,
                            id_moodle: req.user.id_moodle,
                            photo: req.user.photo,
                            classe_id: req.user.classe_id
                            // Pas de token exposé
                        }
                    } else {
                        // Pour les autres élèves, données anonymisées
                        return {
                            id: eleve.id,
                            classe_id: eleve.classe_id
                            // Pas de prenom, nom, id_moodle, photo, token
                        }
                    }
                })
                
                res.json(anonymizedRows)
            }
        )
    } else if (req.user.type === 'teacher') {
        // Pour les enseignants : comportement normal avec toutes les données
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
    } else {
        return res.status(403).json({ error: 'Type d\'utilisateur non autorisé' })
    }
})

// Récupérer les élèves avec le nombre de notes et positionnements
app.get('/eleves/with-counts', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent voir cette information détaillée
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
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

app.post('/eleves', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent créer des élèves
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
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
app.put('/eleves/:id', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent modifier des élèves
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { id } = req.params
    const { nom, prenom, moodle_id, classe_id, photo, token } = req.body

    // Si c'est un super admin, autoriser toutes les modifications
    if (req.user.isSuperAdmin) {
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
        return
    }

    // Pour les enseignants normaux, vérifier l'établissement
    // Vérifier que l'élève appartient à une classe de l'établissement de l'enseignant
    db.get(`
        SELECT e.*, c.nom as classe_nom, ref.etablissement as referent_etablissement
        FROM eleves e
        JOIN classes c ON e.classe_id = c.id
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        WHERE e.id = ?
    `, [id], (err, eleve) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!eleve) return res.status(404).json({ error: 'Élève non trouvé' })
        
        // Si pas d'établissement via le référent, chercher via un enseignant associé
        if (!eleve.referent_etablissement) {
            db.get(`
                SELECT e_ens.etablissement
                FROM enseignants e_ens
                JOIN enseignant_classes ec ON e_ens.id = ec.enseignant_id
                WHERE ec.classe_id = ?
                LIMIT 1
            `, [eleve.classe_id], (err2, enseignantAssocie) => {
                if (err2) return res.status(500).json({ error: err2.message })
                
                // Utiliser l'établissement de l'enseignant associé s'il existe
                eleve.referent_etablissement = enseignantAssocie ? enseignantAssocie.etablissement : null;
                
                // Vérifier si l'enseignant peut modifier cet élève
                const canModify = eleve.referent_etablissement === req.user.etablissement
                
                if (!canModify) {
                    return res.status(403).json({ 
                        error: 'ahaha vous n\'avez pas dit le mot magique' 
                    })
                }

                // Effectuer la modification
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
        } else {
            // Vérifier si l'enseignant peut modifier cet élève
            const canModify = eleve.referent_etablissement === req.user.etablissement
            
            if (!canModify) {
                return res.status(403).json({ 
                    error: 'ahaha vous n\'avez pas dit le mot magique' 
                })
            }

            // Effectuer la modification
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
        }
    })
})

// Supprimer un élève
app.delete('/eleves/:id', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent supprimer des élèves
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
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
app.post('/eleves/:id/regenerate-token', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent régénérer les tokens d'élèves
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
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
app.get('/enseignants', verifyToken, (req, res) => {
    if (req.user.type === 'student') {
        // Pour les élèves : seulement les enseignants de leur établissement, sans tokens
        if (!req.user.etablissement) {
            return res.status(403).json({ 
                error: 'Impossible de déterminer votre établissement',
                details: 'Votre classe n\'a pas de référent défini ou le référent n\'a pas d\'établissement. Contactez l\'administrateur.'
            })
        }
        
        // Récupérer les enseignants de l'établissement sans les tokens
        db.all(
            'SELECT id, id_moodle, nom, prenom, photo, etablissement, referent FROM enseignants WHERE etablissement = ? ORDER BY nom, prenom',
            [req.user.etablissement],
            (err, rows) => {
                if (err) return res.status(500).json({ error: err.message })
                res.json(rows)
            }
        )
    } else if (req.user.type === 'teacher') {
        // Pour les enseignants
        if (req.user.isSuperAdmin) {
            // Super admin : voir tous les enseignants avec tous les détails
            // Note: Le super-admin peut optionnellement filtrer par établissement via query param
            const { etablissement: filterEtablissement } = req.query
            let query = 'SELECT * FROM enseignants'
            let params = []
            
            if (filterEtablissement) {
                query += ' WHERE etablissement = ?'
                params.push(filterEtablissement)
            }
            
            query += ' ORDER BY nom, prenom'
            
            db.all(query, params, (err, rows) => {
                if (err) return res.status(500).json({ error: err.message })
                res.json(rows)
            })
        } else {
            // Enseignant normal : seulement les enseignants de son établissement (récupéré via verifyToken)
            if (!req.user.etablissement) {
                return res.status(403).json({ error: 'Impossible de déterminer votre établissement' })
            }
            
            db.all(
                'SELECT * FROM enseignants WHERE etablissement = ? ORDER BY nom, prenom',
                [req.user.etablissement],
                (err, rows) => {
                    if (err) return res.status(500).json({ error: err.message })
                    res.json(rows)
                }
            )
        }
    } else {
        return res.status(403).json({ error: 'Type d\'utilisateur non autorisé' })
    }
})

// Récupérer un enseignant par ID
app.get('/enseignants/:id', verifyToken, (req, res) => {
    const { id } = req.params
    
    if (req.user.type === 'student') {
        // Pour les élèves : seulement si l'enseignant est de leur établissement, sans token
        if (!req.user.etablissement) {
            return res.status(403).json({ error: 'Impossible de déterminer votre établissement' })
        }
        
        // Récupérer l'enseignant seulement s'il est du même établissement
        db.get(
            'SELECT id, id_moodle, nom, prenom, photo, etablissement, referent FROM enseignants WHERE id = ? AND etablissement = ?',
            [id, req.user.etablissement],
            (err, row) => {
                if (err) return res.status(500).json({ error: err.message })
                if (!row) return res.status(404).json({ error: 'Enseignant non trouvé ou non accessible' })
                res.json(row)
            }
        )
    } else if (req.user.type === 'teacher') {
        if (req.user.isSuperAdmin) {
            // Super admin : accès à tous les enseignants avec tous les détails
            db.get('SELECT * FROM enseignants WHERE id = ?', [id], (err, row) => {
                if (err) return res.status(500).json({ error: err.message })
                if (!row) return res.status(404).json({ error: 'Enseignant non trouvé' })
                res.json(row)
            })
        } else {
            // Enseignant normal : seulement les enseignants de son établissement
            db.get('SELECT * FROM enseignants WHERE id = ? AND etablissement = ?', [id, req.user.etablissement], (err, row) => {
                if (err) return res.status(500).json({ error: err.message })
                if (!row) return res.status(404).json({ error: 'Enseignant non trouvé ou non accessible' })
                res.json(row)
            })
        }
    } else {
        return res.status(403).json({ error: 'Type d\'utilisateur non autorisé' })
    }
})

// Ajouter un enseignant
app.post('/enseignants', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent créer d'autres enseignants
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { id_moodle, nom, prenom, photo, etablissement, referent } = req.body
    
    // Si c'est un super admin, autoriser la création dans n'importe quel établissement
    if (req.user.isSuperAdmin) {
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
        return
    }

    // Pour les enseignants normaux, seuls les référents peuvent créer des enseignants
    if (!req.user.referent) {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }

    // Le référent ne peut créer des enseignants que dans son établissement
    if (etablissement !== req.user.etablissement) {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }

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
app.put('/enseignants/:id', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent modifier des enseignants
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    const { id } = req.params
    const { id_moodle, nom, prenom, photo, etablissement, token, referent } = req.body

    // Si c'est un super admin, autoriser toutes les modifications
    if (req.user.isSuperAdmin) {
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
        return
    }

    // Pour les enseignants normaux, seuls les référents peuvent modifier d'autres enseignants
    if (!req.user.referent) {
        // Un enseignant normal ne peut modifier que son propre profil
        if (parseInt(id) !== req.user.id) {
            return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
        }
    }

    // D'abord récupérer l'enseignant à modifier
    db.get('SELECT * FROM enseignants WHERE id = ?', [id], (err, enseignant) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!enseignant) return res.status(404).json({ error: 'Enseignant non trouvé' })
        
        // Vérifier les permissions selon le rôle
        const canModify = req.user.referent 
            ? // Référent : peut modifier tous les enseignants de son établissement
              enseignant.etablissement === req.user.etablissement
            : // Enseignant normal : seulement son propre profil
              parseInt(id) === req.user.id
        
        if (!canModify) {
            const errorMsg = req.user.referent
                ? 'Accès refusé : vous ne pouvez modifier que les enseignants de votre établissement'
                : 'Accès refusé : vous ne pouvez modifier que votre propre profil'
            return res.status(403).json({ error: errorMsg })
        }

        // SÉCURITÉ : Empêcher le changement d'établissement pour les non-super-admins
        if (!req.user.isSuperAdmin && etablissement !== enseignant.etablissement) {
            return res.status(403).json({ 
                error: 'ahaha vous n\'avez pas dit le mot magique' 
            });
        }

        // Effectuer la modification
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
})

// Supprimer un enseignant
app.delete('/enseignants/:id', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent supprimer des enseignants
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { id } = req.params

    // Si c'est un super admin, autoriser toutes les suppressions
    if (req.user.isSuperAdmin) {
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
        return
    }

    // Pour les enseignants normaux, seuls les référents peuvent supprimer des enseignants
    if (!req.user.referent) {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }

    // D'abord récupérer l'enseignant à supprimer pour vérifier l'établissement
    db.get('SELECT * FROM enseignants WHERE id = ?', [id], (err, enseignant) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!enseignant) return res.status(404).json({ error: 'Enseignant non trouvé' })
        
        // Le référent ne peut supprimer que les enseignants de son établissement
        if (enseignant.etablissement !== req.user.etablissement) {
            return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
        }

        // Effectuer la suppression
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
})

// Régénérer le token d'un enseignant
app.post('/enseignants/:id/regenerate-token', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent régénérer des tokens
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { id } = req.params

    // Si c'est un super admin, autoriser la régénération pour tous
    if (req.user.isSuperAdmin) {
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
        return
    }

    // Pour les enseignants normaux, seuls les référents peuvent régénérer des tokens d'autres enseignants
    if (!req.user.referent) {
        // Un enseignant normal ne peut régénérer que son propre token
        if (parseInt(id) !== req.user.id) {
            return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
        }
    }

    // D'abord récupérer l'enseignant pour vérifier l'établissement
    db.get('SELECT * FROM enseignants WHERE id = ?', [id], (err, enseignant) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!enseignant) return res.status(404).json({ error: 'Enseignant non trouvé' })
        
        // Vérifier les permissions selon le rôle
        const canRegenerate = req.user.referent 
            ? // Référent : peut régénérer les tokens des enseignants de son établissement
              enseignant.etablissement === req.user.etablissement
            : // Enseignant normal : seulement son propre token
              parseInt(id) === req.user.id
        
        if (!canRegenerate) {
            const errorMsg = req.user.referent
                ? 'Accès refusé : vous ne pouvez régénérer que les tokens des enseignants de votre établissement'
                : 'Accès refusé : vous ne pouvez régénérer que votre propre token'
            return res.status(403).json({ error: errorMsg })
        }

        // Effectuer la régénération
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
})

// Routes pour l'association enseignant-classe
// Récupérer les classes d'un enseignant
app.get('/enseignants/:id/classes', verifyToken, (req, res) => {
    const { id } = req.params
    
    if (req.user.type === 'student') {
        // Pour les élèves : seulement si l'enseignant est de leur établissement
        if (!req.user.etablissement) {
            return res.status(403).json({ error: 'Impossible de déterminer votre établissement' })
        }
        
        // Vérifier que l'enseignant est du même établissement
        db.get('SELECT etablissement FROM enseignants WHERE id = ?', [id], (err, enseignant) => {
            if (err) return res.status(500).json({ error: err.message })
            if (!enseignant || enseignant.etablissement !== req.user.etablissement) {
                return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' })
            }
            
            // Récupérer les classes de l'enseignant
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
    } else if (req.user.type === 'teacher') {
        if (req.user.isSuperAdmin) {
            // Super admin : accès à toutes les classes de tous les enseignants
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
        } else {
            // Enseignant normal : seulement si l'enseignant demandé est du même établissement
            db.get('SELECT etablissement FROM enseignants WHERE id = ?', [id], (err, enseignant) => {
                if (err) return res.status(500).json({ error: err.message })
                if (!enseignant) return res.status(404).json({ error: 'Enseignant non trouvé' })
                
                if (enseignant.etablissement !== req.user.etablissement) {
                    return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' })
                }
                
                // Récupérer les classes de l'enseignant
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
        }
    } else {
        return res.status(403).json({ error: 'Type d\'utilisateur non autorisé' })
    }
})

// Récupérer les enseignants d'une classe
app.get('/classes/:id/enseignants', verifyToken, (req, res) => {
    const { id } = req.params
    
    if (req.user.type === 'student') {
        // Pour les élèves : seulement si la classe est de leur établissement, sans tokens
        if (!req.user.etablissement) {
            return res.status(403).json({ error: 'Impossible de déterminer votre établissement' })
        }
        
        // Correction : si le référent est absent, on vérifie l'établissement via un enseignant associé
        db.get(`
            SELECT c.id, ref.etablissement as classe_etablissement
            FROM classes c
            LEFT JOIN enseignants ref ON c.idReferent = ref.id
            WHERE c.id = ?
        `, [id], (err, classe) => {
            if (err) return res.status(500).json({ error: err.message })
            
            let classeEtab = classe ? classe.classe_etablissement : null;
            
            if (!classeEtab) {
                // Si pas de référent, on cherche un enseignant associé à la classe
                db.get(`
                    SELECT e.etablissement
                    FROM enseignants e
                    JOIN enseignant_classes ec ON e.id = ec.enseignant_id
                    WHERE ec.classe_id = ?
                    LIMIT 1
                `, [id], (err2, enseignantAssocie) => {
                    if (err2) return res.status(500).json({ error: err2.message })
                    
                    classeEtab = enseignantAssocie ? enseignantAssocie.etablissement : null;
                    
                    if (!classeEtab || classeEtab !== req.user.etablissement) {
                        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' })
                    }
                    
                    // Récupérer les enseignants de la classe sans les tokens
                    const query = `
                        SELECT e.id, e.id_moodle, e.nom, e.prenom, e.photo, e.etablissement, e.referent
                        FROM enseignants e
                        JOIN enseignant_classes ec ON e.id = ec.enseignant_id
                        WHERE ec.classe_id = ?
                        ORDER BY e.nom, e.prenom
                    `;
                    
                    db.all(query, [id], (err3, rows) => {
                        if (err3) return res.status(500).json({ error: err3.message })
                        res.json(rows)
                    })
                })
            } else {
                if (classeEtab !== req.user.etablissement) {
                    return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' })
                }
                
                // Récupérer les enseignants de la classe sans les tokens
                const query = `
                    SELECT e.id, e.id_moodle, e.nom, e.prenom, e.photo, e.etablissement, e.referent
                    FROM enseignants e
                    JOIN enseignant_classes ec ON e.id = ec.enseignant_id
                    WHERE ec.classe_id = ?
                    ORDER BY e.nom, e.prenom
                `;
                
                db.all(query, [id], (err4, rows) => {
                    if (err4) return res.status(500).json({ error: err4.message })
                    res.json(rows)
                })
            }
        })
    } else if (req.user.type === 'teacher') {
        if (req.user.isSuperAdmin) {
            // Super admin : accès à tous les enseignants de toutes les classes
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
        } else {
            // Enseignant normal : seulement si la classe est de son établissement
            db.get(`
                SELECT c.id, ref.etablissement as classe_etablissement
                FROM classes c
                LEFT JOIN enseignants ref ON c.idReferent = ref.id
                WHERE c.id = ?
            `, [id], (err, classe) => {
                if (err) return res.status(500).json({ error: err.message })
                if (!classe) return res.status(404).json({ error: 'Classe non trouvée' })
                
                // Si pas d'établissement via le référent, chercher via un enseignant associé
                if (!classe.classe_etablissement) {
                    db.get(`
                        SELECT e.etablissement
                        FROM enseignants e
                        JOIN enseignant_classes ec ON e.id = ec.enseignant_id
                        WHERE ec.classe_id = ?
                        LIMIT 1
                    `, [id], (err2, enseignantAssocie) => {
                        if (err2) return res.status(500).json({ error: err2.message })
                        
                        classe.classe_etablissement = enseignantAssocie ? enseignantAssocie.etablissement : null;
                        
                        if (classe.classe_etablissement !== req.user.etablissement) {
                            return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' })
                        }
                        
                        // Récupérer les enseignants de la classe
                        const query = `
                            SELECT e.* 
                            FROM enseignants e
                            JOIN enseignant_classes ec ON e.id = ec.enseignant_id
                            WHERE ec.classe_id = ?
                            ORDER BY e.nom, e.prenom
                        `
                        
                        db.all(query, [id], (err3, rows) => {
                            if (err3) return res.status(500).json({ error: err3.message })
                            res.json(rows)
                        })
                    })
                } else {
                    if (classe.classe_etablissement !== req.user.etablissement) {
                        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' })
                    }
                    
                    // Récupérer les enseignants de la classe
                    const query = `
                        SELECT e.* 
                        FROM enseignants e
                        JOIN enseignant_classes ec ON e.id = ec.enseignant_id
                        WHERE ec.classe_id = ?
                        ORDER BY e.nom, e.prenom
                    `
                    
                    db.all(query, [id], (err4, rows) => {
                        if (err4) return res.status(500).json({ error: err4.message })
                        res.json(rows)
                    })
                }
            })
        }
    } else {
        return res.status(403).json({ error: 'Type d\'utilisateur non autorisé' })
    }
})

// Associer un enseignant à une classe
app.post('/enseignant-classes', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent gérer les associations
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { enseignant_id, classe_id } = req.body

    // Si c'est un super admin, autoriser toutes les associations
    if (req.user.isSuperAdmin) {
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
        return
    }

    // Pour les enseignants normaux, vérifier que l'enseignant et la classe 
    // appartiennent au même établissement que l'utilisateur connecté
    db.get(`
        SELECT 
            e.id as enseignant_id, 
            e.etablissement as enseignant_etablissement,
            c.id as classe_id,
            ref.etablissement as classe_etablissement
        FROM enseignants e, classes c
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        WHERE e.id = ? AND c.id = ?
    `, [enseignant_id, classe_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message })
        
        if (!row) {
            return res.status(404).json({ error: 'Enseignant ou classe non trouvé' })
        }
        
        // Si pas d'établissement via le référent, chercher via un enseignant associé
        if (!row.classe_etablissement) {
            db.get(`
                SELECT e_ens.etablissement
                FROM enseignants e_ens
                JOIN enseignant_classes ec ON e_ens.id = ec.enseignant_id
                WHERE ec.classe_id = ?
                LIMIT 1
            `, [classe_id], (err2, enseignantAssocie) => {
                if (err2) return res.status(500).json({ error: err2.message })
                
                row.classe_etablissement = enseignantAssocie ? enseignantAssocie.etablissement : null;
                
                // Vérifier que l'enseignant et la classe appartiennent au même établissement que l'utilisateur connecté
                const canAssociate = (
                    row.enseignant_etablissement === req.user.etablissement &&
                    row.classe_etablissement === req.user.etablissement
                )
                
                if (!canAssociate) {
                    return res.status(403).json({ 
                        error: 'ahaha vous n\'avez pas dit le mot magique'
                    })
                }
                
                // Seuls les référents peuvent créer des associations (sauf pour eux-mêmes)
                if (!req.user.referent && enseignant_id !== req.user.id) {
                    return res.status(403).json({ 
                        error: 'ahaha vous n\'avez pas dit le mot magique'
                    })
                }

                // Procéder à l'association
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
        } else {
            // Vérifier que l'enseignant et la classe appartiennent au même établissement que l'utilisateur connecté
            const canAssociate = (
                row.enseignant_etablissement === req.user.etablissement &&
                row.classe_etablissement === req.user.etablissement
            )
            
            if (!canAssociate) {
                return res.status(403).json({ 
                    error: 'ahaha vous n\'avez pas dit le mot magique'
                })
            }
            
            // Seuls les référents peuvent créer des associations (sauf pour eux-mêmes)
            if (!req.user.referent && enseignant_id !== req.user.id) {
                return res.status(403).json({ 
                    error: 'ahaha vous n\'avez pas dit le mot magique'
                })
            }

            // Procéder à l'association
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
        }
    })
})

// Supprimer l'association enseignant-classe
app.delete('/enseignant-classes/:enseignantId/:classeId', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent supprimer des associations
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { enseignantId, classeId } = req.params

    // Si c'est un super admin, autoriser toutes les suppressions
    if (req.user.isSuperAdmin) {
        db.run(
            'DELETE FROM enseignant_classes WHERE enseignant_id = ? AND classe_id = ?',
            [enseignantId, classeId],
            function (err) {
                if (err) return res.status(500).json({ error: err.message })
                if (this.changes === 0) return res.status(404).json({ error: 'Association non trouvée' })
                res.json({ message: 'Association supprimée' })
            }
        )
        return
    }

    // Pour les enseignants normaux, vérifier les permissions avant suppression
    db.get(`
        SELECT 
            e.id as enseignant_id, 
            e.etablissement as enseignant_etablissement,
            c.id as classe_id,
            ref.etablissement as classe_etablissement
        FROM enseignant_classes ec
        JOIN enseignants e ON ec.enseignant_id = e.id
        JOIN classes c ON ec.classe_id = c.id
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        WHERE ec.enseignant_id = ? AND ec.classe_id = ?
    `, [enseignantId, classeId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message })
        
        if (!row) {
            return res.status(404).json({ error: 'Association non trouvée' })
        }
        
        // Vérifier que l'enseignant et la classe appartiennent au même établissement
        const canDelete = (
            row.enseignant_etablissement === req.user.etablissement &&
            row.classe_etablissement === req.user.etablissement
        )
        
        if (!canDelete) {
            return res.status(403).json({ 
                error: 'ahaha vous n\'avez pas dit le mot magique'
            })
        }
        
        // Seuls les référents peuvent supprimer des associations (sauf pour eux-mêmes)
        if (!req.user.referent && parseInt(enseignantId) !== req.user.id) {
            return res.status(403).json({ 
                error: 'ahaha vous n\'avez pas dit le mot magique'
            })
        }

        // Procéder à la suppression
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

app.post('/notes', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent créer des notes
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { eleve_id, competence_code, couleur, date, prof_id, commentaire } = req.body

    // Si c'est un super admin, autoriser toutes les créations
    if (req.user.isSuperAdmin) {
        db.run(
            'INSERT INTO notes (eleve_id, competence_code, couleur, date, prof_id, commentaire) VALUES (?, ?, ?, ?, ?, ?)',
            [eleve_id, competence_code, couleur, date, prof_id, commentaire || null],
            function (err) {
                if (err) return res.status(500).json({ error: err.message })
                res.json({ id: this.lastID, eleve_id, competence_code, couleur, date, prof_id, commentaire })
            }
        )
        return
    }

    // Pour les enseignants normaux, vérifier les permissions
    // Récupérer les informations de l'élève et vérifier les permissions
    db.get(`
        SELECT e.*, c.nom as classe_nom, ref.etablissement as classe_etablissement,
               ec.enseignant_id as is_teacher_of_class
        FROM eleves e
        JOIN classes c ON e.classe_id = c.id
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        LEFT JOIN enseignant_classes ec ON c.id = ec.classe_id AND ec.enseignant_id = ?
        WHERE e.id = ?
    `, [req.user.id, eleve_id], (err, eleve) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!eleve) return res.status(404).json({ error: 'Élève non trouvé' })
        
        // Si pas d'établissement via le référent, chercher via un enseignant associé
        if (!eleve.classe_etablissement) {
            db.get(`
                SELECT e_ens.etablissement
                FROM enseignants e_ens
                JOIN enseignant_classes ec ON e_ens.id = ec.enseignant_id
                WHERE ec.classe_id = ?
                LIMIT 1
            `, [eleve.classe_id], (err2, enseignantAssocie) => {
                if (err2) return res.status(500).json({ error: err2.message })
                
                // Utiliser l'établissement de l'enseignant associé s'il existe
                eleve.classe_etablissement = enseignantAssocie ? enseignantAssocie.etablissement : null;
                
                // Vérifier les permissions selon le rôle
                const canCreate = req.user.referent 
                    ? // Référent : peut créer des notes pour tous les élèves de son établissement
                      eleve.classe_etablissement === req.user.etablissement
                    : // Enseignant normal : seulement pour SES élèves (classes où il enseigne)
                      eleve.is_teacher_of_class !== null
                
                if (!canCreate) {
                    const errorMsg = req.user.referent
                        ? 'Accès refusé : vous ne pouvez créer des notes que pour les élèves de votre établissement'
                        : 'Accès refusé : vous ne pouvez créer des notes que pour vos élèves (classes où vous enseignez)'
                    return res.status(403).json({ error: errorMsg })
                }

                // Créer la note
                db.run(
                    'INSERT INTO notes (eleve_id, competence_code, couleur, date, prof_id, commentaire) VALUES (?, ?, ?, ?, ?, ?)',
                    [eleve_id, competence_code, couleur, date, prof_id, commentaire || null],
                    function (err) {
                        if (err) return res.status(500).json({ error: err.message })
                        res.json({ id: this.lastID, eleve_id, competence_code, couleur, date, prof_id, commentaire })
                    }
                )
            })
        } else {
            // Vérifier les permissions selon le rôle
            const canCreate = req.user.referent 
                ? // Référent : peut créer des notes pour tous les élèves de son établissement
                  eleve.classe_etablissement === req.user.etablissement
                : // Enseignant normal : seulement pour SES élèves (classes où il enseigne)
                  eleve.is_teacher_of_class !== null
            
            if (!canCreate) {
                const errorMsg = req.user.referent
                    ? 'Accès refusé : vous ne pouvez créer des notes que pour les élèves de votre établissement'
                    : 'Accès refusé : vous ne pouvez créer des notes que pour vos élèves (classes où vous enseignent)'
                return res.status(403).json({ error: errorMsg })
            }

            // Créer la note
            db.run(
                'INSERT INTO notes (eleve_id, competence_code, couleur, date, prof_id, commentaire) VALUES (?, ?, ?, ?, ?, ?)',
                [eleve_id, competence_code, couleur, date, prof_id, commentaire || null],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message })
                    res.json({ id: this.lastID, eleve_id, competence_code, couleur, date, prof_id, commentaire })
                }
            )
        }
    })
})

app.get('/notes', verifyToken, (req, res) => {
    // req.user contient maintenant les infos de l'utilisateur authentifié
    
    
    if (req.user.type === 'student') {
        // Pour les élèves : leurs notes complètes + les notes anonymes des autres élèves de leur classe
        // (nécessaire pour calculer la progression relative dans la classe)
        
        if (!req.user.classe_id) {
            return res.status(403).json({ error: 'Impossible de déterminer votre classe' })
        }
        
        db.all(`
            SELECT n.*, 
                   CASE 
                       WHEN n.eleve_id = ? THEN n.id
                       ELSE NULL 
                   END as id,
                   n.eleve_id,
                   n.competence_code,
                   CASE 
                       WHEN n.eleve_id = ? THEN n.couleur
                       ELSE NULL 
                   END as couleur,
                   CASE 
                       WHEN n.eleve_id = ? THEN n.date
                       ELSE NULL 
                   END as date,
                   CASE 
                       WHEN n.eleve_id = ? THEN n.prof_id
                       ELSE NULL 
                   END as prof_id,
                   CASE 
                       WHEN n.eleve_id = ? THEN n.commentaire
                       ELSE NULL 
                   END as commentaire
            FROM notes n
            JOIN eleves e ON n.eleve_id = e.id
            WHERE e.classe_id = ?
        `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.classe_id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message })
            res.json(rows)
        })
    } else if (req.user.type === 'teacher') {
        if (req.user.isSuperAdmin) {
            // Super admin : toutes les notes
            db.all('SELECT * FROM notes', [], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message })
                res.json(rows)
            })
        } else if (req.user.referent) {
            // Référent : toutes les notes des élèves de son établissement
            db.all(`
                SELECT n.*
                FROM notes n
                JOIN eleves e ON n.eleve_id = e.id
                JOIN classes c ON e.classe_id = c.id
                LEFT JOIN enseignants ref ON c.idReferent = ref.id
                LEFT JOIN (
                    SELECT DISTINCT ec.classe_id, e_ens.etablissement
                    FROM enseignant_classes ec
                    JOIN enseignants e_ens ON ec.enseignant_id = e_ens.id
                ) ens_etab ON c.id = ens_etab.classe_id
                WHERE COALESCE(ref.etablissement, ens_etab.etablissement) = ?
            `, [req.user.etablissement], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message })
                res.json(rows)
            })
        } else {
            // Enseignant normal : seulement les notes de SES élèves (classes où il enseigne)
            db.all(`
                SELECT n.*
                FROM notes n
                JOIN eleves e ON n.eleve_id = e.id
                JOIN classes c ON e.classe_id = c.id
                JOIN enseignant_classes ec ON c.id = ec.classe_id
                WHERE ec.enseignant_id = ?
            `, [req.user.id], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message })
                res.json(rows)
            })
        }
    } else {
        return res.status(403).json({ error: 'Type d\'utilisateur non autorisé' })
    }
})

// Modifier une note existante
app.put('/notes/:id', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent modifier des notes
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { id } = req.params
    const { eleve_id, competence_code, couleur, date, prof_id, commentaire } = req.body

    // Si c'est un super admin, autoriser toutes les modifications
    if (req.user.isSuperAdmin) {
        db.run(
            'UPDATE notes SET eleve_id = ?, competence_code = ?, couleur = ?, date = ?, prof_id = ?, commentaire = ? WHERE id = ?',
            [eleve_id, competence_code, couleur, date, prof_id, commentaire || null, id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message })
                if (this.changes === 0) return res.status(404).json({ error: 'Note non trouvée' })
                res.json({ id: parseInt(id), eleve_id, competence_code, couleur, date, prof_id, commentaire })
            }
        )
        return
    }

    // Pour les enseignants normaux, vérifier les permissions strictes
    // Récupérer la note avec les informations de l'élève et de la classe
    db.get(`
        SELECT n.*, e.classe_id, c.nom as classe_nom, ref.etablissement as classe_etablissement,
               ec.enseignant_id as is_teacher_of_class
        FROM notes n
        JOIN eleves e ON n.eleve_id = e.id
        JOIN classes c ON e.classe_id = c.id
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        LEFT JOIN enseignant_classes ec ON c.id = ec.classe_id AND ec.enseignant_id = ?
        WHERE n.id = ?
    `, [req.user.id, id], (err, note) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!note) return res.status(404).json({ error: 'Note non trouvée' })
        
        // Si pas d'établissement via le référent, chercher via un enseignant associé
        if (!note.classe_etablissement) {
            db.get(`
                SELECT e_ens.etablissement
                FROM enseignants e_ens
                JOIN enseignant_classes ec ON e_ens.id = ec.enseignant_id
                WHERE ec.classe_id = ?
                LIMIT 1
            `, [note.classe_id], (err2, enseignantAssocie) => {
                if (err2) return res.status(500).json({ error: err2.message })
                
                note.classe_etablissement = enseignantAssocie ? enseignantAssocie.etablissement : null;
                
                // Vérifier les permissions selon le rôle
                const canModify = req.user.referent 
                    ? // Référent : peut modifier toutes les notes de son établissement
                      note.classe_etablissement === req.user.etablissement
                    : // Enseignant normal : seulement SES notes pour SES élèves
                      note.prof_id === req.user.id && note.is_teacher_of_class !== null
                
                if (!canModify) {
                    const errorMsg = req.user.referent
                        ? 'Accès refusé : vous ne pouvez modifier que les notes des élèves de votre établissement'
                        : 'Accès refusé : vous ne pouvez modifier que vos propres notes pour vos élèves'
                    return res.status(403).json({ error: errorMsg })
                }

                // Effectuer la modification
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
        } else {
            // Vérifier les permissions selon le rôle
            const canModify = req.user.referent 
                ? // Référent : peut modifier toutes les notes de son établissement
                  note.classe_etablissement === req.user.etablissement
                : // Enseignant normal : seulement SES notes pour SES élèves
                  note.prof_id === req.user.id && note.is_teacher_of_class !== null
            
            if (!canModify) {
                const errorMsg = req.user.referent
                    ? 'Accès refusé : vous ne pouvez modifier que les notes des élèves de votre établissement'
                    : 'Accès refusé : vous ne pouvez modifier que vos propres notes pour vos élèves'
                return res.status(403).json({ error: errorMsg })
            }

            // Effectuer la modification
            db.run(
                'UPDATE notes SET eleve_id = ?, competence_code = ?, couleur = ?, date = ?, prof_id = ?, commentaire = ? WHERE id = ?',
                [eleve_id, competence_code, couleur, date, prof_id, commentaire || null, id],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message })
                    if (this.changes === 0) return res.status(404).json({ error: 'Note non trouvée' })
                    res.json({ id: parseInt(id), eleve_id, competence_code, couleur, date, prof_id, commentaire })
                }
            )
        }
    })
})

app.delete('/notes/:id', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent supprimer des notes
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { id } = req.params

    // Si c'est un super admin, autoriser toutes les suppressions
    if (req.user.isSuperAdmin) {
        db.run('DELETE FROM notes WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Note non trouvée' })
            res.json({ message: 'Note supprimée', id: parseInt(id) })
        })
        return
    }

    // Pour les enseignants normaux, vérifier les permissions strictes
    // Récupérer la note avec les informations de l'élève et de la classe
    db.get(`
        SELECT n.*, e.classe_id, c.nom as classe_nom, ref.etablissement as classe_etablissement,
               ec.enseignant_id as is_teacher_of_class
        FROM notes n
        JOIN eleves e ON n.eleve_id = e.id
        JOIN classes c ON e.classe_id = c.id
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        LEFT JOIN enseignant_classes ec ON c.id = ec.classe_id AND ec.enseignant_id = ?
        WHERE n.id = ?
    `, [req.user.id, id], (err, note) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!note) return res.status(404).json({ error: 'Note non trouvée' })
        
        // Si pas d'établissement via le référent, chercher via un enseignant associé
        if (!note.classe_etablissement) {
            db.get(`
                SELECT e_ens.etablissement
                FROM enseignants e_ens
                JOIN enseignant_classes ec ON e_ens.id = ec.enseignant_id
                WHERE ec.classe_id = ?
                LIMIT 1
            `, [note.classe_id], (err2, enseignantAssocie) => {
                if (err2) return res.status(500).json({ error: err2.message })
                
                note.classe_etablissement = enseignantAssocie ? enseignantAssocie.etablissement : null;
                
                // Vérifier les permissions selon le rôle
                const canDelete = req.user.referent 
                    ? // Référent : peut supprimer toutes les notes de son établissement
                      note.classe_etablissement === req.user.etablissement
                    : // Enseignant normal : seulement SES notes pour SES élèves
                      note.prof_id === req.user.id && note.is_teacher_of_class !== null
                
                if (!canDelete) {
                    const errorMsg = req.user.referent
                        ? 'Accès refusé : vous ne pouvez supprimer que les notes des élèves de votre établissement'
                        : 'Accès refusé : vous ne pouvez supprimer que vos propres notes pour vos élèves'
                    return res.status(403).json({ error: errorMsg })
                }

                // Effectuer la suppression
                db.run('DELETE FROM notes WHERE id = ?', [id], function (err) {
                    if (err) return res.status(500).json({ error: err.message })
                    if (this.changes === 0) return res.status(404).json({ error: 'Note non trouvée' })
                    res.json({ message: 'Note supprimée', id: parseInt(id) })
                })
            })
        } else {
            // Vérifier les permissions selon le rôle
            const canDelete = req.user.referent 
                ? // Référent : peut supprimer toutes les notes de son établissement
                  note.classe_etablissement === req.user.etablissement
                : // Enseignant normal : seulement SES notes pour SES élèves
                  note.prof_id === req.user.id && note.is_teacher_of_class !== null
            
            if (!canDelete) {
                const errorMsg = req.user.referent
                    ? 'Accès refusé : vous ne pouvez supprimer que les notes des élèves de votre établissement'
                    : 'Accès refusé : vous ne pouvez supprimer que vos propres notes pour vos élèves'
                return res.status(403).json({ error: errorMsg })
            }

            // Effectuer la suppression
            db.run('DELETE FROM notes WHERE id = ?', [id], function (err) {
                if (err) return res.status(500).json({ error: err.message })
                if (this.changes === 0) return res.status(404).json({ error: 'Note non trouvée' })
                res.json({ message: 'Note supprimée', id: parseInt(id) })
            })
        }
    })
})

// Récupérer toutes les classes
app.get('/classes', verifyToken, (req, res) => {
    if (req.user.type === 'student') {
        // Pour les élèves : seulement leur propre classe
        if (!req.user.classe_id) {
            return res.status(403).json({ 
                error: 'Impossible de déterminer votre classe',
                details: 'Votre compte élève n\'a pas de classe assignée. Contactez l\'administrateur.'
            })
        }
        
        db.get(`
            SELECT c.*, e.prenom as referent_prenom, e.nom as referent_nom 
            FROM classes c 
            LEFT JOIN enseignants e ON c.idReferent = e.id 
            WHERE c.id = ?
        `, [req.user.classe_id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message })
            if (!row) return res.status(404).json({ error: 'Classe non trouvée' })
            res.json([row]) // Retourner un tableau avec un seul élément pour compatibilité
        })
    } else if (req.user.type === 'teacher') {
        if (req.user.isSuperAdmin) {
            // Super admin : toutes les classes
            db.all(`
                SELECT c.*, e.prenom as referent_prenom, e.nom as referent_nom 
                FROM classes c 
                LEFT JOIN enseignants e ON c.idReferent = e.id 
                ORDER BY c.nom
            `, [], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message })
                res.json(rows)
            })
        } else {
            // Enseignant normal : seulement les classes de son établissement
            db.all(`
                SELECT c.*, e.prenom as referent_prenom, e.nom as referent_nom 
                FROM classes c 
                LEFT JOIN enseignants e ON c.idReferent = e.id 
                WHERE e.etablissement = ?
                ORDER BY c.nom
            `, [req.user.etablissement], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message })
                res.json(rows)
            })
        }
    } else {
        return res.status(403).json({ error: 'Type d\'utilisateur non autorisé' })
    }
})

// Récupérer toutes les classes avec le nombre d'élèves
app.get('/classes/with-counts', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent voir les comptages détaillés
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
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
app.post('/classes', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent créer des classes
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { nom, idReferent, creatorTeacherId } = req.body
    
    // Déterminer le référent de la classe
    let referentId = null
    if (req.user.isSuperAdmin) {
        // Super admin peut spécifier n'importe quel référent
        referentId = idReferent || creatorTeacherId || null
    } else if (req.user.referent) {
        // Un référent qui crée une classe devient automatiquement le référent de cette classe
        referentId = req.user.id
    } else {
        // Un enseignant normal ne peut pas créer de classe
        return res.status(403).json({ 
            error: 'Seuls les référents peuvent créer des classes' 
        })
    }
    
    db.run('INSERT INTO classes (nom, idReferent) VALUES (?, ?)', [nom, referentId], function (err) {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ id: this.lastID, nom, idReferent: referentId })
    })
})

// Modifier une classe
app.put('/classes/:id', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent modifier des classes
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { nom, idReferent } = req.body
    const { id } = req.params

    // Si c'est un super admin, autoriser toutes les modifications
    if (req.user.isSuperAdmin) {
        db.run(
            'UPDATE classes SET nom = ?, idReferent = ? WHERE id = ?',
            [nom, idReferent || null, id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message })
                res.json({ id: parseInt(id), nom, idReferent: idReferent || null })
            }
        )
        return
    }

    // Pour les enseignants normaux, vérifier l'établissement
    // D'abord récupérer la classe avec les informations du référent
    db.get(`
        SELECT c.*, ref.etablissement as referent_etablissement
        FROM classes c
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        WHERE c.id = ?
    `, [id], (err, classe) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!classe) return res.status(404).json({ error: 'Classe non trouvée' })
        
        // Vérifier si l'enseignant peut modifier cette classe
        const canModify = (
            // C'est le référent de la classe
            classe.idReferent === req.user.id ||
            // Ou la classe appartient à son établissement
            classe.referent_etablissement === req.user.etablissement
        )
        
        if (!canModify) {
            return res.status(403).json({ 
                error: 'ahaha vous n\'avez pas dit le mot magique' 
            })
        }

        // Effectuer la modification
        db.run(
            'UPDATE classes SET nom = ?, idReferent = ? WHERE id = ?',
            [nom, idReferent || null, id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message })
                res.json({ id: parseInt(id), nom, idReferent: idReferent || null })
            }
        )
    })
})

// Assigner un professeur à une classe
app.put('/classes/:id/assign-teacher', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent assigner des professeurs
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    const { id } = req.params
    const { teacherId } = req.body

    if (!teacherId) {
        return res.status(400).json({ error: 'teacherId est requis' })
    }

    // Si c'est un super admin, autoriser toutes les assignations
    if (req.user.isSuperAdmin) {
        // Vérifier que l'enseignant et la classe existent
        db.get('SELECT id, nom, prenom FROM enseignants WHERE id = ?', [teacherId], (err, teacher) => {
            if (err) return res.status(500).json({ error: err.message })
            if (!teacher) return res.status(404).json({ error: 'Enseignant non trouvé' })

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
        return
    }

    // Pour les enseignants normaux, vérifier l'établissement
    // Récupérer l'enseignant à assigner et la classe avec le référent
    db.get(`
        SELECT 
            e.id as enseignant_id, e.nom, e.prenom, e.etablissement as enseignant_etablissement,
            c.id as classe_id, c.nom as classe_nom, ref.etablissement as classe_etablissement
        FROM enseignants e, classes c
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        WHERE e.id = ? AND c.id = ?
    `, [teacherId, id], (err, data) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!data) return res.status(404).json({ error: 'Enseignant ou classe non trouvé' })
        
        // Vérifier si l'enseignant connecté peut faire cette assignation
        const canAssign = (
            // L'enseignant à assigner est du même établissement
            data.enseignant_etablissement === req.user.etablissement &&
            // ET la classe est de son établissement
            data.classe_etablissement === req.user.etablissement
        )
        
        if (!canAssign) {
            return res.status(403).json({ 
                error: 'ahaha vous n\'avez pas dit le mot magique' 
            })
        }

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
                    message: `${data.prenom} ${data.nom} a été assigné(e) à la classe ${data.classe_nom}`,
                    enseignant_id: teacherId,
                    classe_id: id
                })
            })
        })
    })
})

// Supprimer une classe
app.delete('/classes/:id', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent supprimer des classes
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { id } = req.params
    const { forceDelete } = req.query // Paramètre pour forcer la suppression

    // Fonction pour effectuer la suppression après vérification des permissions
    function proceedWithClassDeletion() {
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
    }

    // Si c'est un super admin, autoriser toutes les suppressions
    if (req.user.isSuperAdmin) {
        return proceedWithClassDeletion();
    }

    // Pour les enseignants normaux, vérifier les permissions sur la classe
    db.get(`
        SELECT c.*, ref.etablissement as classe_etablissement
        FROM classes c
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        WHERE c.id = ?
    `, [id], (err, classe) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!classe) return res.status(404).json({ error: 'Classe non trouvée' })
        
        // Si pas d'établissement via le référent, chercher via un enseignant associé
        if (!classe.classe_etablissement) {
            db.get(`
                SELECT e_ens.etablissement
                FROM enseignants e_ens
                JOIN enseignant_classes ec ON e_ens.id = ec.enseignant_id
                WHERE ec.classe_id = ?
                LIMIT 1
            `, [id], (err2, enseignantAssocie) => {
                if (err2) return res.status(500).json({ error: err2.message })
                
                classe.classe_etablissement = enseignantAssocie ? enseignantAssocie.etablissement : null;
                
                // Vérifier les permissions selon le rôle
                const canDelete = req.user.referent 
                    ? // Référent : peut supprimer les classes de son établissement OU les classes orphelines (sans établissement)
                      classe.classe_etablissement === req.user.etablissement || classe.classe_etablissement === null
                    : // Enseignant normal : ne peut pas supprimer de classes
                      false
                
                if (!canDelete) {
                    const errorMsg = req.user.referent
                        ? 'Accès refusé : vous ne pouvez supprimer que les classes de votre établissement'
                        : 'Accès refusé : seuls les référents peuvent supprimer des classes'
                    return res.status(403).json({ error: errorMsg })
                }

                proceedWithClassDeletion();
            })
        } else {
            // Vérifier les permissions selon le rôle
            const canDelete = req.user.referent 
                ? // Référent : peut supprimer les classes de son établissement OU les classes orphelines (sans établissement)
                  classe.classe_etablissement === req.user.etablissement || classe.classe_etablissement === null
                : // Enseignant normal : ne peut pas supprimer de classes
                  false
            
            if (!canDelete) {
                const errorMsg = req.user.referent
                    ? 'Accès refusé : vous ne pouvez supprimer que les classes de votre établissement'
                    : 'Accès refusé : seuls les référents peuvent supprimer des classes'
                return res.status(403).json({ error: errorMsg })
            }

            proceedWithClassDeletion();
        }
    })
})

// Routes pour les positionnements enseignant
// Récupérer tous les positionnements ou filtrer par élève et compétence
app.get('/positionnements', verifyToken, (req, res) => {
    const { eleve_id, competence_code } = req.query

    if (req.user.type === 'student') {
        // Pour les élèves : seulement leurs propres positionnements
        let query = 'SELECT * FROM positionnements_enseignant WHERE eleve_id = ?'
        let params = [req.user.id]

        if (competence_code) {
            query += ' AND competence_code = ?'
            params.push(competence_code)
        }

        db.all(query, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message })
            res.json(rows)
        })
    } else if (req.user.type === 'teacher') {
        if (req.user.isSuperAdmin) {
            // Super admin : tous les positionnements avec filtres optionnels
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
        } else if (req.user.referent) {
            // Référent : tous les positionnements des élèves de son établissement
            let query = `
                SELECT p.*
                FROM positionnements_enseignant p
                JOIN eleves e ON p.eleve_id = e.id
                JOIN classes c ON e.classe_id = c.id
                LEFT JOIN enseignants ref ON c.idReferent = ref.id
                WHERE ref.etablissement = ?
            `
            let params = [req.user.etablissement]

            if (eleve_id && competence_code) {
                query += ' AND p.eleve_id = ? AND p.competence_code = ?'
                params.push(eleve_id, competence_code)
            } else if (eleve_id) {
                query += ' AND p.eleve_id = ?'
                params.push(eleve_id)
            } else if (competence_code) {
                query += ' AND p.competence_code = ?'
                params.push(competence_code)
            }

            db.all(query, params, (err, rows) => {
                if (err) return res.status(500).json({ error: err.message })
                res.json(rows)
            })
        } else {
            // Enseignant normal : seulement les positionnements de SES élèves (classes où il enseigne)
            let query = `
                SELECT p.*
                FROM positionnements_enseignant p
                JOIN eleves e ON p.eleve_id = e.id
                JOIN classes c ON e.classe_id = c.id
                JOIN enseignant_classes ec ON c.id = ec.classe_id
                WHERE ec.enseignant_id = ?
            `
            let params = [req.user.id]

            if (eleve_id && competence_code) {
                query += ' AND p.eleve_id = ? AND p.competence_code = ?'
                params.push(eleve_id, competence_code)
            } else if (eleve_id) {
                query += ' AND p.eleve_id = ?'
                params.push(eleve_id)
            } else if (competence_code) {
                query += ' AND p.competence_code = ?'
                params.push(competence_code)
            }

            db.all(query, params, (err, rows) => {
                if (err) return res.status(500).json({ error: err.message })
                res.json(rows)
            })
        }
    } else {
        return res.status(403).json({ error: 'Type d\'utilisateur non autorisé' })
    }
})

// Récupérer les positionnements pour un élève
app.get('/positionnements/eleve/:eleveId', verifyToken, (req, res) => {
    const { eleveId } = req.params

    if (req.user.type === 'student') {
        // Pour les élèves : seulement leurs propres positionnements
        if (parseInt(eleveId) !== req.user.id) {
            return res.status(403).json({ error: 'ahahah, vous n\'avez pas dit le mot magique' })
        }
        
        db.all(
            'SELECT * FROM positionnements_enseignant WHERE eleve_id = ?',
            [eleveId],
            (err, rows) => {
                if (err) return res.status(500).json({ error: err.message })
                res.json(rows)
            }
        )
    } else if (req.user.type === 'teacher') {
        if (req.user.isSuperAdmin) {
            // Super admin : tous les positionnements de l'élève
            db.all(
                'SELECT * FROM positionnements_enseignant WHERE eleve_id = ?',
                [eleveId],
                (err, rows) => {
                    if (err) return res.status(500).json({ error: err.message })
                    res.json(rows)
                }
            )
        } else {
            // Vérifier que l'enseignant peut accéder aux positionnements de cet élève
            db.get(`
                SELECT e.*, c.nom as classe_nom, ref.etablissement as classe_etablissement,
                       ec.enseignant_id as is_teacher_of_class
                FROM eleves e
                JOIN classes c ON e.classe_id = c.id
                LEFT JOIN enseignants ref ON c.idReferent = ref.id
                LEFT JOIN enseignant_classes ec ON c.id = ec.classe_id AND ec.enseignant_id = ?
                WHERE e.id = ?
            `, [req.user.id, eleveId], (err, eleve) => {
                if (err) return res.status(500).json({ error: err.message })
                if (!eleve) return res.status(404).json({ error: 'Élève non trouvé' })
                
                // Vérifier les permissions selon le rôle
                const canAccess = req.user.referent 
                    ? // Référent : peut voir les positionnements de tous les élèves de son établissement
                      eleve.classe_etablissement === req.user.etablissement
                    : // Enseignant normal : seulement SES élèves (classes où il enseigne)
                      eleve.is_teacher_of_class !== null
                
                if (!canAccess) {
                    const errorMsg = req.user.referent
                        ? 'Accès refusé : vous ne pouvez voir que les positionnements des élèves de votre établissement'
                        : 'Accès refusé : vous ne pouvez voir que les positionnements de vos élèves'
                    return res.status(403).json({ error: errorMsg })
                }

                // Récupérer les positionnements
                db.all(
                    'SELECT * FROM positionnements_enseignant WHERE eleve_id = ?',
                    [eleveId],
                    (err, rows) => {
                        if (err) return res.status(500).json({ error: err.message })
                        res.json(rows)
                    }
                )
            })
        }
    } else {
        return res.status(403).json({ error: 'Type d\'utilisateur non autorisé' })
    }
})

// Ajouter ou mettre à jour un positionnement
app.post('/positionnements', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent créer des positionnements
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { eleve_id, competence_code, couleur, prof_id } = req.body
    const date = new Date().toISOString()

    // Si c'est un super admin, autoriser toutes les créations
    if (req.user.isSuperAdmin) {
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
        return
    }

    // Pour les enseignants normaux, vérifier les permissions
    // Récupérer les informations de l'élève et vérifier les permissions
    db.get(`
        SELECT e.*, c.nom as classe_nom, ref.etablissement as classe_etablissement,
               ec.enseignant_id as is_teacher_of_class
        FROM eleves e
        JOIN classes c ON e.classe_id = c.id
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        LEFT JOIN enseignant_classes ec ON c.id = ec.classe_id AND ec.enseignant_id = ?
        WHERE e.id = ?
    `, [req.user.id, eleve_id], (err, eleve) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!eleve) return res.status(404).json({ error: 'Élève non trouvé' })
        
        // Vérifier les permissions selon le rôle
        const canCreate = req.user.referent 
            ? // Référent : peut créer des positionnements pour tous les élèves de son établissement
              eleve.classe_etablissement === req.user.etablissement
            : // Enseignant normal : seulement pour SES élèves (classes où il enseigne)
              eleve.is_teacher_of_class !== null
        
        if (!canCreate) {
            const errorMsg = req.user.referent
                ? 'Accès refusé : vous ne pouvez créer des positionnements que pour les élèves de votre établissement'
                : 'Accès refusé : vous ne pouvez créer des positionnements que pour vos élèves (classes où vous enseignez)'
            return res.status(403).json({ error: errorMsg })
        }

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
})

// Supprimer un positionnement
app.delete('/positionnements/:id', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent supprimer des positionnements
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { id } = req.params

    // Si c'est un super admin, autoriser toutes les suppressions
    if (req.user.isSuperAdmin) {
        db.run('DELETE FROM positionnements_enseignant WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message })
            if (this.changes === 0) return res.status(404).json({ error: 'Positionnement non trouvé' })
            res.status(204).end()
        })
        return
    }

    // Pour les enseignants normaux, vérifier les permissions strictes
    // Récupérer le positionnement avec les informations de l'élève et de la classe
    db.get(`
        SELECT p.*, e.classe_id, c.nom as classe_nom, ref.etablissement as classe_etablissement,
               ec.enseignant_id as is_teacher_of_class
        FROM positionnements_enseignant p
        JOIN eleves e ON p.eleve_id = e.id
        JOIN classes c ON e.classe_id = c.id
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        LEFT JOIN enseignant_classes ec ON c.id = ec.classe_id AND ec.enseignant_id = ?
        WHERE p.id = ?
    `, [req.user.id, id], (err, positionnement) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!positionnement) return res.status(404).json({ error: 'Positionnement non trouvé' })
        
        // Si pas d'établissement via le référent, chercher via un enseignant associé
        if (!positionnement.classe_etablissement) {
            db.get(`
                SELECT e_ens.etablissement
                FROM enseignants e_ens
                JOIN enseignant_classes ec ON e_ens.id = ec.enseignant_id
                WHERE ec.classe_id = ?
                LIMIT 1
            `, [positionnement.classe_id], (err2, enseignantAssocie) => {
                if (err2) return res.status(500).json({ error: err2.message })
                
                positionnement.classe_etablissement = enseignantAssocie ? enseignantAssocie.etablissement : null;
                
                // Vérifier les permissions selon le rôle
                const canDelete = req.user.referent 
                    ? // Référent : peut supprimer tous les positionnements de son établissement
                      positionnement.classe_etablissement === req.user.etablissement
                    : // Enseignant normal : seulement SES positionnements pour SES élèves
                      positionnement.prof_id === req.user.id && positionnement.is_teacher_of_class !== null
                
                if (!canDelete) {
                    const errorMsg = req.user.referent
                        ? 'Accès refusé : vous ne pouvez supprimer que les positionnements des élèves de votre établissement'
                        : 'Accès refusé : vous ne pouvez supprimer que vos propres positionnements pour vos élèves'
                    return res.status(403).json({ error: errorMsg })
                }

                // Effectuer la suppression
                db.run('DELETE FROM positionnements_enseignant WHERE id = ?', [id], function (err) {
                    if (err) return res.status(500).json({ error: err.message })
                    if (this.changes === 0) return res.status(404).json({ error: 'Positionnement non trouvé' })
                    res.status(204).end()
                })
            })
        } else {
            // Vérifier les permissions selon le rôle
            const canDelete = req.user.referent 
                ? // Référent : peut supprimer tous les positionnements de son établissement
                  positionnement.classe_etablissement === req.user.etablissement
                : // Enseignant normal : seulement SES positionnements pour SES élèves
                  positionnement.prof_id === req.user.id && positionnement.is_teacher_of_class !== null
            
            if (!canDelete) {
                const errorMsg = req.user.referent
                    ? 'Accès refusé : vous ne pouvez supprimer que les positionnements des élèves de votre établissement'
                    : 'Accès refusé : vous ne pouvez supprimer que vos propres positionnements pour vos élèves'
                return res.status(403).json({ error: errorMsg })
            }

            // Effectuer la suppression
            db.run('DELETE FROM positionnements_enseignant WHERE id = ?', [id], function (err) {
                if (err) return res.status(500).json({ error: err.message })
                if (this.changes === 0) return res.status(404).json({ error: 'Positionnement non trouvé' })
                res.status(204).end()
            })
        }
    })
})

// Route pour récupérer les élèves d'une classe avec leurs statistiques d'évaluations
app.get('/eleves/with-evaluations/:classeId', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent accéder à ces statistiques détaillées
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const classeId = req.params.classeId

    if (req.user.isSuperAdmin) {
        // Super admin : accès à toutes les classes avec possibilité de filtrage optionnel
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
    } else {
        // Enseignant normal : seulement si la classe est de son établissement
        db.get(`
            SELECT c.id, ref.etablissement as classe_etablissement
            FROM classes c
            LEFT JOIN enseignants ref ON c.idReferent = ref.id
            WHERE c.id = ?
        `, [classeId], (err, classe) => {
            if (err) return res.status(500).json({ error: err.message })
            if (!classe) return res.status(404).json({ error: 'Classe non trouvée' })
            
            if (classe.classe_etablissement !== req.user.etablissement) {
                return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' })
            }

            // Compter seulement les évaluations/positionnements de son établissement
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
                  AND (n.prof_id IS NULL OR n.prof_id IN (SELECT id FROM enseignants WHERE etablissement = ?))
                LEFT JOIN positionnements_enseignant p ON e.id = p.eleve_id 
                  AND (p.prof_id IS NULL OR p.prof_id IN (SELECT id FROM enseignants WHERE etablissement = ?))
                WHERE e.classe_id = ?
                GROUP BY e.id, e.prenom, e.nom, e.id_moodle, e.photo, e.classe_id
                ORDER BY e.nom, e.prenom
            `
            const params = [req.user.etablissement, req.user.etablissement, classeId]

            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('Erreur lors de la récupération des élèves avec évaluations:', err)
                    return res.status(500).json({ error: err.message })
                }
                res.json(rows)
            })
        })
    }
})

// Route pour supprimer toutes les évaluations d'un élève
app.delete('/eleves/:id/evaluations', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent supprimer des évaluations
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const eleveId = req.params.id

    // Si c'est un super admin, autoriser toutes les suppressions
    if (req.user.isSuperAdmin) {
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
        return
    }

    // Pour les enseignants normaux, vérifier les permissions sur l'élève
    db.get(`
        SELECT e.*, c.nom as classe_nom, ref.etablissement as classe_etablissement,
               ec.enseignant_id as is_teacher_of_class
        FROM eleves e
        JOIN classes c ON e.classe_id = c.id
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        LEFT JOIN enseignant_classes ec ON c.id = ec.classe_id AND ec.enseignant_id = ?
        WHERE e.id = ?
    `, [req.user.id, eleveId], (err, eleve) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!eleve) return res.status(404).json({ error: 'Élève non trouvé' })
        
        // Si pas d'établissement via le référent, chercher via un enseignant associé
        if (!eleve.classe_etablissement) {
            db.get(`
                SELECT e_ens.etablissement
                FROM enseignants e_ens
                JOIN enseignant_classes ec ON e_ens.id = ec.enseignant_id
                WHERE ec.classe_id = ?
                LIMIT 1
            `, [eleve.classe_id], (err2, enseignantAssocie) => {
                if (err2) return res.status(500).json({ error: err2.message })
                
                eleve.classe_etablissement = enseignantAssocie ? enseignantAssocie.etablissement : null;
                
                // Vérifier les permissions selon le rôle
                const canDelete = req.user.referent 
                    ? // Référent : peut supprimer les évaluations de tous les élèves de son établissement
                      eleve.classe_etablissement === req.user.etablissement
                    : // Enseignant normal : seulement SES élèves (classes où il enseigne)
                      eleve.is_teacher_of_class !== null
                
                if (!canDelete) {
                    const errorMsg = req.user.referent
                        ? 'Accès refusé : vous ne pouvez supprimer que les évaluations des élèves de votre établissement'
                        : 'Accès refusé : vous ne pouvez supprimer que les évaluations de vos élèves'
                    return res.status(403).json({ error: errorMsg })
                }

                // Effectuer la suppression
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
        } else {
            // Vérifier les permissions selon le rôle
            const canDelete = req.user.referent 
                ? // Référent : peut supprimer les évaluations de tous les élèves de son établissement
                  eleve.classe_etablissement === req.user.etablissement
                : // Enseignant normal : seulement SES élèves (classes où il enseigne)
                  eleve.is_teacher_of_class !== null
            
            if (!canDelete) {
                const errorMsg = req.user.referent
                    ? 'Accès refusé : vous ne pouvez supprimer que les évaluations des élèves de votre établissement'
                    : 'Accès refusé : vous ne pouvez supprimer que les évaluations de vos élèves'
                return res.status(403).json({ error: errorMsg })
            }

            // Effectuer la suppression
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
        }
    })
})

// Route pour importer des évaluations par CSV
app.post('/evaluations/import', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent importer des évaluations
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    
    const { id_moodle, prenom, nom, classe_id, evaluations } = req.body

    if (!id_moodle || !classe_id || !evaluations || !Array.isArray(evaluations)) {
        return res.status(400).json({ error: 'Données manquantes' })
    }

    // Convertir id_moodle en nombre pour s'assurer de la compatibilité
    const idMoodleNum = parseInt(id_moodle)
    const classeIdNum = parseInt(classe_id)

    // Si c'est un super admin, autoriser tous les imports
    if (req.user.isSuperAdmin) {
        processImport()
        return
    }

    // Pour les enseignants normaux, vérifier les permissions sur la classe
    db.get(`
        SELECT c.*, ref.etablissement as classe_etablissement,
               ec.enseignant_id as is_teacher_of_class
        FROM classes c
        LEFT JOIN enseignants ref ON c.idReferent = ref.id
        LEFT JOIN enseignant_classes ec ON c.id = ec.classe_id AND ec.enseignant_id = ?
        WHERE c.id = ?
    `, [req.user.id, classeIdNum], (err, classe) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!classe) return res.status(404).json({ error: 'Classe non trouvée' })
        
        // Vérifier les permissions selon le rôle
        const canImport = req.user.referent 
            ? // Référent : peut importer pour toutes les classes de son établissement
              classe.classe_etablissement === req.user.etablissement
            : // Enseignant normal : seulement pour SES classes (où il enseigne)
              classe.is_teacher_of_class !== null
        
        if (!canImport) {
            const errorMsg = req.user.referent
                ? 'Accès refusé : vous ne pouvez importer des évaluations que pour les classes de votre établissement'
                : 'Accès refusé : vous ne pouvez importer des évaluations que pour vos classes'
            return res.status(403).json({ error: errorMsg })
        }

        processImport()
    })

    function processImport() {

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
    } // Fermeture de processImport()
})

// Route pour exporter les évaluations en CSV
app.get('/evaluations/export/:classeId', verifyToken, (req, res) => {
    // Seuls les enseignants peuvent exporter des évaluations
    if (req.user.type !== 'teacher') {
        return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' });
    }
    const classeId = req.params.classeId

    if (req.user.isSuperAdmin) {
        // Super admin : accès à toutes les classes
        exportClassEvaluations()
    } else if (req.user.referent) {
        // Référent : vérifier que la classe est de son établissement
        db.get(`
            SELECT c.id, ref.etablissement as classe_etablissement
            FROM classes c
            LEFT JOIN enseignants ref ON c.idReferent = ref.id
            WHERE c.id = ?
        `, [classeId], (err, classe) => {
            if (err) return res.status(500).json({ error: err.message })
            if (!classe) return res.status(404).json({ error: 'Classe non trouvée' })
            
            if (classe.classe_etablissement !== req.user.etablissement) {
                return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' })
            }

            exportClassEvaluations()
        })
    } else {
        // Enseignant normal : vérifier qu'il enseigne dans cette classe
        db.get(`
            SELECT c.*, ref.etablissement as classe_etablissement,
                   ec.enseignant_id as is_teacher_of_class
            FROM classes c
            LEFT JOIN enseignants ref ON c.idReferent = ref.id
            LEFT JOIN enseignant_classes ec ON c.id = ec.classe_id AND ec.enseignant_id = ?
            WHERE c.id = ?
        `, [req.user.id, classeId], (err, classe) => {
            if (err) return res.status(500).json({ error: err.message })
            if (!classe) return res.status(404).json({ error: 'Classe non trouvée' })
            
            if (classe.is_teacher_of_class === null) {
                return res.status(403).json({ error: 'ahaha vous n\'avez pas dit le mot magique' })
            }

            exportClassEvaluations()
        })
    }

    function exportClassEvaluations() {
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
    }
})



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
    console.log(`Serveur API également accessible sur http:// IP RESEAU LOCAL :${PORT}`)
    console.log('En attente de requêtes...')
})

process.on('uncaughtException', (err) => {
    console.error('Erreur non attrapée :', err)
})

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesse rejetée non attrapée :', reason)
})