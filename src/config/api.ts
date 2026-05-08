// Configuração central da API para facilitar deploy
// Se estiver em produção, usa a URL do servidor. Caso contrário, usa localhost.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3005';
