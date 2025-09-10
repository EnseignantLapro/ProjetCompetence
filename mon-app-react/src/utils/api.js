// Fonction utilitaire pour gérer les URLs d'API selon l'environnement
export const getApiUrl = (endpoint) => {
  let baseUrl = '';
  
  // En mode développement (peu importe localhost ou IP)
  if (import.meta.env.DEV) {
    // Si on accède via une IP réseau, utiliser la même IP avec port 3000
    if (window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      baseUrl = `http://${window.location.hostname}:3000`;
    } 
    // Sinon utiliser localhost avec port 3000
    else {
      baseUrl = `http://localhost:3000`;
    }
  }
  // En production, utiliser les URLs relatives
  else {
    baseUrl = '';
  }
  
  // Ajouter un paramètre cache busting pour éviter les problèmes de cache du reverse proxy
  const separator = endpoint.includes('?') ? '&' : '?';
  const cacheBuster = `_cb=${Date.now()}`;
  
  return `${baseUrl}${endpoint}${separator}${cacheBuster}`;
}

// Fonction utilitaire pour faire des requêtes avec headers anti-cache
export const fetchWithNoCacheHeaders = (url, options = {}) => {
  const defaultHeaders = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  return fetch(getApiUrl(url), {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });
};

// Fonction centralisée pour tous les appels API avec injection automatique des tokens
export const apiFetch = (url, options = {}) => {
  // Récupérer les tokens depuis localStorage avec les bonnes clés
  const eleveToken = localStorage.getItem('student_token');
  const enseignantToken = localStorage.getItem('teacher_token');
  
  // Construire les headers par défaut
  const defaultHeaders = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  // Déterminer quel token utiliser selon le contexte
  let tokenToUse = null;
  let userType = null;
  
  // Si un type de token spécifique est demandé dans les options
  if (options.tokenType === 'student' && eleveToken) {
    tokenToUse = eleveToken;
    userType = 'student';
  } else if (options.tokenType === 'teacher' && enseignantToken) {
    tokenToUse = enseignantToken;
    userType = 'teacher';
  } 
  // Sinon, logique automatique : priorité enseignant puis élève
  else if (enseignantToken) {
    tokenToUse = enseignantToken;
    userType = 'teacher';
  } else if (eleveToken) {
    tokenToUse = eleveToken;
    userType = 'student';
  }

  // Ajouter les headers d'autorisation et de type d'utilisateur si disponibles
  if (tokenToUse && userType) {
    defaultHeaders['Authorization'] = `Bearer ${tokenToUse}`;
    defaultHeaders['X-User-Type'] = userType;
  }

  // Fusionner avec les headers existants
  const headers = {
    ...defaultHeaders,
    ...options.headers
  };

  return fetch(getApiUrl(url), {
    ...options,
    headers
  });
};

// Fonction spécialisée pour les appels API avec token élève
export const apiFetchEleve = (url, options = {}) => {
  return apiFetch(url, { ...options, tokenType: 'student' });
};

// Fonction spécialisée pour les appels API avec token enseignant
export const apiFetchEnseignant = (url, options = {}) => {
  return apiFetch(url, { ...options, tokenType: 'teacher' });
};
