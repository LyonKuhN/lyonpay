import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando seu e-mail...');
  const { login } = useAuth();
  const navigate = useNavigate();

  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const verifyToken = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token de verificação ausente.');
        return;
      }

      try {
        const response = await fetch(API_BASE_URL + '/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Erro na verificação');

        login(data.token, data.user);
        setStatus('success');
        setMessage('E-mail verificado com sucesso!');
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message);
      }
    };

    verifyToken();
  }, [token, login, navigate]);

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center p-6">
      <div className="bg-[#15151A] border border-white/10 rounded-[3rem] p-12 w-full max-w-md text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-[#a3ff12]/5 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          {status === 'loading' && <Loader2 className="animate-spin text-[#a3ff12] mb-6" size={60} />}
          {status === 'success' && <CheckCircle2 className="text-[#a3ff12] mb-6 animate-in zoom-in duration-500" size={60} />}
          {status === 'error' && <XCircle className="text-[#FF4D4D] mb-6 animate-in zoom-in duration-500" size={60} />}
          
          <h1 className="text-2xl font-bold text-white mb-4">{message}</h1>
          
          {status === 'success' && (
            <p className="text-zinc-500 mb-8">Você será redirecionado para o dashboard em alguns segundos...</p>
          )}

          {status === 'error' && (
            <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-full hover:bg-white/10 transition-all">
              Voltar para Início <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
