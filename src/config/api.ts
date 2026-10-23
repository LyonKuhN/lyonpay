// Configuração central da API para facilitar deploy
// Em produção o build recebe VITE_API_URL. Sem ela, usa a porta 3005 do mesmo endereço que abriu o site:
// localhost no computador e o IP da máquina quando o celular acessa pela rede local.
export const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3005`;
