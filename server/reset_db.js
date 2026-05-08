import pool from './db.js';

async function resetDB() {
  try {
    console.log('--- LIMPANDO BANCO DE DADOS ---');
    
    // Deletar tudo das tabelas principais (ordem importa por causa das chaves estrangeiras)
    await pool.query('TRUNCATE public.receitas CASCADE');
    await pool.query('TRUNCATE public.despesas CASCADE');
    await pool.query('TRUNCATE public.subscribers CASCADE');
    await pool.query('TRUNCATE public.profiles CASCADE');
    
    // Categorias customizadas
    await pool.query('DELETE FROM public.categorias WHERE user_id IS NOT NULL');
    
    // Usuários (Cascade deve limpar o resto se houver FKs, mas limpamos acima por segurança)
    await pool.query('TRUNCATE auth.users CASCADE');
    
    console.log('✅ Banco de dados limpo com sucesso!');
    console.log('💡 Agora você pode se cadastrar novamente do zero.');
    
  } catch (err) {
    console.error('❌ Erro ao limpar banco:', err);
  } finally {
    process.exit();
  }
}

resetDB();
