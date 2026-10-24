import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Camera, FileText, LoaderCircle, Paperclip, Trash2 } from 'lucide-react';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { useConfirm } from '../ui/confirm';
import { apiBlob, apiFetch } from '../../services/api';
import { useEspaco } from '../../contexts/EspacoContext';
import { formatDateTime } from '../../lib/format';
import { asArray, type Anexo } from '../../lib/types';

const LIMITE = 5 * 1024 * 1024;

/** Foto do comprovante: reduz para no máximo 1600 px e JPEG, o que deixa a maioria abaixo de 400 KB. */
async function comprimirImagem(file: File): Promise<{ base64: string; mime: string }> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  return { base64: dataUrl.split(',')[1], mime: 'image/jpeg' };
}

function lerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const tamanho = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Comprovantes de um lançamento: tirar foto, anexar PDF, ver e apagar. */
export function Anexos({ despesaId, receitaId }: { despesaId?: string; receitaId?: string }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { somenteLeitura } = useEspaco();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; nome: string } | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const filtro = despesaId ? `despesa_id=${despesaId}` : `receita_id=${receitaId}`;
  const key = ['anexos', despesaId ?? receitaId];

  const { data: anexos = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => apiFetch(`/api/anexos?${filtro}`),
    select: (d) => asArray<Anexo>(d),
  });

  const enviar = useMutation({
    mutationFn: async (file: File) => {
      const pdf = file.type === 'application/pdf';
      if (!pdf && !file.type.startsWith('image/')) throw new Error('Envie uma foto ou um PDF.');
      const { base64, mime } = pdf ? { base64: await lerBase64(file), mime: file.type } : await comprimirImagem(file);
      if (base64.length * 0.75 > LIMITE) throw new Error('Arquivo acima de 5 MB.');
      const nome = pdf ? file.name : file.name.replace(/\.[^.]+$/, '') + '.jpg';
      return apiFetch('/api/anexos', { method: 'POST', body: JSON.stringify({ despesa_id: despesaId, receita_id: receitaId, nome, mime, base64 }) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success('Comprovante anexado');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível anexar'),
  });

  const apagar = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/anexos/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (err: Error) => toast.error(err.message || 'Não foi possível apagar'),
  });

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const abrir = async (a: Anexo) => {
    setAbrindo(a.id);
    // O PDF abre em outra aba; a janela precisa nascer no clique para o navegador não bloquear
    const janela = a.mime === 'application/pdf' ? window.open('', '_blank') : null;
    try {
      const url = URL.createObjectURL(await apiBlob(`/api/anexos/${a.id}/arquivo`));
      if (janela) janela.location.href = url;
      else setPreview({ url, nome: a.nome });
    } catch (err) {
      janela?.close();
      toast.error((err as Error).message);
    } finally {
      setAbrindo(null);
    }
  };

  const remover = async (a: Anexo) => {
    if (await confirm({ title: 'Apagar comprovante?', description: a.nome, confirmText: 'Apagar', danger: true })) apagar.mutate(a.id);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">Comprovantes</p>
        {!somenteLeitura && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={enviar.isPending}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline disabled:opacity-50"
          >
            {enviar.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Camera size={14} />} Anexar
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviar.mutate(f);
            e.target.value = '';
          }}
        />
      </div>
      {isLoading ? null : anexos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-[13px] text-subtle">Nenhum comprovante. Tire uma foto do recibo ou anexe o PDF do boleto.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-bg">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
                {a.mime === 'application/pdf' ? <FileText size={17} /> : <Paperclip size={17} />}
              </span>
              <button type="button" onClick={() => abrir(a)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-fg hover:text-brand">{a.nome}</span>
                <span className="block text-xs text-subtle">{tamanho(a.tamanho)} · {formatDateTime(a.created_at)}</span>
              </button>
              {abrindo === a.id && <LoaderCircle size={16} className="animate-spin text-subtle" />}
              {!somenteLeitura && (
                <button type="button" onClick={() => remover(a)} aria-label="Apagar comprovante" className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-neg/10 hover:text-neg">
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!preview} onClose={() => setPreview(null)} title={preview?.nome} size="lg">
        {preview && (
          <div className="space-y-3">
            <img src={preview.url} alt={preview.nome} className="w-full rounded-xl border border-line object-contain" />
            <a href={preview.url} download={preview.nome} className="block">
              <Button variant="secondary" fullWidth>Baixar</Button>
            </a>
          </div>
        )}
      </Sheet>
    </div>
  );
}
