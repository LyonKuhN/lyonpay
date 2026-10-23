import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { apiFetch } from '../../services/api';

interface Props {
  open: boolean;
  tipo: 'despesa' | 'receita';
  onClose: () => void;
  onCreated?: (nome: string) => void;
}

export function CategoriaSheet({ open, tipo, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const [nome, setNome] = useState('');

  const create = useMutation({
    mutationFn: (n: string) => apiFetch('/api/categorias', {
      method: 'POST',
      body: JSON.stringify({ nome: n, tipo, cor: '#d4af5f', icone: 'Tag' }),
    }),
    onSuccess: (_, n) => {
      qc.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoria criada');
      onCreated?.(n);
      setNome('');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível criar a categoria'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const n = nome.trim();
    if (n) create.mutate(n);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Nova categoria"
      description={tipo === 'despesa' ? 'Para organizar seus gastos.' : 'Para organizar suas entradas.'}
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={tipo === 'despesa' ? 'Ex.: Pets, Assinaturas' : 'Ex.: Dividendos, Freelas'}
          autoFocus
          required
          maxLength={40}
        />
        <Button type="submit" fullWidth size="lg" isLoading={create.isPending} disabled={!nome.trim()}>
          Criar categoria
        </Button>
      </form>
    </Sheet>
  );
}
