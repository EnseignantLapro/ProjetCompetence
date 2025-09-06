#!/bin/bash

# Script de déploiement pour forcer le renouvellement du cache

echo "🔄 Déploiement en cours..."

# 1. Build du frontend
echo "📦 Build du frontend..."
cd /Users/Julien/Documents/ProjetCompetence/mon-app-react
npm run build

# 2. Copie vers le backend
echo "📂 Copie vers le backend..."
cd /Users/Julien/Documents/ProjetCompetence
cp -r mon-app-react/dist/* back/frontend-dist/

# 3. Synchronisation vers la production
echo "🚀 Synchronisation vers la production..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  ~/Documents/ProjetCompetence/back/ \
  superroot@172.29.254.11:/opt/efe-app/app/

echo "✅ Déploiement terminé!"
echo "🔥 Cache forcé à se renouveler avec:"
echo "   - Nouveaux hashes des assets"
echo "   - Headers anti-cache"
echo "   - ETag unique basé sur timestamp"
