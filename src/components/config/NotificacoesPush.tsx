import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BellRing } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { ehIOS, rodandoComoApp } from '../../lib/pwa';
import { Button } from '../ui/button';
import { Switch } from '../ui/primitives';

const suportado = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** A chave VAPID chega em base64 de URL; o navegador quer os bytes. */
function chaveEmBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const bin = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function registro() {
  // Em produção o main.tsx já registrou; em desenvolvimento registra na hora
  const existente = await navigator.serviceWorker.getRegistration();
  if (!existente) await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

/** Linha de configuração das notificações de vencimento no celular/computador. */
export function NotificacoesPush({ Row }: { Row: React.ComponentType<{ icon: typeof BellRing; title: React.ReactNode; description?: React.ReactNode; control?: React.ReactNode }> }) {
  const [ativo, setAtivo] = useState(false);
  const [carregando, setCarregando] = useState(suportado);
  const [salvando, setSalvando] = useState(false);
  const [disponivel, setDisponivel] = useState(true);

  useEffect(() => {
    if (!suportado()) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setAtivo(!!sub && Notification.permission === 'granted');
        const info: { disponivel: boolean } = await apiFetch('/api/push/chave');
        setDisponivel(info.disponivel);
      } catch {
        // sem informação: deixa desligado
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const ligar = async () => {
    setSalvando(true);
    try {
      const info: { disponivel: boolean; chave: string } = await apiFetch('/api/push/chave');
      if (!info.disponivel) throw new Error('As notificações ainda não foram configuradas no servidor.');
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') throw new Error('Permita as notificações nas configurações do navegador.');
      const reg = await registro();
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveEmBytes(info.chave),
      });
      const json = sub.toJSON();
      await apiFetch('/api/push/inscrever', {
        method: 'POST',
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, aparelho: navigator.userAgent.slice(0, 120) }),
      });
      setAtivo(true);
      toast.success('Notificações ativadas neste aparelho');
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível ativar');
    } finally {
      setSalvando(false);
    }
  };

  const desligar = async () => {
    setSalvando(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await apiFetch('/api/push/cancelar', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setAtivo(false);
      toast.success('Notificações desativadas neste aparelho');
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível desativar');
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    try {
      const r: { enviados: number } = await apiFetch('/api/push/teste', { method: 'POST' });
      toast.success(r.enviados ? 'Notificação de teste enviada' : 'Nenhum aparelho inscrito');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  let descricao: React.ReactNode = 'Aviso no aparelho no dia do vencimento e quando um orçamento passa de 80%.';
  if (!suportado()) {
    descricao = ehIOS() && !rodandoComoApp()
      ? 'No iPhone, instale o Lyonk na tela de início (Compartilhar → Adicionar à Tela de Início) para receber avisos.'
      : 'Este navegador não aceita notificações.';
  } else if (!disponivel) {
    descricao = 'Ainda não configurado no servidor.';
  }

  return (
    <Row
      icon={BellRing}
      title="Notificações neste aparelho"
      description={
        <>
          {descricao}
          {ativo && <button type="button" onClick={testar} className="ml-1 font-medium text-brand hover:underline">Enviar teste</button>}
        </>
      }
      control={
        suportado() && disponivel ? (
          carregando ? <Button variant="ghost" size="sm" isLoading>…</Button> : (
            <Switch checked={ativo} disabled={salvando} onChange={(v) => (v ? ligar() : desligar())} label="Notificações neste aparelho" />
          )
        ) : undefined
      }
    />
  );
}
