import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Em desenvolvimento o Vite encaminha /api para a API local (porta 3005), como o nginx faz em produção.
// Assim o cookie de sessão funciona igual nos dois ambientes, inclusive pelo celular na mesma rede.
const API_LOCAL = process.env.LYONK_API_LOCAL || 'http://127.0.0.1:3005'

const proxy = {
  '/api': { target: API_LOCAL, changeOrigin: false },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
