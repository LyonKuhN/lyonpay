import cron from 'node-cron';
import pool from './db.js';
import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const resend = new Resend(process.env.RESEND_API_KEY || '');
const EMAIL_FROM = process.env.EMAIL_FROM || 'LyonK <adm@lyonk.com.br>';

export const initCronJobs = () => {
  // Roda todos os dias às 08:00 da manhã
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Iniciando verificação de despesas do dia...');
    try {
      const query = `
        SELECT 
            d.id, d.descricao, d.valor, 
            u.email, p.display_name 
        FROM public.despesas d
        JOIN auth.users u ON d.user_id = u.id
        JOIN public.profiles p ON p.user_id = u.id
        WHERE d.data_vencimento = CURRENT_DATE 
          AND d.pago = false 
          AND d.is_modelo = false
          AND p.notificacoes_diarias = true
      `;
      
      const { rows } = await pool.query(query);

      if (rows.length === 0) {
        console.log('[CRON] Nenhuma despesa pendente para o dia.');
        return;
      }

      // Agrupa por email
      const usersMap = {};
      rows.forEach(row => {
        if (!usersMap[row.email]) {
          usersMap[row.email] = {
            name: row.display_name || 'Usuário',
            despesas: []
          };
        }
        usersMap[row.email].despesas.push({
          descricao: row.descricao,
          valor: row.valor
        });
      });

      // Envia os emails
      for (const email of Object.keys(usersMap)) {
        const user = usersMap[email];
        const total = user.despesas.reduce((acc, curr) => acc + parseFloat(curr.valor), 0);
        
        let despesasHtml = user.despesas.map(d => `
          <div style="background: #27272a; padding: 15px; margin-bottom: 10px; border-radius: 12px; display: flex; justify-content: space-between;">
            <span style="color: #fff; font-size: 16px;">${d.descricao}</span>
            <span style="color: #FF4D4D; font-weight: bold; font-size: 16px;">R$ ${parseFloat(d.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
          </div>
        `).join('');

        const htmlContent = `
          <div style="font-family: sans-serif; background-color: #09090B; color: white; padding: 40px; border-radius: 20px; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #FF4D4D; font-size: 24px; text-align: center;">Contas Vencendo Hoje</h1>
            <p style="font-size: 16px; color: #a1a1aa; margin-top: 30px;">Olá, <strong style="color: #fff;">${user.name}</strong>!</p>
            <p style="font-size: 16px; color: #a1a1aa;">As seguintes despesas vencem hoje e ainda não foram pagas:</p>
            
            <div style="margin: 20px 0;">
              ${despesasHtml}
            </div>

            <div style="text-align: right; font-size: 18px; color: #fff; margin-top: 20px;">
              Total do dia: <strong style="color: #FF4D4D; font-size: 24px; margin-left: 10px;">R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong>
            </div>
            
            <hr style="border-color: #27272a; border-style: solid; margin: 40px 0 20px 0;">
            <p style="font-size: 12px; color: #71717a; text-align: center; line-height: 1.5;">
              Você está recebendo este e-mail porque ativou os alertas automáticos.<br>
              Para cancelar este aviso diário, acesse as <strong>Configurações</strong> do seu painel no Lyonk.
            </p>
          </div>
        `;

        await resend.emails.send({
          from: EMAIL_FROM,
          to: email,
          subject: 'Contas Vencendo Hoje - LyonK',
          html: htmlContent,
        });

        console.log(`[CRON] E-mail enviado para: ${email}`);
      }
      
      console.log(`[CRON] Finalizado. E-mails enviados para ${Object.keys(usersMap).length} usuário(s).`);
    } catch (err) {
      console.error('[CRON] Erro ao executar job de despesas do dia:', err);
    }
  });
};
