// Gera o par de chaves das notificações no aparelho (Web Push).
// Uso: node scripts/gerar-vapid.js  → cole as duas linhas nas variáveis de ambiente da API.
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
