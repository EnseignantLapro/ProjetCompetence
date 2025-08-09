// Script de test pour créer et tester les permissions des enseignants référents
const fetch = require('node-fetch')

async function createTestReferent() {
    console.log('🧪 === Test des Permissions Enseignants Référents ===\n')
    
    try {
        // 1. Créer un enseignant référent de test
        console.log('1️⃣ Création d\'un enseignant référent...')
        const referentResponse = await fetch('http://localhost:3001/enseignants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_moodle: 999,
                nom: 'Référent',
                prenom: 'Test',
                photo: 'default.jpg',
                etablissement: 'Lycée Test Référent',
                referent: true
            })
        })
        
        const referentData = await referentResponse.json()
        console.log('✅ Enseignant référent créé:', {
            id: referentData.id,
            nom: `${referentData.prenom} ${referentData.nom}`,
            etablissement: referentData.etablissement,
            referent: referentData.referent,
            token: referentData.token
        })
        
        console.log(`🔗 URL de test référent: http://localhost:5173/?teacher_token=${referentData.token}`)
        
        // 2. Créer un enseignant normal pour comparaison
        console.log('\n2️⃣ Création d\'un enseignant normal...')
        const normalResponse = await fetch('http://localhost:3001/enseignants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_moodle: 888,
                nom: 'Normal',
                prenom: 'Test',
                photo: 'default.jpg',
                etablissement: 'Lycée Test Normal',
                referent: false
            })
        })
        
        const normalData = await normalResponse.json()
        console.log('✅ Enseignant normal créé:', {
            id: normalData.id,
            nom: `${normalData.prenom} ${normalData.nom}`,
            etablissement: normalData.etablissement,
            referent: normalData.referent,
            token: normalData.token
        })
        
        console.log(`🔗 URL de test normal: http://localhost:5173/?teacher_token=${normalData.token}`)
        
        // 3. Tester la vérification des tokens
        console.log('\n3️⃣ Test de vérification des tokens...')
        
        // Test référent
        const verifyReferentResponse = await fetch('http://localhost:3001/auth/verify-teacher-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: referentData.token })
        })
        
        const verifyReferentData = await verifyReferentResponse.json()
        if (verifyReferentData.valid) {
            console.log('✅ Token référent valide - Accès admin:', verifyReferentData.enseignant.referent ? 'OUI' : 'NON')
        }
        
        // Test normal
        const verifyNormalResponse = await fetch('http://localhost:3001/auth/verify-teacher-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: normalData.token })
        })
        
        const verifyNormalData = await verifyNormalResponse.json()
        if (verifyNormalData.valid) {
            console.log('✅ Token normal valide - Accès admin:', verifyNormalData.enseignant.referent ? 'OUI' : 'NON')
        }
        
        // 4. Instructions de test
        console.log('\n🎯 === Instructions de Test ===')
        console.log('1. Connectez-vous avec le token référent pour tester :')
        console.log('   • Bouton "Gérer l\'appli" visible à côté de "Déconnexion"')
        console.log('   • Champ établissement grisé et forcé')
        console.log('   • Pas de case "Référent" dans le formulaire')
        console.log('   • Bouton "Suppression interdite" pour soi-même')
        console.log('')
        console.log('2. Connectez-vous avec le token normal pour comparer :')
        console.log('   • Pas de bouton "Gérer l\'appli"')
        console.log('   • Accès limité aux classes assignées seulement')
        console.log('')
        console.log('3. Test en mode SuperAdmin (mode normal) :')
        console.log('   • Accès à toutes les fonctionnalités')
        console.log('   • Peut modifier le statut référent')
        console.log('   • Peut créer des référents')
        
        return {
            referent: { ...referentData, url: `http://localhost:5173/?teacher_token=${referentData.token}` },
            normal: { ...normalData, url: `http://localhost:5173/?teacher_token=${normalData.token}` }
        }
        
    } catch (error) {
        console.error('❌ Erreur lors des tests:', error.message)
        return null
    }
}

// Fonction pour nettoyer les enseignants de test
async function cleanupTestData() {
    console.log('\n🧹 Nettoyage des données de test...')
    
    try {
        // Récupérer tous les enseignants
        const response = await fetch('http://localhost:3001/enseignants')
        const enseignants = await response.json()
        
        // Supprimer les enseignants de test
        for (const enseignant of enseignants) {
            if (enseignant.nom === 'Référent' || enseignant.nom === 'Normal') {
                const deleteResponse = await fetch(`http://localhost:3001/enseignants/${enseignant.id}`, {
                    method: 'DELETE'
                })
                
                if (deleteResponse.ok) {
                    console.log(`✅ Enseignant supprimé: ${enseignant.prenom} ${enseignant.nom}`)
                }
            }
        }
    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error.message)
    }
}

// Exécution du script
async function main() {
    const testData = await createTestReferent()
    
    if (testData) {
        console.log('\n📋 === Résumé des Tests ===')
        console.log('Référent:', testData.referent.url)
        console.log('Normal:', testData.normal.url)
        
        // Proposer le nettoyage
        console.log('\n💡 Pour nettoyer les données de test plus tard, exécutez:')
        console.log('node test_referent_permissions.js --cleanup')
    }
}

// Vérifier si c'est un nettoyage
if (process.argv.includes('--cleanup')) {
    cleanupTestData()
} else {
    main()
}
