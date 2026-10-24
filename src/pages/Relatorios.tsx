import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { useDespesas, useModelos, useReceitas, useRecorrentes, useSaldo } from '../hooks/queries';
import { useAuth } from '../contexts/AuthContext';
import { useEspaco } from '../contexts/EspacoContext';
import { Button } from '../components/ui/button';
import { Card, CardHeader, PageHeader, Segmented, Skeleton, Stat } from '../components/ui/primitives';
import { ChartTooltip, useChartColors } from '../components/finance/charts';
import { categoryIcon } from '../lib/categories';
import { cn } from '../lib/cn';
import { dateKey, formatBRL, formatBRLCompact, MONTHS, MONTHS_SHORT, percent } from '../lib/format';
import { chaveMes, gastoPorCategoria, projetarCaixa, ultimosMeses } from '../lib/planejamento';
import { baixar, gerarXlsx, type Celula } from '../lib/xlsx';

type Periodo = '6m' | '12m' | 'ano' | 'anterior';

const rotuloMes = (chave: string, curto = true) => {
  const [y, m] = chave.split('-').map(Number);
  return curto ? `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}` : `${MONTHS[m - 1]} ${y}`;
};

export default function Relatorios() {
  const { user } = useAuth();
  const { visao } = useEspaco();
  const colors = useChartColors();
  const [periodo, setPeriodo] = useState<Periodo>('6m');
  const despesasQ = useDespesas();
  const receitasQ = useReceitas();
  const modelosQ = useModelos();
  const recorrentesQ = useRecorrentes();
  const saldoQ = useSaldo();

  const hoje = new Date();
  const chaves = useMemo(() => {
    if (periodo === '6m') return ultimosMeses(6);
    if (periodo === '12m') return ultimosMeses(12);
    const ano = periodo === 'ano' ? hoje.getFullYear() : hoje.getFullYear() - 1;
    return Array.from({ length: 12 }, (_, i) => chaveMes(ano, i + 1));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const dados = useMemo(() => {
    const despesas = despesasQ.data ?? [];
    const receitas = (receitasQ.data ?? []).filter((r) => !r.pendente);
    const mensal = chaves.map((k) => {
      const rec = receitas.filter((r) => dateKey(r.data_recebimento).slice(0, 7) === k).reduce((a, r) => a + (Number(r.valor) || 0), 0);
      const cat = gastoPorCategoria(despesas, [k]);
      const des = cat.reduce((a, c) => a + c.total, 0);
      return { chave: k, rotulo: rotuloMes(k), receitas: rec, despesas: des, resultado: rec - des };
    });
    const categorias = gastoPorCategoria(despesas, chaves);
    const totalRec = mensal.reduce((a, m) => a + m.receitas, 0);
    const totalDes = mensal.reduce((a, m) => a + m.despesas, 0);
    const origens = new Map<string, number>();
    for (const r of receitas) {
      if (!chaves.includes(dateKey(r.data_recebimento).slice(0, 7))) continue;
      origens.set(r.categoria || 'Outros', (origens.get(r.categoria || 'Outros') ?? 0) + (Number(r.valor) || 0));
    }
    return {
      mensal,
      categorias,
      totalRec,
      totalDes,
      resultado: totalRec - totalDes,
      poupanca: totalRec > 0 ? Math.round(((totalRec - totalDes) / totalRec) * 100) : 0,
      origens: [...origens.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [despesasQ.data, receitasQ.data, chaves]);

  const projecao = useMemo(() => projetarCaixa({
    saldoAtual: saldoQ.data ?? 0,
    despesas: despesasQ.data ?? [],
    receitas: receitasQ.data ?? [],
    modelos: modelosQ.data ?? [],
    recorrentes: recorrentesQ.data ?? [],
  }), [saldoQ.data, despesasQ.data, receitasQ.data, modelosQ.data, recorrentesQ.data]);

  const loading = despesasQ.isLoading || receitasQ.isLoading;
  const titulo = `${rotuloMes(chaves[0], false)} a ${rotuloMes(chaves[chaves.length - 1], false)}`;
  const nomeVisao = visao === 'tudo' ? '' : visao === 'empresa' ? ' (empresa)' : ' (pessoal)';

  const exportarExcel = () => {
    const moeda = (v: number, negrito = false): Celula => ({ v, moeda: true, negrito });
    const b = (t: string): Celula => ({ t, negrito: true });
    const resumo: Celula[][] = [
      [b('Mês'), b('Receitas'), b('Despesas'), b('Resultado')],
      ...dados.mensal.map((m) => [rotuloMes(m.chave, false), moeda(m.receitas), moeda(m.despesas), moeda(m.resultado)]),
      [b('Total'), moeda(dados.totalRec, true), moeda(dados.totalDes, true), moeda(dados.resultado, true)],
    ];
    const porCat: Celula[][] = [
      [b('Categoria'), ...chaves.map((k) => b(rotuloMes(k))), b('Total'), b('Média')],
      ...dados.categorias.map((c) => [c.categoria, ...c.valores.map((v) => moeda(v)), moeda(c.total, true), moeda(c.total / chaves.length)]),
      [b('Total'), ...chaves.map((_, i) => moeda(dados.categorias.reduce((a, c) => a + c.valores[i], 0), true)), moeda(dados.totalDes, true), moeda(dados.totalDes / chaves.length, true)],
    ];
    const proj: Celula[][] = [
      [b('Mês'), b('Entradas previstas'), b('Saídas previstas'), b('Saldo projetado')],
      ...projecao.map((p) => [rotuloMes(p.chave, false), moeda(p.entradas), moeda(p.saidas), moeda(p.saldo)]),
    ];
    const lancamentos: Celula[][] = [
      [b('Data'), b('Tipo'), b('Descrição'), b('Categoria'), b('Valor'), b('Situação')],
      ...(receitasQ.data ?? [])
        .filter((r) => chaves.includes(dateKey(r.data_recebimento).slice(0, 7)))
        .map((r) => [dateKey(r.data_recebimento).split('-').reverse().join('/'), 'Receita', r.descricao, r.categoria || 'Outros', moeda(Number(r.valor)), r.pendente ? 'A receber' : 'Recebida']),
      ...(despesasQ.data ?? [])
        .filter((d) => chaves.includes(dateKey(d.data_vencimento).slice(0, 7)))
        .map((d) => [dateKey(d.data_vencimento).split('-').reverse().join('/'), 'Despesa', d.descricao, d.categoria || 'Outros', moeda(-(d.pago && d.valor_pago ? Number(d.valor_pago) : Number(d.valor))), d.pago ? 'Paga' : 'Pendente']),
    ];
    const blob = gerarXlsx([
      { nome: 'Resultado', linhas: resumo, larguras: [20, 16, 16, 16] },
      { nome: 'Por categoria', linhas: porCat, larguras: [24, ...chaves.map(() => 13), 15, 15] },
      { nome: 'Projeção', linhas: proj, larguras: [20, 20, 20, 20] },
      { nome: 'Lançamentos', linhas: lancamentos, larguras: [12, 10, 40, 20, 15, 12] },
    ]);
    baixar(blob, `lyonk-relatorio-${chaves[0]}-a-${chaves[chaves.length - 1]}.xlsx`);
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Relatórios"
        description="Resultado mês a mês, gastos por categoria e projeção de caixa."
        actions={
          <div className="no-print flex w-full flex-wrap gap-2 lg:w-auto">
            <Segmented
              value={periodo}
              onChange={setPeriodo}
              options={[
                { value: '6m', label: '6 meses' },
                { value: '12m', label: '12 meses' },
                { value: 'ano', label: String(hoje.getFullYear()) },
                { value: 'anterior', label: String(hoje.getFullYear() - 1) },
              ]}
              className="w-full sm:w-auto"
            />
            <Button variant="secondary" onClick={() => window.print()} className="flex-1 sm:flex-none"><Printer size={17} /> PDF</Button>
            <Button variant="secondary" onClick={exportarExcel} disabled={loading} className="flex-1 sm:flex-none"><FileSpreadsheet size={17} /> Excel</Button>
          </div>
        }
      />

      {/* Cabeçalho que só aparece no PDF */}
      <div className="print-only mb-4">
        <p className="text-xl font-semibold">Lyonk · Relatório financeiro{nomeVisao}</p>
        <p className="text-sm">{user?.name} · {titulo} · gerado em {hoje.toLocaleDateString('pt-BR')}</p>
      </div>

      <Card className="print-avoid grid grid-cols-2 gap-4 p-5 sm:p-6 lg:grid-cols-4">
        <Stat label="Receitas" value={formatBRL(dados.totalRec)} tone="pos" />
        <Stat label="Despesas" value={formatBRL(dados.totalDes)} tone="neg" />
        <Stat label="Resultado" value={formatBRL(dados.resultado)} tone={dados.resultado >= 0 ? 'pos' : 'neg'} />
        <Stat label="Taxa de poupança" value={`${dados.poupanca}%`} sub="do que entrou ficou" tone={dados.poupanca >= 10 ? 'pos' : dados.poupanca >= 0 ? 'warn' : 'neg'} />
      </Card>

      <div className="grid gap-4 lg:gap-6 2xl:grid-cols-2">
        <Card className="print-avoid overflow-hidden">
          <CardHeader title="Resultado mês a mês" description={titulo} />
          {loading ? <Skeleton className="m-5 h-56" /> : (
            <>
              <div className="h-56 px-2 pt-4 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados.mensal} barGap={3} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={colors.grid} />
                    <XAxis dataKey="rotulo" tick={{ fill: colors.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatBRLCompact} tick={{ fill: colors.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.grid, opacity: 0.4 }} />
                    <Bar dataKey="receitas" name="Receitas" fill={colors.pos} radius={[4, 4, 0, 0]} animationDuration={700} />
                    <Bar dataKey="despesas" name="Despesas" fill={colors.neg} radius={[4, 4, 0, 0]} animationDuration={700} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="mt-3 w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-y border-line bg-elevated/40 text-left text-[13px] text-muted">
                      <th className="px-4 py-2 font-medium sm:px-5">Mês</th>
                      <th className="px-3 py-2 text-right font-medium">Receitas</th>
                      <th className="px-3 py-2 text-right font-medium">Despesas</th>
                      <th className="px-4 py-2 text-right font-medium sm:px-5">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular-nums">
                    {dados.mensal.map((m) => (
                      <tr key={m.chave}>
                        <td className="px-4 py-2 text-fg sm:px-5">{rotuloMes(m.chave, false)}</td>
                        <td className="px-3 py-2 text-right text-pos">{formatBRL(m.receitas)}</td>
                        <td className="px-3 py-2 text-right text-fg">{formatBRL(m.despesas)}</td>
                        <td className={cn('px-4 py-2 text-right font-semibold sm:px-5', m.resultado >= 0 ? 'text-pos' : 'text-neg')}>{formatBRL(m.resultado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        <Card className="print-avoid overflow-hidden">
          <CardHeader title="Projeção de caixa" description="Próximos 6 meses: fixas, parcelas, faturas, recorrentes e a média dos gastos variáveis" />
          <div className="h-56 px-2 pt-4 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projecao} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="proj-rel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.brand} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="rotulo" tick={{ fill: colors.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatBRLCompact} tick={{ fill: colors.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
                <ReferenceLine y={0} stroke={colors.neg} strokeDasharray="4 4" />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="saldo" name="Saldo projetado" stroke={colors.brand} strokeWidth={2.5} fill="url(#proj-rel)" animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-y border-line bg-elevated/40 text-left text-[13px] text-muted">
                  <th className="px-4 py-2 font-medium sm:px-5">Mês</th>
                  <th className="px-3 py-2 text-right font-medium">Entradas</th>
                  <th className="px-3 py-2 text-right font-medium">Saídas</th>
                  <th className="px-4 py-2 text-right font-medium sm:px-5">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {projecao.map((p) => (
                  <tr key={p.chave}>
                    <td className="px-4 py-2 text-fg sm:px-5">{rotuloMes(p.chave, false)}</td>
                    <td className="px-3 py-2 text-right text-pos">{formatBRL(p.entradas)}</td>
                    <td className="px-3 py-2 text-right text-fg">{formatBRL(p.saidas)}</td>
                    <td className={cn('px-4 py-2 text-right font-semibold sm:px-5', p.saldo >= 0 ? 'text-fg' : 'text-neg')}>{formatBRL(p.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="print-break overflow-hidden">
        <CardHeader title="Despesas por categoria" description={`${titulo}${nomeVisao}`} />
        {loading ? <Skeleton className="m-5 h-48" /> : dados.categorias.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-subtle">Nenhuma despesa no período.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-line bg-elevated/40 text-[13px] text-muted">
                  <th className="sticky left-0 bg-surface px-4 py-2 text-left font-medium sm:px-5">Categoria</th>
                  {chaves.map((k) => <th key={k} className="px-3 py-2 text-right font-medium">{rotuloMes(k)}</th>)}
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium sm:px-5">Média</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {dados.categorias.map((c) => {
                  const Icon = categoryIcon(c.categoria);
                  const max = Math.max(...c.valores, 1);
                  return (
                    <tr key={c.categoria} className="print-avoid">
                      <td className="sticky left-0 bg-surface px-4 py-2 sm:px-5">
                        <span className="flex items-center gap-2 text-fg"><Icon size={15} className="shrink-0 text-muted" /> <span className="truncate">{c.categoria}</span></span>
                      </td>
                      {c.valores.map((v, i) => (
                        <td key={i} className="relative px-3 py-2 text-right">
                          {/* Fundo proporcional ao mês mais caro da categoria: um mapa de calor discreto */}
                          <span className="absolute inset-y-1 right-1 rounded bg-brand/10" style={{ width: `calc(${(v / max) * 100}% - 8px)` }} />
                          <span className={cn('relative', v ? 'text-fg' : 'text-subtle')}>{v ? formatBRL(v, { cents: false }) : '–'}</span>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-semibold text-fg">{formatBRL(c.total, { cents: false })}</td>
                      <td className="px-4 py-2 text-right text-muted sm:px-5">{formatBRL(c.total / chaves.length, { cents: false })}</td>
                    </tr>
                  );
                })}
                <tr className="bg-elevated/40 font-semibold">
                  <td className="sticky left-0 bg-elevated px-4 py-2 sm:px-5">Total</td>
                  {chaves.map((_, i) => <td key={i} className="px-3 py-2 text-right">{formatBRL(dados.categorias.reduce((a, c) => a + c.valores[i], 0), { cents: false })}</td>)}
                  <td className="px-3 py-2 text-right">{formatBRL(dados.totalDes, { cents: false })}</td>
                  <td className="px-4 py-2 text-right sm:px-5">{formatBRL(dados.totalDes / chaves.length, { cents: false })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dados.origens.length > 0 && (
        <Card className="print-avoid p-5">
          <p className="text-[15px] font-semibold text-fg">De onde veio o dinheiro</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {dados.origens.map(([nome, valor]) => (
              <li key={nome} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{nome}</span>
                <span className="text-sm font-semibold tabular-nums text-fg">{formatBRL(valor)}</span>
                <span className="w-10 text-right text-xs text-muted">{percent(valor, dados.totalRec)}%</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
