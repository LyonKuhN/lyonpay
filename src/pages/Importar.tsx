import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Check, FileUp, ListFilter, Trash2, UploadCloud, Wand2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { invalidateFinance, useCartoes, useCategorias, useContas, useRegras } from '../hooks/queries';
import { useEspaco } from '../contexts/EspacoContext';
import { Button } from '../components/ui/button';
import { Field, Select } from '../components/ui/input';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Switch } from '../components/ui/primitives';
import { EASE_OUT } from '../lib/motion';
import { cn } from '../lib/cn';
import { formatBRL, formatDate } from '../lib/format';
import {
  adivinharMapa, aplicarMapa, categoriaPorRegras, lerCSV, lerOFX, lerTexto, termoDaDescricao, type LinhaExtrato, type MapaCSV,
} from '../lib/extrato';

interface Item extends LinhaExtrato {
  importId: string;
  tipo: 'despesa' | 'receita';
  categoria: string;
  /** Categoria trocada à mão: vira regra se a pessoa quiser. */
  manual: boolean;
  marcado: boolean;
  duplicado: boolean;
}

export default function Importar() {
  const qc = useQueryClient();
  const { somenteLeitura } = useEspaco();
  const { data: contas = [] } = useContas();
  const { data: cartoes = [] } = useCartoes();
  const { data: catDesp = [] } = useCategorias('despesa');
  const { data: catRec = [] } = useCategorias('receita');
  const regrasQ = useRegras();
  const input = useRef<HTMLInputElement>(null);

  const [destino, setDestino] = useState('');
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [csv, setCsv] = useState<{ linhas: string[][]; mapa: MapaCSV } | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [lendo, setLendo] = useState(false);
  const [criarRegras, setCriarRegras] = useState(true);
  const [arrastando, setArrastando] = useState(false);

  const dest = destino || (contas.find((c) => c.ativo) ? `conta:${contas.find((c) => c.ativo)!.id}` : cartoes[0] ? `cartao:${cartoes[0].id}` : '');
  const [tipoDest, idDest] = dest.split(':') as ['conta' | 'cartao', string];
  const ehCartao = tipoDest === 'cartao';

  /** Classifica, aplica as regras e marca o que já foi importado antes. */
  const preparar = async (linhas: LinhaExtrato[]) => {
    const regras = regrasQ.data ?? [];
    const base: Item[] = linhas.map((l) => {
      const tipo = l.valor < 0 ? 'despesa' : 'receita';
      return {
        ...l,
        importId: `${tipoDest}:${idDest}:${l.id}`,
        tipo,
        categoria: categoriaPorRegras(regras, l.descricao, tipo) ?? 'Outros',
        manual: false,
        // Em fatura de cartão, valores positivos são pagamento da fatura ou estorno
        marcado: !(ehCartao && tipo === 'receita'),
        duplicado: false,
      };
    });
    try {
      const existentes: string[] = await apiFetch('/api/importar/existentes', { method: 'POST', body: JSON.stringify({ ids: base.map((i) => i.importId) }) });
      const set = new Set(existentes);
      for (const i of base) if (set.has(i.importId)) { i.duplicado = true; i.marcado = false; }
    } catch {
      // sem a checagem, o servidor ainda ignora repetidos na gravação
    }
    setItens(base.sort((a, b) => b.data.localeCompare(a.data)));
  };

  const abrirArquivo = async (file: File) => {
    if (!dest) return toast.error('Cadastre uma conta ou um cartão em Contas e cartões antes de importar.');
    setLendo(true);
    setArquivo(file.name);
    setCsv(null);
    try {
      const texto = await lerTexto(file);
      if (/<OFX>|OFXHEADER/i.test(texto.slice(0, 2000))) {
        const linhas = lerOFX(texto);
        if (!linhas.length) throw new Error('Não encontramos lançamentos neste OFX.');
        await preparar(linhas);
      } else {
        const linhas = lerCSV(texto);
        if (linhas.length < 2) throw new Error('O arquivo não parece um extrato em CSV.');
        const mapa = adivinharMapa(linhas[0]);
        if (ehCartao) mapa.positivoEhSaida = true;
        setCsv({ linhas, mapa });
        await preparar(aplicarMapa(linhas.slice(1), mapa));
      }
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível ler o arquivo');
      setItens([]);
      setArquivo(null);
    } finally {
      setLendo(false);
    }
  };

  const remapear = async (mapa: MapaCSV) => {
    if (!csv) return;
    setCsv({ ...csv, mapa });
    await preparar(aplicarMapa(csv.linhas.slice(1), mapa));
  };

  const importar = useMutation({
    mutationFn: async () => {
      const escolhidos = itens.filter((i) => i.marcado);
      const res: { inseridos: number; ignorados: number } = await apiFetch('/api/importar', {
        method: 'POST',
        body: JSON.stringify({
          destino: { tipo: tipoDest, id: idDest },
          itens: escolhidos.map((i) => ({ import_id: i.importId, tipo: i.tipo, descricao: i.descricao, valor: Math.abs(i.valor), data: i.data, categoria: i.categoria })),
        }),
      });
      if (criarRegras) {
        // Uma regra por termo: a próxima importação já vem categorizada
        const novas = new Map<string, Item>();
        for (const i of escolhidos.filter((x) => x.manual)) {
          const termo = termoDaDescricao(i.descricao);
          if (termo.length >= 3) novas.set(`${termo}|${i.tipo}`, i);
        }
        await Promise.all([...novas.entries()].map(([k, i]) =>
          apiFetch('/api/regras', { method: 'POST', body: JSON.stringify({ termo: k.split('|')[0], categoria: i.categoria, tipo: i.tipo }) }),
        ));
      }
      return res;
    },
    onSuccess: (res) => {
      invalidateFinance(qc);
      qc.invalidateQueries({ queryKey: ['regras'] });
      toast.success(`${res.inseridos} ${res.inseridos === 1 ? 'lançamento importado' : 'lançamentos importados'}${res.ignorados ? ` · ${res.ignorados} ignorados` : ''}`, { duration: 5000 });
      setItens([]);
      setArquivo(null);
      setCsv(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível importar'),
  });

  const removerRegra = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/regras/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regras'] }),
  });

  const resumo = useMemo(() => {
    const m = itens.filter((i) => i.marcado);
    return {
      n: m.length,
      saidas: m.filter((i) => i.tipo === 'despesa').reduce((a, i) => a + Math.abs(i.valor), 0),
      entradas: m.filter((i) => i.tipo === 'receita').reduce((a, i) => a + i.valor, 0),
      duplicados: itens.filter((i) => i.duplicado).length,
    };
  }, [itens]);

  const atualizar = (id: string, mudar: Partial<Item>) => setItens((lista) => lista.map((i) => (i.id === id ? { ...i, ...mudar } : i)));

  const colunas = csv?.linhas[0] ?? [];

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Importar extrato" description="Arquivo OFX ou CSV do banco ou da fatura do cartão. Nada é lançado duas vezes." />

      {/* Celular: arquivo, colunas, prévia e regras, nessa ordem; desktop: prévia ao lado */}
      <div className="flex flex-col gap-4 lg:gap-6 xl:grid xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
        <div className="contents xl:sticky xl:top-8 xl:block xl:space-y-4">
          <Card className="order-1 space-y-4 p-5">
            <Select label="Lançar em" value={dest} onChange={(e) => { setDestino(e.target.value); setItens([]); setArquivo(null); setCsv(null); }} disabled={somenteLeitura}>
              {contas.filter((c) => c.ativo).length > 0 && (
                <optgroup label="Contas">
                  {contas.filter((c) => c.ativo).map((c) => <option key={c.id} value={`conta:${c.id}`}>{c.nome}</option>)}
                </optgroup>
              )}
              {cartoes.filter((c) => c.ativo).length > 0 && (
                <optgroup label="Faturas de cartão">
                  {cartoes.filter((c) => c.ativo).map((c) => <option key={c.id} value={`cartao:${c.id}`}>{c.nome}</option>)}
                </optgroup>
              )}
            </Select>

            <button
              type="button"
              disabled={somenteLeitura || !dest}
              onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                const f = e.dataTransfer.files?.[0];
                if (f) abrirArquivo(f);
              }}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors disabled:opacity-50',
                arrastando ? 'border-brand bg-brand/8' : 'border-line-strong hover:border-brand/60 hover:bg-elevated/50',
              )}
            >
              <motion.span animate={{ y: arrastando ? -4 : 0 }} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 text-brand">
                <UploadCloud size={24} />
              </motion.span>
              <span className="text-[15px] font-semibold text-fg">{lendo ? 'Lendo arquivo…' : arquivo ?? 'Escolher arquivo'}</span>
              <span className="text-[13px] text-muted">OFX ou CSV · o arquivo é lido no seu aparelho</span>
            </button>
            <input ref={input} type="file" accept=".ofx,.csv,.txt,application/x-ofx,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) abrirArquivo(f); e.target.value = ''; }} />

            {!dest && <p className="text-[13px] text-warn">Cadastre uma conta ou um cartão em Contas e cartões primeiro.</p>}
          </Card>

          {csv && (
            <Card className="order-2 space-y-3 p-5">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-fg"><ListFilter size={16} /> Colunas do CSV</p>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Data" value={csv.mapa.data} onChange={(e) => remapear({ ...csv.mapa, data: +e.target.value })}>
                  {colunas.map((c, i) => <option key={i} value={i}>{c || `Coluna ${i + 1}`}</option>)}
                </Select>
                <Select label="Descrição" value={csv.mapa.descricao} onChange={(e) => remapear({ ...csv.mapa, descricao: +e.target.value })}>
                  {colunas.map((c, i) => <option key={i} value={i}>{c || `Coluna ${i + 1}`}</option>)}
                </Select>
                <Select label="Valor" value={csv.mapa.valor} onChange={(e) => remapear({ ...csv.mapa, valor: +e.target.value })}>
                  <option value={-1}>Débito e crédito separados</option>
                  {colunas.map((c, i) => <option key={i} value={i}>{c || `Coluna ${i + 1}`}</option>)}
                </Select>
                {csv.mapa.valor < 0 && (
                  <>
                    <Select label="Débito" value={csv.mapa.debito} onChange={(e) => remapear({ ...csv.mapa, debito: +e.target.value })}>
                      {colunas.map((c, i) => <option key={i} value={i}>{c || `Coluna ${i + 1}`}</option>)}
                    </Select>
                    <Select label="Crédito" value={csv.mapa.credito} onChange={(e) => remapear({ ...csv.mapa, credito: +e.target.value })}>
                      {colunas.map((c, i) => <option key={i} value={i}>{c || `Coluna ${i + 1}`}</option>)}
                    </Select>
                  </>
                )}
              </div>
              {csv.mapa.valor >= 0 && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                  <span className="text-sm text-fg">Valores positivos são gastos</span>
                  <Switch checked={csv.mapa.positivoEhSaida} onChange={(v) => remapear({ ...csv.mapa, positivoEhSaida: v })} label="Valores positivos são gastos" />
                </div>
              )}
            </Card>
          )}

          <Card className="order-4 overflow-hidden">
            <CardHeader title="Regras de categoria" description="Termo na descrição → categoria. Criadas quando você corrige a categoria na importação." />
            {(regrasQ.data ?? []).length === 0 ? (
              <p className="px-5 pb-5 pt-3 text-[13px] text-subtle">Nenhuma regra ainda.</p>
            ) : (
              <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto border-t border-line">
                {(regrasQ.data ?? []).map((r) => (
                  <li key={r.id} className="flex items-center gap-2 px-4 py-2.5 text-sm sm:px-5">
                    <span className="min-w-0 flex-1 truncate"><span className="font-medium text-fg">“{r.termo}”</span> <span className="text-muted">→ {r.categoria}</span></span>
                    {!somenteLeitura && (
                      <button type="button" onClick={() => removerRegra.mutate(r.id)} aria-label="Apagar regra" className="text-subtle hover:text-neg"><Trash2 size={14} /></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className={cn('order-3 overflow-hidden', itens.length === 0 && 'hidden xl:block')}>
          {itens.length === 0 ? (
            <EmptyState
              icon={FileUp}
              title="Escolha o arquivo do extrato"
              description="No app ou no site do banco, procure por “exportar extrato” em OFX (Money/Quicken) ou CSV. Na fatura do cartão, exporte em CSV."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-fg">{resumo.n}</span> selecionados ·
                  <span className="text-neg"> {formatBRL(resumo.saidas)}</span> saídas ·
                  <span className="text-pos"> {formatBRL(resumo.entradas)}</span> entradas
                </p>
                {resumo.duplicados > 0 && <Badge tone="info">{resumo.duplicados} já importados</Badge>}
                <button type="button" onClick={() => setItens((l) => l.map((i) => ({ ...i, marcado: !i.duplicado })))} className="ml-auto text-[13px] font-medium text-brand hover:underline">Marcar todos</button>
                <button type="button" onClick={() => setItens((l) => l.map((i) => ({ ...i, marcado: false })))} className="text-[13px] font-medium text-muted hover:text-fg">Nenhum</button>
              </div>
              <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto xl:max-h-[calc(100vh-17rem)]">
                <AnimatePresence initial={false}>
                  {itens.map((i, idx) => {
                    const cats = i.tipo === 'despesa' ? catDesp : catRec;
                    const opcoes = cats.some((c) => c.nome === i.categoria) ? cats.map((c) => c.nome) : [i.categoria, ...cats.map((c) => c.nome)];
                    return (
                      <motion.li
                        key={i.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(idx, 20) * 0.015, ease: EASE_OUT }}
                        className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5', (i.duplicado || !i.marcado) && 'opacity-55')}
                      >
                        <button
                          type="button"
                          onClick={() => atualizar(i.id, { marcado: !i.marcado })}
                          aria-label={i.marcado ? 'Desmarcar' : 'Marcar'}
                          className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors', i.marcado ? 'border-brand bg-brand text-on-brand' : 'border-line-strong')}
                        >
                          {i.marcado && <Check size={14} strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">{i.descricao}</p>
                          <p className="text-xs text-muted">{formatDate(i.data)}{i.duplicado ? ' · já importado' : ''}</p>
                        </div>
                        <select
                          value={i.categoria}
                          onChange={(e) => atualizar(i.id, { categoria: e.target.value, manual: true })}
                          className={cn('h-9 w-[calc(100%-2.25rem)] rounded-lg border bg-bg px-2 text-[13px] text-fg outline-none focus:border-brand sm:w-40', i.manual ? 'border-brand/50' : 'border-line-strong')}
                          aria-label="Categoria"
                        >
                          {opcoes.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span className={cn('w-28 shrink-0 text-right text-sm font-semibold tabular-nums', i.tipo === 'receita' ? 'text-pos' : 'text-fg')}>
                          {formatBRL(i.valor, { sign: true })}
                        </span>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
              <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                <Field className="flex-1">
                  <label className="flex items-center gap-3 text-sm text-fg">
                    <Switch checked={criarRegras} onChange={setCriarRegras} label="Lembrar categorias corrigidas" />
                    <span className="flex items-center gap-1.5"><Wand2 size={15} className="text-brand" /> Lembrar as categorias que corrigi</span>
                  </label>
                </Field>
                <Button size="lg" disabled={resumo.n === 0 || somenteLeitura} isLoading={importar.isPending} onClick={() => importar.mutate()}>
                  Importar {resumo.n} {resumo.n === 1 ? 'lançamento' : 'lançamentos'}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
