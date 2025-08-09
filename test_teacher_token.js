// Test de l'API d'authentification token enseignant
const fetch = require('node-fetch')

async function testTeacherToken() {
    const token = '85e06dm0q9x02etywwkamyz' // Token d'exemple
    
    try {
        const response = await fetch('http://localhost:3001/auth/verify-teacher-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        })
        
        const data = await response.json()
        console.log('Réponse du serveur:', JSON.stringify(data, null, 2))
        
        if (data.valid) {
            console.log('✅ Token enseignant valide !')
            console.log(`Enseignant: ${data.enseignant.prenom} ${data.enseignant.nom}`)
            console.log(`Établissement: ${data.enseignant.etablissement}`)
            console.log(`Référent: ${data.enseignant.referent ? 'OUI' : 'NON'}`)
            console.log(`Accès admin: ${data.enseignant.referent ? '✅ AUTORISÉ' : '❌ REFUSÉ'}`)
            console.log(`Classes assignées: ${data.enseignant.classes.length}`)
            if (data.enseignant.classes.length > 0) {
                data.enseignant.classes.forEach(classe => {
                    console.log(`  - ${classe.nom} (ID: ${classe.id})`)
                })
            }
        } else {
            console.log('❌ Token enseignant invalide')
        }
    } catch (error) {
        console.error('Erreur:', error.message)
    }
}

// Test avec plusieurs tokens si nécessaire
async function testMultipleTokens() {
    console.log('=== Test Token Enseignant ===')
    await testTeacherToken()
    
    console.log('\n=== Création d\'un enseignant référent de test ===')
    try {
        const response = await fetch('http://localhost:3001/enseignants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_moodle: 999,
                nom: 'Référent',
                prenom: 'Test',
                photo: 'default.jpg',
                etablissement: 'Lycée Test',
                referent: true
            })
        })
        
        const data = await response.json()
        console.log('Enseignant référent créé:', JSON.stringify(data, null, 2))
        
        if (data.token) {
            console.log('\n=== Test du nouveau token référent ===')
            const verifyResponse = await fetch('http://localhost:3001/auth/verify-teacher-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: data.token })
            })
            
            const verifyData = await verifyResponse.json()
            console.log('Vérification:', JSON.stringify(verifyData, null, 2))
            
            if (verifyData.valid) {
                console.log(`🎯 Test réussi! Token référent: ${data.token}`)
                console.log(`🔗 URL de test: http://localhost:5173/?teacher_token=${data.token}`)
            }
        }
    } catch (error) {
        console.error('Erreur lors de la création de l\'enseignant test:', error.message)
    }
}

testMultipleTokens()
