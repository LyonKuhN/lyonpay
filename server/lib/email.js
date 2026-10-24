import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { frontendUrl } from './sessao.js';

const resend = new Resend(process.env.RESEND_API_KEY || 're_desativado');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/** Envia pelo Resend e, se falhar, pelo SMTP. Nunca derruba a requisição. */
export async function enviarEmail(para, assunto, html) {
  console.log(`[Email] Enviando para: ${para}`);
  try {
    if (!process.env.RESEND_API_KEY) throw new Error('Resend sem chave');
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Lyonk <onboarding@resend.dev>',
      to: para,
      subject: assunto,
      html,
    });
    if (error) throw new Error(error.message);
    console.log('[Resend] Enviado. ID:', data.id);
  } catch (err) {
    console.warn('[Resend] Falhou, tentando SMTP:', err.message);
    try {
      await transporter.sendMail({ from: process.env.EMAIL_FROM || 'Lyonk <adm@lyonk.com.br>', to: para, subject: assunto, html });
      console.log('[SMTP] Enviado.');
    } catch (smtpErr) {
      console.error('!!! Falha ao enviar e-mail (Resend e SMTP):', smtpErr.message);
    }
  }
}

const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Moldura padrão dos e-mails, no visual do app (fundo claro, dourado da marca). */
export function modeloEmail({ titulo, paragrafos = [], botao, destaque, rodape }) {
  const corpo = paragrafos.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#45423b;">${p}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#f6f5f1;padding:32px 16px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e3da;border-radius:20px;padding:32px;">
    <div style="font-size:18px;font-weight:700;color:#16150f;margin-bottom:24px;"><span style="color:#8e6a1f;">LK</span>&nbsp; Lyonk</div>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#16150f;">${titulo}</h1>
    ${corpo}
    ${destaque ? `<div style="margin:20px 0;padding:18px;border-radius:14px;background:#f1efe9;text-align:center;font-size:30px;font-weight:700;letter-spacing:6px;color:#16150f;">${destaque}</div>` : ''}
    ${botao ? `<div style="margin:24px 0 8px;"><a href="${botao.url}" style="display:inline-block;background:#8e6a1f;color:#ffffff;padding:13px 22px;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;">${botao.texto}</a></div>
    <p style="margin:12px 0 0;font-size:12px;color:#8c877b;word-break:break-all;">Se o botão não abrir: ${botao.url}</p>` : ''}
    <hr style="border:0;border-top:1px solid #e7e3da;margin:28px 0 16px;" />
    <p style="margin:0;font-size:12px;color:#8c877b;">${rodape || 'Lyonk · controle financeiro pessoal'}</p>
  </div></body></html>`;
}

export function emailConfirmacao(nome, token) {
  const url = `${frontendUrl()}/verify?token=${token}`;
  return modeloEmail({
    titulo: `Olá, ${escapar(nome)}!`,
    paragrafos: ['Para começar a usar o Lyonk, confirme o seu e-mail.'],
    botao: { url, texto: 'Confirmar e-mail' },
  });
}

export function emailCodigo2FA(codigo, novo = false) {
  return modeloEmail({
    titulo: novo ? 'Seu novo código de acesso' : 'Seu código de acesso',
    paragrafos: ['Use o código abaixo para entrar. Ele vale por 10 minutos.'],
    destaque: codigo,
    rodape: 'Se você não tentou entrar, troque sua senha.',
  });
}

export function emailRecuperacao(token) {
  const url = `${frontendUrl()}/reset-password?token=${token}`;
  return modeloEmail({
    titulo: 'Redefinir sua senha',
    paragrafos: ['Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora.'],
    botao: { url, texto: 'Criar nova senha' },
    rodape: 'Se você não pediu isso, ignore este e-mail.',
  });
}

export function emailLembrete(nome, titulo, descricao, quando) {
  return modeloEmail({
    titulo: escapar(titulo),
    paragrafos: [
      `Olá, ${escapar(nome || 'tudo bem')}! ${escapar(descricao || 'Você tem um lembrete agendado para agora.')}`,
      `<strong>Quando:</strong> ${escapar(quando)}`,
    ],
    botao: { url: `${frontendUrl()}/calendario`, texto: 'Abrir agenda' },
  });
}

export function emailContasDoDia(nome, contas, total) {
  const linhas = contas.map((c) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee9df;">${escapar(c.descricao)}</td><td style="padding:8px 0;border-bottom:1px solid #eee9df;text-align:right;font-weight:600;">${c.valorFmt}</td></tr>`).join('');
  return modeloEmail({
    titulo: 'Contas que vencem hoje',
    paragrafos: [
      `Olá, ${escapar(nome)}! Estas contas vencem hoje e ainda não foram pagas:`,
      `<table style="width:100%;border-collapse:collapse;font-size:14px;color:#16150f;">${linhas}<tr><td style="padding-top:12px;font-weight:700;">Total</td><td style="padding-top:12px;text-align:right;font-weight:700;">${total}</td></tr></table>`,
    ],
    botao: { url: `${frontendUrl()}/pagamentos`, texto: 'Ver contas a pagar' },
    rodape: 'Você recebe este aviso porque ligou o aviso diário. Desligue em Configurações.',
  });
}

export function emailConvite(nomeDono, url) {
  return modeloEmail({
    titulo: `${escapar(nomeDono)} convidou você para o Lyonk`,
    paragrafos: ['Você foi convidado a acompanhar e organizar as finanças em conjunto. Entre (ou crie sua conta) com este e-mail para aceitar.'],
    botao: { url, texto: 'Aceitar convite' },
  });
}

export { escapar };
