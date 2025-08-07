export const competencesN1N2 = [
  {
    code: 'C01',
    poid: 30,
    bloc: 3,
    nom: 'COMMUNIQUER EN SITUATION PROFESSIONNELLE',
    enfants: [
        { code: 'C01.1', nom: 'Le rapport (typographie, orthographe, illustration, lisibilité) est soigné, personnel et argumenté avec des enchaînements cohérents' , poid:20,bloc:3},
        { code: 'C01.2', nom: 'La présentation (typographie, orthographe, illustration, lisibilité) est soignée et soutient le discours avec des enchaînements cohérents', poid:20,bloc:3},
        { code: 'C01.3', nom: 'La présentation orale est de qualitée et claire', poid:20 ,bloc:3},
        { code: 'C01.4', nom: 'L\'argumentation lors de l\'échange est de qualité', poid:20 ,bloc:3},
        { code: 'C01.5', nom: 'Le style, le ton et la terminologie utilisés sont adaptés,L’attitude, les comportements et le langage sont conformes', poid:20 ,bloc:3}

    ]
  },
  {
    code: 'C02',
     poid: 20,
      bloc: 2,
    nom: 'ORGANISER UNE INTERVENTION',
    enfants: [
        { code: 'C02.1', nom: 'Les différents interlocuteurs et ressources sont identifiés',poid:25,bloc:2 },
        { code: 'C02.2', nom: 'Le cahier des charges préliminaire est complété et les ressources permettant de répondre au cahier des charges sont décrites' ,poid:25,bloc:2},
        { code: 'C02.3', nom: 'Le planning prévisionnel est interprété', poid:20,bloc:2},
        { code: 'C02.4', nom: 'Analyse la situation, respecte la qualité, l’efficacité et les délais.', poid:30,bloc:2}
    ]
  },
   {
    code: 'C03',
     poid: 15,
      bloc: 3,
    nom: 'GERER UN PROJET',
    enfants: [
        { code: 'C03.1', nom: 'Les documents de suivis des tâches sont renseignés, le planning prévisionnel est mis à jour.', poid:10,bloc:3 },
        { code: 'C03.2', nom: 'L’adéquation des ressources humaines et des ressources matérielles pour mener le projet est validée.', poid:10 ,bloc:3},
        { code: 'C03.3', nom: 'L’équipe projet communique correctement et gère les retards et les aléas', poid:10 ,bloc:3},
        { code: 'C03.4', nom: 'Les travaux sont réalisés et livrés avec la documentation en concordance avec les besoins du client', poid:40 ,bloc:3},
        { code: 'C03.5', nom: 'La résolution d\'un problème nouveau imprévu est réussie, Le travail en équipe est conduit de manière solidaire ', poid:30 ,bloc:3}    
    ]
  },
   {
    code: 'C04',
     poid: 50,
      bloc: 1,
    nom: 'ANALYSER UN SYSTEME INFORMATIQUE',    
    enfants: [
        { code: 'C04.1', nom: 'Les spécifications du cahier des charges sont extraites' ,poid:20,bloc:1},
        { code: 'C04.2', nom: 'L’organisation structurelle des sous-ensembles est conforme aux exigences fonctionnelles' ,poid:20,bloc:1},
        { code: 'C04.3', nom: 'La structure de la solution technique est critiquée' ,poid:20,bloc:1},
        { code: 'C04.4', nom: 'Les algorithmes sont critiqués', poid:20,bloc:1 },
        { code: 'C04.5', nom: 'Le calme est conservé de façon constante', poid:20,bloc:1 }
    ]
  },
   {
    code: 'C05',
     poid: 50,
      bloc: 1,
    nom: 'CONCEVOIR UN SYSTEME INFORMATIQUE',
    enfants: [
        { code: 'C05.1', nom: 'Les ressources permettant de réaliser le cahier des charges sont recensées et définies',poid:20,bloc:1 },
        { code: 'C05.2', nom: 'Les solutions logicielles proposées sont conformes aux spécifications du cahier des charges',poid:20,bloc:1 },
        { code: 'C05.3', nom: 'Les tests unitaires et d’intégrations sont définis',poid:20,bloc:1 },
        { code: 'C05.4', nom: 'Le document de recette est rédigé conformément aux exigences du cahier des charges',poid:20,bloc:1 },
        { code: 'C05.5', nom: 'Le souci constant de la qualité est recherché et aide son équipe',poid:20,bloc:1 }
    ]
  },
   {
    code: 'C06',
     poid: 20,
      bloc: 2,
    nom: 'VALIDER UN SYSTEME INFORMATIQUE  ',
    enfants: [
        { code: 'C06.1', nom: 'Les exigences à valider sont identifiées dans le périmètre défini',poid:20,bloc:2 },
        { code: 'C06.2', nom: 'Les procédures de test sont établies',poid:20,bloc:2 },
        { code: 'C06.3', nom: 'Les tests (unitaires, d’intégration et autres) sont appliqués', poid:10,bloc:2 },
        { code: 'C06.4', nom: 'Les résultats de tests sont synthétisés pour évaluer la conformité globale', poid:10,bloc:2 },
        { code: 'C06.5', nom: 'Le document de recette est validé par le client et la recette est réalisée avec le client', poid:10,bloc:2 },
        { code: 'C06.6', nom: 'planifie son travail efficacement,garde son calme en toute situation, persévère jusqu’au résultat, et prend les bonnes décisions', poid:30,bloc:2 }
    ]
  },
   {
    code: 'C08',
    nom: 'CODER',
     poid: 30,
      bloc: 3,
    enfants: [
        { code: 'C08.1', nom: 'Les environnements sont choisis et justifiés et les données de l’entreprise sont identifiées', poid:5,bloc:3 },
        { code: 'C08.2', nom: 'Le code est versionné, commenté et le logiciel est documenté', poid:15,bloc:3},
        { code: 'C08.3', nom: 'Les composants logiciels individuels sont développés conformément (sécurité et de protection des données )', poid:20 ,bloc:3},
        { code: 'C08.4', nom: 'La solution (logicielle et matérielle) est intégrée et testée conformément', poid:40,bloc:3 },
        { code: 'C08.5', nom: ' La résolution d\'un problème nouveau imprévu est réussie"', poid:20 ,bloc:3}
    ]
  },
   {
    code: 'C09',
     poid: 30,
      bloc: 2,
    nom: 'INSTALLER UN RESEAU INFORMATIQUE',
    enfants: [
        { code: 'C09.1', nom: 'Les équipements nécessaires à la réponse au CDC (fourni par le client) sont identifiés',poid:20,bloc:2 },
        { code: 'C09.2', nom: 'Une procédure de configuration ou d’installation est déterminée' ,poid:20,bloc:2},
        { code: 'C09.3', nom: 'La ou les procédures choisies sont suivies', poid:10,bloc:2 },
        { code: 'C09.4', nom: 'Les activités sont menées en respectant les règles de sécurité', poid:10,bloc:2 },
        { code: 'C09.5', nom: 'Un compte-rendu du fonctionnement de l\'installation est fourni (anomalies, difficultés et retours clients etc.)', poid:10,bloc:2 } ,
        { code: 'C09.6', nom: 'La personne adapte sa communication au contexte et répond aux attentes en préparant un travail de qualité, efficace et livré dans les délais.', poid:30,bloc:2 }
    ]
  },
   {
    code: 'C10',
     poid: 25,
      bloc: 3,
    nom: 'EXPLOITER UN RESEAU INFORMATIQUE',
    enfants: [
        { code: 'C10.1', nom: 'Les différents éléments matériels et/ou logiciels sont identifiés à partir d’un schéma fourni' , poid:10 ,bloc:3},
        { code: 'C10.2', nom: 'Le fonctionnement d’un équipement matériel et/ou logiciel est vérifié en tenant compte du contexte', poid:30 ,bloc:3},
        { code: 'C10.3', nom: 'La mise à jour d’un matériel et/ou logiciel est proposée et justifiée', poid:20,bloc:3 },
        { code: 'C10.4', nom: 'Les optimisations ou résolution d’incidents nécessaires sont effectuées', poid:20 ,bloc:3},
        { code: 'C10.5', nom: 'Le travail en équipe est conduit de manière solidaire', poid:20,bloc:3 }
    ]
  },
   {
    code: 'C11',
     poid: 30,
      bloc: 2,
    nom: 'MAINTENIR UN RESEAU INFORMATIQUE',
    enfants: [
        { code: 'C11.1', nom: 'Les outils logiciels et matériels permettant d’effectuer les tests et l’analyse du système d’information sont identifiés et mis en œuvre selon les spécifications' ,poid:20,bloc:2},
        { code: 'C11.2', nom: 'Les résultats de tests et d’analyse sont interprétés de manière pertinente et les causes de l’incident sont localisées' ,poid:20,bloc:2},
        { code: 'C11.3', nom: 'L’incident est résolu ou qualifié et escaladé, le service est opérationnel', poid:20,bloc:2},
        { code: 'C11.4', nom: 'Le client est correctement informé et conseillé quant aux mesures de prévention possibles', poid:10,bloc:2},
        { code: 'C11.5', nom: 'Le travail est réalisé dans le calme et les délais', poid:30,bloc:2}    
    ]
  },
];

export const tachesProfessionelles = [
  {
    code: 'R1',
    nom: 'Accompagnement du client',
    description: '',
    competences: ['C01', 'C04', 'C05'],
    duree: '',
    niveau: '',
    TacheAssociees: [
        { code: 'T1', nom: 'Analyse des besoins du client' },
        { code: 'T2', nom: 'Réception de l’installation avec le client' },
        { code: 'T3', nom: 'Formation du client' },
        { code: 'T4', nom: 'Explication des modalités de l’intervention' },
        { code: 'T5', nom: 'Information et/ou conseil au client' },
        { code: 'T6', nom: 'Fidélisation de la clientèle' }
    ]
  },
    {
    code: 'R2',
    nom: 'Installation et qualification ',
    description: '',
    competences: ['C04', 'C05', 'C06', 'C08', 'C09', 'C10'],
    duree: '',
    niveau: '',
    TacheAssociees: [
        { code: 'T1', nom: 'Analyse de la demande du client' },
        { code: 'T2', nom: 'Production des documents pour la mise en œuvre (plans d\'exécution, protocoles, paramétrages etc.)' },
        { code: 'T3', nom: 'Vérification du dossier et interprétation des plans d’exécution' },
        { code: 'T4', nom: 'Préparation du chantier en fonction de l’intervention souhaitée' },
        { code: 'T5', nom: 'Réalisation des opérations avec, en particulier, prise en compte des contraintes client et contrôle matériel et logiciel de l’installation' },
        { code: 'T6', nom: 'Recettage de l’installation' }
    ]
  },
    {
        code: 'R3',
        nom: 'Exploitation et maintien en condition opérationnelle',
        description: '',
        competences: ['C02', 'C06', 'C08', 'C09', 'C10', 'C11'],
        duree: '',
        niveau: '',
        TacheAssociees: [
            { code: 'T1', nom: 'Suivi de l’exploitation technique' },
            { code: 'T2', nom: 'Contact avec les supports techniques externes' },
            { code: 'T3', nom: 'Supervision de l’état du réseau dans son périmètre' },
            { code: 'T4', nom: 'Réalisation d’un diagnostic de premier niveau' },
            { code: 'T5', nom: 'Configuration matérielle et logicielle des équipements' },
            { code: 'T6', nom: 'Intégration de nouveaux équipements' },
            { code: 'T7', nom: 'Mise à jour des équipements' }
        ]
    },
    {
        code: 'R4',
        nom: 'Gestion de projet et d’équipe',
        description: '',
        competences: ['C01', 'C02', 'C03'],
        duree: '',
        niveau: '',
        TacheAssociees: [
            { code: 'T1', nom: 'Identification de toutes les étapes du projet jusqu’à la réception des travaux' },
            { code: 'T2', nom: 'Identification des ressources humaines et matérielles' },
            { code: 'T3', nom: 'Management des équipes opérationnelles internes' },
            { code: 'T4', nom: 'Gestion de la sous-traitance' },
            { code: 'T5', nom: 'Pilotage de l’exécution des travaux' },
            { code: 'T6', nom: 'Encadrement des équipes externes' }
        ]
    },
    {
        code: 'R5',
        nom: 'Maintenance des réseaux informatiques',
        description: '',
        competences: ['C02', 'C04', 'C06', 'C09', 'C10', 'C11'],
        duree: '',
        niveau: '',
        TacheAssociees: [
            { code: 'T1', nom: 'Analyse des dysfonctionnements' },
            { code: 'T2', nom: 'Mise en œuvre de la maintenance préventive' },
            { code: 'T3', nom: 'Mise en œuvre de la maintenance corrective' },
            { code: 'T4', nom: 'Réalisation des tests de validation' },
            { code: 'T5', nom: 'Rédaction des rapports d’intervention' }
        ]
    },
    {
        code: 'D1',
        nom: 'Élaboration et appropriation d’un cahier des charges',
        description: '',
        competences: ['C01', 'C03', 'C04', 'C05'],
        duree: '',
        niveau: '',
        TacheAssociees: [
            { code: 'T1', nom: 'Collecte des informations' },
            { code: 'T2', nom: 'Analyse des informations' },
            { code: 'T3', nom: 'Interprétation d’un cahier des charges' },
            { code: 'T4', nom: 'Formalisation du cahier des charges' }
        ]
    },
    {
        code: 'D2',
        nom: 'Développement et validation de solutions logicielles',
        description: '',
        competences: ['C05', 'C06', 'C08'],
        duree: '',
        niveau: '',
        TacheAssociees: [
            { code: 'T1', nom: 'Conception de l’architecture d’une solution logicielle' },
            { code: 'T2', nom: 'Modélisation d’une solution logicielle' },
            { code: 'T3', nom: 'Développement, utilisation ou adaptation de composants logiciels' },
            { code: 'T4', nom: 'Tests de mise en production' },
            { code: 'T5', nom: 'Recette et validation' }
        ]
    }
];