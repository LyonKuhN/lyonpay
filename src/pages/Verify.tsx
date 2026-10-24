import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import { AuthCard } from '../components/layout/AuthCard';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmando seu e-mail…');
  const { login } = useAuth();
  const navigate = useNavigate();
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const verifyToken = async () => {
      if (!token) {
        setStatus('error');
        setMessage('O link de confirmação está incompleto.');
        return;
      }
      try {
        const response = await fetch(API_BASE_URL + '/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível confirmar o e-mail');
        login(data.user);
        setStatus('success');
        setMessage('E-mail confirmado');
        setTimeout(() => navigate('/dashboard'), 2500);
      } catch (err) {
        setStatus('error');
        setMessage((err as Error).message);
      }
    };

    verifyToken();
  }, [token, login, navigate]);

  return (
    <AuthCard>
      <div className="flex flex-col items-center text-center">
        <span className={
          status === 'error' ? 'mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-neg/12 text-neg'
            : status === 'success' ? 'mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-pos/12 text-pos'
            : 'mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/12 text-brand'
        }>
          {status === 'loading' && <LoaderCircle size={28} className="animate-spin" />}
          {status === 'success' && <CircleCheck size={28} />}
          {status === 'error' && <CircleX size={28} />}
        </span>
        <h1 className="text-xl font-semibold text-fg">{message}</h1>
        {status === 'success' && <p className="mt-2 text-[15px] text-muted">Abrindo o seu painel…</p>}
        {status === 'error' && (
          <Link to="/" className="mt-6 flex h-12 w-full items-center justify-center rounded-xl border border-line-strong text-[15px] font-semibold text-fg hover:bg-elevated">
            Voltar para o início
          </Link>
        )}
      </div>
    </AuthCard>
  );
}
