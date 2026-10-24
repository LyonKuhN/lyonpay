import { API_BASE_URL } from '../config/api';

/** Erro da API com os campos extras que o servidor devolve (ex.: promptReplace). */
export type ApiError = Error & Record<string, unknown> & { status?: number };

// Espaço ativo (conta compartilhada). Definido pelo EspacoContext; vazio = finanças da própria pessoa.
let espacoAtivo: string | null = null;
export const definirEspacoAtivo = (id: string | null) => {
  espacoAtivo = id;
};

/** URL completa de um recurso da API (para <img src>, links de download etc.). */
export const urlApi = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

/** Baixa um arquivo da API (anexos) já com o espaço ativo. */
export const apiBlob = async (endpoint: string) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    headers: espacoAtivo ? { 'X-Lyonk-Espaco': espacoAtivo } : undefined,
  });
  if (response.status === 401) window.dispatchEvent(new CustomEvent('session-expired'));
  if (!response.ok) throw new Error('Não foi possível abrir o arquivo.');
  return response.blob();
};

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(espacoAtivo ? { 'X-Lyonk-Espaco': espacoAtivo } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  // A sessão vai no cookie httpOnly (o JavaScript nunca vê o token)
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers, credentials: 'include' });

  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent('session-expired'));
    let errorMsg = response.status === 403 ? 'Você não tem permissão para isso.' : response.statusText || 'Erro na requisição';
    let extraData: Record<string, unknown> = {};
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorData.message || errorMsg;
      extraData = errorData;
    } catch {
      // resposta sem corpo JSON
    }
    const err = new Error(errorMsg) as ApiError;
    Object.assign(err, extraData, { status: response.status });
    throw err;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};
