// Test de l'API d'authentification token
const fetch = require('node-fetch')

async function testToken() {
    const token = 'ob5mj7mzwpqh1v4o2war'
    
    try {
        const response = await fetch('http://localhost:3001/auth/verify-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        })
        
        const data = await response.json()
        console.log('Réponse du serveur:', JSON.stringify(data, null, 2))
        
        if (data.valid) {
            console.log('✅ Token valide !')
            console.log(`Élève: ${data.eleve.prenom} ${data.eleve.nom}`)
            console.log(`Classe ID: ${data.eleve.classe_id}`)
        } else {
            console.log('❌ Token invalide')
        }
    } catch (error) {
        console.error('Erreur:', error.message)
    }
}

testToken()
