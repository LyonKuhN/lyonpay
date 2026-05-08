import pool from './db.js';

const email = process.argv[2];

if (!email) {
  console.log('❌ Por favor, informe o e-mail: node set_admin.js email@exemplo.com');
  process.exit();
}

async function setAdmin() {
  try {
    const result = await pool.query('UPDATE auth.users SET role = \'admin\' WHERE email = $1 RETURNING email', [email]);
    
    if (result.rows.length > 0) {
      console.log(`✅ O usuário ${email} agora é ADMIN!`);
    } else {
      console.log('❌ Usuário não encontrado.');
    }
  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    process.exit();
  }
}

setAdmin();
