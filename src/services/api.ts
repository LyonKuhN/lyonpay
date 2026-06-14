import { API_BASE_URL } from '../config/api';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('lyonk_token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Detect session expiration and notify the app
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    let errorMsg = response.statusText;
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorMsg;
    } catch (e) {
      // Ignora erro de parse de JSON caso não tenha corpo de erro
    }
    throw new Error(errorMsg);
  }

  // Verifica se não há conteúdo (204 No Content)
  if (response.status === 204) return null;

  // Em alguns casos, DELETE pode não retornar JSON
  if (options.method === 'DELETE') {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  return response.json();
};
