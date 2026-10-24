import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CircleAlert, Users } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useEspaco } from '../contexts/EspacoContext';
import { Button } from '../components/ui/button';
import { Card, Skeleton } from '../components/ui/primitives';
import { EASE_OUT } from '../lib/motion';

interface Convite { email: string; permissao: 'editar' | 'ver'; status: string; dono: string }

/** Tela aberta pelo link do e-mail de convite para a conta compartilhada. */
export default function ConvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { trocar } = useEspaco();
  const [aceito, setAceito] = useState(false);

  const conviteQ = useQuery<Convite>({
    queryKey: ['convite', token],
    queryFn: () => apiFetch(`/api/convites/${token}`),
    enabled: !!token,
    retry: false,
  });

  const aceitar = useMutation({
    mutationFn: () => apiFetch(`/api/convites/${token}/aceitar`, { method: 'POST' }),
    onSuccess: async (res: { dono_id: string }) => {
      setAceito(true);
      await qc.invalidateQueries({ queryKey: ['espacos'] });
      toast.success('Convite aceito');
      setTimeout(() => {
        trocar(res.dono_id);
        navigate('/dashboard');
      }, 900);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const c = conviteQ.data;
  const outroEmail = c && user && c.email.toLowerCase() !== user.email.toLowerCase();

  return (
    <div className="mx-auto max-w-md pt-4 lg:pt-12">
      <Card className="overflow-hidden p-6 text-center sm:p-8">
        {conviteQ.isLoading ? (
          <Skeleton className="mx-auto h-40 w-full" />
        ) : !token || conviteQ.isError ? (
          <>
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neg/12 text-neg"><CircleAlert size={26} /></span>
            <h1 className="text-lg font-semibold text-fg">Convite não encontrado</h1>
            <p className="mt-2 text-[15px] text-muted">O link pode ter sido cancelado por quem convidou. Peça um novo convite.</p>
            <Button className="mt-6" fullWidth onClick={() => navigate('/dashboard')}>Ir para o início</Button>
          </>
        ) : c ? (
          <>
            <motion.span
              initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
              animate={aceito ? { scale: [1, 1.15, 1], rotate: 0, opacity: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/12 text-brand"
            >
              <Users size={26} />
            </motion.span>
            <h1 className="text-lg font-semibold text-fg">{c.dono} convidou você</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Para acompanhar as finanças no Lyonk {c.permissao === 'ver' ? 'com acesso só de leitura' : 'podendo lançar e editar'}.
              Suas próprias finanças continuam separadas.
            </p>
            {outroEmail ? (
              <p className="mt-5 rounded-xl bg-warn/12 px-4 py-3 text-sm text-fg">
                Este convite foi enviado para <strong>{c.email}</strong>. Entre com esse e-mail para aceitar.
              </p>
            ) : c.status === 'aceito' && !aceito ? (
              <Button className="mt-6" fullWidth size="lg" onClick={() => navigate('/dashboard')}>Convite já aceito · abrir</Button>
            ) : (
              <Button className="mt-6" fullWidth size="lg" isLoading={aceitar.isPending} disabled={aceito} onClick={() => aceitar.mutate()}>
                {aceito ? 'Abrindo…' : 'Aceitar convite'}
              </Button>
            )}
          </>
        ) : null}
      </Card>
    </div>
  );
}
