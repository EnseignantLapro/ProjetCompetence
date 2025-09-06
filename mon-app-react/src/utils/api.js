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
