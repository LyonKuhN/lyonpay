import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircleCheck, KeyRound } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { AuthCard } from '../components/layout/AuthCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? '' : 'O link de recuperação é inválido ou está incompleto.');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
    if (password !== confirmPassword) return setError('As senhas não coincidem.');

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível redefinir a senha');
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthCard>
        <div className="text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-pos/12 text-pos"><CircleCheck size={28} /></span>
          <h1 className="text-xl font-semibold text-fg">Senha redefinida</h1>
          <p className="mt-2 text-[15px] text-muted">Agora é só entrar com a nova senha.</p>
          <Button size="lg" fullWidth className="mt-6" onClick={() => navigate('/?entrar=1')}>Entrar</Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 text-brand"><KeyRound size={24} /></span>
      <h1 className="text-xl font-semibold text-fg">Crie uma nova senha</h1>
      <p className="mt-1 text-[15px] text-muted">Use pelo menos 6 caracteres.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input label="Nova senha" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={!token} />
        <Input label="Confirme a senha" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={!token} />
        {error && <p className="rounded-xl bg-neg/10 px-4 py-3 text-sm font-medium text-neg">{error}</p>}
        <Button type="submit" size="lg" fullWidth isLoading={loading} disabled={!token}>Salvar nova senha</Button>
        <Button variant="ghost" size="lg" fullWidth onClick={() => navigate('/')}>Voltar ao início</Button>
      </form>
    </AuthCard>
  );
}
