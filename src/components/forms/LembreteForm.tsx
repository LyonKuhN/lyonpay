import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input, Textarea } from '../ui/input';
import { apiFetch } from '../../services/api';
import { toISODate } from '../../lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Data sugerida (AAAA-MM-DD), por exemplo o dia tocado no calendário. */
  defaultDate?: string;
}

/** Próxima hora cheia, no fuso local, no formato do datetime-local. */
function suggestedDateTime(date?: string): string {
  if (date) return `${date}T09:00`;
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return `${toISODate(d)}T${String(d.getHours()).padStart(2, '0')}:00`;
}

export function LembreteFormSheet({ open, onClose, defaultDate }: Props) {
  const qc = useQueryClient();
  const formId = useId();

  const create = useMutation({
    mutationFn: (payload: { titulo: string; descricao: string; data_lembrete: string }) =>
      apiFetch('/api/lembretes', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lembretes'] });
      toast.success('Lembrete criado');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível criar o lembrete'),
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Novo lembrete"
      description="Aparece no Início e na Agenda."
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1 sm:flex-none">Cancelar</Button>
          <Button type="submit" form={formId} size="lg" isLoading={create.isPending} className="flex-[2] sm:flex-none sm:min-w-40 sm:ml-auto">
            Criar lembrete
          </Button>
        </div>
      }
    >
      {open && <LembreteFormBody key={defaultDate ?? 'novo'} formId={formId} defaultDate={defaultDate} onSubmit={(p) => create.mutate(p)} />}
    </Sheet>
  );
}

function LembreteFormBody({ formId, defaultDate, onSubmit }: {
  formId: string;
  defaultDate?: string;
  onSubmit: (p: { titulo: string; descricao: string; data_lembrete: string }) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [quando, setQuando] = useState(suggestedDateTime(defaultDate));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !quando) return;
    onSubmit({ titulo: titulo.trim(), descricao: descricao.trim(), data_lembrete: new Date(quando).toISOString() });
  };

  return (
    <form id={formId} onSubmit={submit} className="space-y-5 pt-1">
      <Input label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Renovar seguro do carro" required autoFocus maxLength={120} />
      <Input label="Data e hora" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} required />
      <Textarea label="Detalhes" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" maxLength={500} />
    </form>
  );
}
