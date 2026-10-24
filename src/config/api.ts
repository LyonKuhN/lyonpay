// A API fica no mesmo endereço do site, em /api (nginx em produção, proxy do Vite no desenvolvimento).
// Só defina VITE_API_URL_EXTERNA se o front precisar chamar uma API em outro domínio
// (aí o servidor precisa de COOKIE_SAMESITE=none para o cookie de sessão funcionar).
export const API_BASE_URL = import.meta.env.VITE_API_URL_EXTERNA || '';
