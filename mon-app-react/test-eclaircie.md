# Guide d'utilisation - Affichage des notes en état "eclaircie"

## Fonctionnalité ajoutée

J'ai ajouté une fonctionnalité pour afficher les IDs des notes qui sont en état "eclaircie" (opacity 0.4) lors de la validation des devoirs.

## Comment utiliser

### 1. Affichage des notes en eclaircie pour un élève/compétence spécifique

Dans la console du navigateur, utilisez :
```javascript
// Pour un élève et une compétence spécifique
window.debugNotes['[ID_ELEVE]-[CODE_COMPETENCE]']()

// Exemple avec élève ID 5 et compétence "C1.1"
window.debugNotes['5-C1.1']()
```

### 2. Affichage de toutes les notes en eclaircie

Dans la console du navigateur, utilisez :
```javascript
window.afficherToutesNotesEclaircie()
```

## Comment ça fonctionne

1. **État "eclaircie"** : Quand un élève a une note (couleur sélectionnée), les autres couleurs deviennent en "eclaircie" avec une opacity de 0.4

2. **Tracking automatique** : Le système track automatiquement quels boutons de couleur sont en état "eclaircie" pour chaque élève/compétence

3. **IDs générés** : Les IDs des notes suivent le format : `[ID_ELEVE]-[CODE_COMPETENCE]-[COULEUR]`

## Exemple d'utilisation pratique

1. Sélectionnez une couleur pour un élève (ex: "vert" pour très bonne maîtrise)
2. Les autres couleurs (rouge, jaune, bleu) deviennent en "eclaircie"
3. Utilisez `window.debugNotes['5-C1.1']()` pour voir les IDs des couleurs en eclaircie
4. Ou utilisez `window.afficherToutesNotesEclaircie()` pour voir toutes les notes en eclaircie du tableau

## Format de sortie console

```
Notes en cours de notation (eclaircie) pour élève [Prénom] [Nom] - compétence [CODE]:
- Note ID: [ID_ELEVE]-[CODE_COMPETENCE]-rouge
- Note ID: [ID_ELEVE]-[CODE_COMPETENCE]-jaune  
- Note ID: [ID_ELEVE]-[CODE_COMPETENCE]-bleu
```

Cette fonctionnalité aide à debugger et comprendre quelles notes sont visuellement masquées pendant le processus de notation.