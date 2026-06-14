import { useState } from 'react';
import { Calendar, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Zap, Info, Check, RotateCcw, AlertTriangle, DollarSign, Tag, X, PieChart, Wallet, Layers, ArrowUp, ArrowDown, Edit2, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
};

export default function Pagamentos() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());

  const [activeTab, setActiveTab] = useState<'pendentes' | 'pagas'>('pendentes');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());

  // Filtros Avançados
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterValorMin, setFilterValorMin] = useState('');
  const [filterValorMax, setFilterValorMax] = useState('');

  const getRelativeTime = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateStr);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { text: 'Vence HOJE', color: 'text-[#FFD700]' };
    if (diffDays === 1) return { text: 'Vence Amanhã', color: 'text-[#a3ff12]' };
    if (diffDays > 0) return { text: `Vence em ${diffDays} dias`, color: 'text-zinc-400' };
    const absDays = Math.abs(diffDays);
    return { text: `Atrasado há ${absDays} ${absDays === 1 ? 'dia' : 'dias'}`, color: 'text-[#FF4D4D] font-black' };
  };

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevYear = prevDate.getFullYear();

  const { data: despesasRaw = [], isLoading: load1 } = useQuery({ queryKey: ['despesas', year, month], queryFn: () => apiFetch(`/api/despesas?month=${month}&year=${year}`), enabled: !!token });
  const { data: prevMonthDespesasRaw = [], isLoading: load2 } = useQuery({ queryKey: ['despesas', prevYear, prevMonth], queryFn: () => apiFetch(`/api/despesas?month=${prevMonth}&year=${prevYear}`), enabled: !!token });
  const { data: atrasadasRaw = [], isLoading: load3 } = useQuery({ queryKey: ['despesas', 'atrasadas'], queryFn: () => apiFetch('/api/despesas/atrasadas'), enabled: !!token });
  const { data: categoriasAll = [], isLoading: load4 } = useQuery({ queryKey: ['categorias'], queryFn: () => apiFetch('/api/categorias'), enabled: !!token });
  const { data: saldoData = { saldoGlobal: 0 }, isLoading: loadSaldo } = useQuery({ queryKey: ['dashboard', 'saldo'], queryFn: () => apiFetch('/api/dashboard/saldo'), enabled: !!token });

  const despesas = Array.isArray(despesasRaw) ? despesasRaw : [];
  const prevMonthDespesas = Array.isArray(prevMonthDespesasRaw) ? prevMonthDespesasRaw : [];
  const atrasadas = Array.isArray(atrasadasRaw) ? atrasadasRaw : [];
  const categorias = Array.isArray(categoriasAll) ? categoriasAll.filter((c: any) => c.tipo === 'despesa') : [];

  const loading = load1 || load2 || load3 || load4 || loadSaldo;

  const togglePagoMutation = useMutation({
    mutationFn: ({ id, isPago }: { id: string; isPago: boolean }) => apiFetch(`/api/despesas/${id}/${isPago ? 'pendente' : 'pagar'}`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'saldo'] });
    }
  });

  const updateValor = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: number }) => apiFetch(`/api/despesas/${id}/valor`, { method: 'PATCH', body: JSON.stringify({ valor }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'saldo'] });
      setEditingId(null);
    }
  });

  const gerarFixas = useMutation({
    mutationFn: () => apiFetch('/api/despesas/gerar-fixas', { method: 'POST', body: JSON.stringify({ month, year }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['despesas'] })
  });

  const handleToggleState = (id: string, isPago: boolean) => {
    setAnimatingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      togglePagoMutation.mutate({ id, isPago }, {
        onSettled: () => {
          setAnimatingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      });
    }, 400);
  };

  const handlePagar = (id: string) => handleToggleState(id, false);
  const handleUndo = (id: string) => handleToggleState(id, true);

  const handleUpdateValor = (id: string) => {
    const valorNum = parseFloat(editingValue.replace(',', '.'));
    if (!isNaN(valorNum)) updateValor.mutate({ id, valor: valorNum });
  };

  const calculateDiff = (current: number, prev: number) => {
    if (prev === 0) return 0;
    return ((current - prev) / prev) * 100;
  };

  const handleGerarFixas = () => gerarFixas.mutate();

  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));

  // Despesas atrasadas SOMENTE de meses anteriores ao mês visualizado
  const atrasadasMesesAnteriores = atrasadas.filter((d: any) => {
    const venc = new Date(d.data_vencimento);
    return (
      venc.getFullYear() < currentDate.getFullYear() ||
      (venc.getFullYear() === currentDate.getFullYear() && venc.getMonth() < currentDate.getMonth())
    );
  });

  // Aplica filtros na lista de despesas do mês atual
  const filteredDespesas = despesas.filter(d => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!d.descricao?.toLowerCase().includes(q) && !d.valor?.toString().includes(q)) return false;
    }
    if (filterCategoria && d.categoria !== filterCategoria) return false;
    
    const valor = Number(d.valor);
    if (filterValorMin && valor < Number(filterValorMin)) return false;
    if (filterValorMax && valor > Number(filterValorMax)) return false;
    
    return true;
  });

  // Pendentes do mês atual ordenados por data de vencimento (crescente)
  const pendentes = filteredDespesas
    .filter(d => !d.pago)
    .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());
  const pagas = filteredDespesas.filter(d => d.pago);

  const totalCurr = filteredDespesas.reduce((a, c) => a + Number(c.valor), 0);
  const totalPrev = prevMonthDespesas.reduce((a, c) => a + Number(c.valor), 0);
  const diffTotal = calculateDiff(totalCurr, totalPrev);

  const pendenteCurr = pendentes.reduce((a, c) => a + Number(c.valor), 0);
  const pendentePrev = prevMonthDespesas.filter(d => !d.pago).reduce((a, c) => a + Number(c.valor), 0);
  const diffPendente = calculateDiff(pendenteCurr, pendentePrev);

  const atrasadasTotal = atrasadasMesesAnteriores.reduce((a: number, c: any) => a + Number(c.valor), 0);
  const pendenteTotal = pendenteCurr + atrasadasTotal;
  const saldoAtual = Number(saldoData.saldoGlobal || 0);
  const saldoProjetado = saldoAtual - pendenteTotal;

  const pagaCurr = pagas.reduce((a, c) => a + Number(c.valor), 0);
  const pagaPrev = prevMonthDespesas.filter(d => d.pago).reduce((a, c) => a + Number(c.valor), 0);
  const diffPaga = calculateDiff(pagaCurr, pagaPrev);

  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });

  return (
    <div className="animate-in fade-in duration-700 max-w-6xl mx-auto pt-4 pb-20 px-4 md:px-6">

      {/* Projeção de Caixa */}
      <div className="mb-8 p-6 rounded-[2rem] bg-[#15151A] border border-white/5 shadow-2xl overflow-hidden relative group">
        <div className={`absolute -top-10 -right-10 w-40 h-40 blur-[80px] opacity-20 transition-all ${saldoProjetado >= 0 ? 'bg-[#a3ff12]' : 'bg-[#FF4D4D]'}`} />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-white font-black text-xl md:text-2xl tracking-tighter flex items-center gap-2">
              <Wallet className="w-6 h-6 text-[#a3ff12]" />
              Projeção de Caixa
            </h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Saldo atual vs Contas a Pagar</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
            <div>
              <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-1">Saldo Disponível</p>
              <p className="text-lg font-black text-white">R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="hidden sm:block w-px bg-white/10" />
            <div>
              <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-1">A Pagar (Total)</p>
              <p className="text-lg font-black text-[#FFD700]">- R$ {pendenteTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="hidden sm:block w-px bg-white/10" />
            <div>
              <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-1">
                {saldoProjetado >= 0 ? 'Vai Sobrar' : 'Vai Faltar'}
              </p>
              <p className={`text-2xl font-black leading-none mt-1 ${saldoProjetado >= 0 ? 'text-[#a3ff12]' : 'text-[#FF4D4D]'}`}>
                {saldoProjetado >= 0 ? '+' : ''}R$ {saldoProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Espelho de Atrasos de Meses Anteriores */}
      {atrasadasMesesAnteriores.length > 0 && (
        <div className="mb-10 space-y-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-6 bg-[#FF4D4D] rounded-full" />
            <div>
              <h2 className="text-white font-black text-base md:text-lg tracking-tight">Espelho de Atrasos</h2>
              <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">
                {atrasadasMesesAnteriores.length} conta{atrasadasMesesAnteriores.length > 1 ? 's' : ''} pendente{atrasadasMesesAnteriores.length > 1 ? 's' : ''} de meses anteriores ·
                Total: <span className="text-[#FF4D4D]">R$ {atrasadasMesesAnteriores.reduce((a, c) => a + Number(c.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
          </div>
          {atrasadasMesesAnteriores.map((conta: any) => {
            const overdueDays = Math.abs(Math.ceil((new Date(conta.data_vencimento).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000));
            return (
              <div key={conta.id} className="p-4 md:p-5 rounded-2xl bg-[#FF4D4D]/5 border border-[#FF4D4D]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#FF4D4D]/40 transition-all">
                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#FF4D4D]/10 text-[#FF4D4D] flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white truncate">{conta.descricao}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[8px] font-black text-[#FF4D4D] uppercase tracking-widest">Atrasado {overdueDays} dia{overdueDays !== 1 ? 's' : ''}</span>
                      <span className="text-[8px] font-black text-zinc-600 uppercase">· Venc. {formatDate(conta.data_vencimento)}</span>
                      {conta.categoria && <span className="text-[8px] font-black text-zinc-500 uppercase">{conta.categoria}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <p className="text-lg md:text-2xl font-black text-white">R$ {Number(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <button onClick={() => handlePagar(conta.id)} className="px-5 py-2.5 bg-[#FF4D4D] text-white font-black rounded-xl text-[10px] hover:bg-[#FF4D4D]/90 active:scale-95 transition-all shadow-lg">
                    PAGAR
                  </button>
                </div>
              </div>
            );
          })}
          <div className="h-px bg-white/5 mt-6" />
        </div>
      )}

      {/* Header */}
      <header className="mb-8 md:mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">Pagamentos</h1>
          <p className="text-zinc-500 font-bold uppercase text-[8px] md:text-[10px] tracking-[0.3em] md:tracking-[0.4em]">{monthName} {currentDate.getFullYear()}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center md:justify-end gap-3 md:gap-4 w-full md:w-auto">
          <div className="flex items-center justify-between w-full sm:w-auto bg-[#15151A] border border-white/5 rounded-2xl p-1 shadow-2xl">
            <button onClick={handlePrevMonth} className="p-2 md:p-3 text-zinc-500 hover:text-white transition-colors"><ChevronLeft className="w-5 h-5" /></button>
            <div className="px-3 md:px-4 text-center flex-1 sm:flex-none min-w-[100px] md:min-w-[120px]">
              <p className="text-xs md:text-sm font-black text-white capitalize">{monthName}</p>
            </div>
            <button onClick={handleNextMonth} className="p-2 md:p-3 text-zinc-500 hover:text-white transition-colors"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => setIsCalendarOpen(true)} className="flex items-center justify-center p-3.5 md:p-4 bg-white/5 text-white border border-white/10 rounded-xl md:rounded-2xl shadow-lg transition-all hover:scale-110 active:scale-90 shrink-0"><Calendar className="w-5 h-5" /></button>
            <button onClick={handleGerarFixas} disabled={gerarFixas.isPending} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3.5 md:px-5 md:py-4 bg-[#a3ff12] text-black rounded-xl md:rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50">
              <Zap className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span className="font-black text-[9px] md:text-[10px] uppercase tracking-widest whitespace-nowrap">Gerar Despesas Fixas</span>
            </button>
          </div>
        </div>
      </header>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
        {[
          { label: 'Total Mês', val: totalCurr, sub: `${despesas.length} itens`, diff: diffTotal, Icon: PieChart, color: 'text-zinc-500', border: 'border-white/5' },
          { label: 'A Pagar', val: pendenteCurr, sub: `${pendentes.length} pendentes`, diff: diffPendente, Icon: Wallet, color: 'text-[#FF4D4D]', border: 'border-[#FF4D4D]/10' },
          { label: 'Liquidado', val: pagaCurr, sub: `${pagas.length} quitadas`, diff: diffPaga, Icon: CheckCircle2, color: 'text-[#a3ff12]', border: 'border-[#a3ff12]/10' },
          { label: 'Balanço', val: null, sub: null, diff: null, Icon: Layers, color: 'text-zinc-500', border: 'border-white/5' },
        ].map((item, i) => (
          <div key={i} className={`p-4 md:p-6 rounded-2xl md:rounded-3xl bg-[#15151A] border ${item.border} shadow-xl flex flex-col justify-between`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/5 flex items-center justify-center ${item.color}`}><item.Icon size={16} /></div>
              {item.diff !== null && (
                <div className={`flex items-center gap-1 text-[8px] md:text-[10px] font-black ${item.diff > 0 ? (i === 2 ? 'text-[#a3ff12]' : 'text-[#FF4D4D]') : (i === 2 ? 'text-zinc-500' : 'text-[#a3ff12]')}`}>
                  {item.diff > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />} {Math.abs(Math.round(item.diff))}%
                </div>
              )}
            </div>
            <div>
              <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1 ${item.color}`}>{item.label}</p>
              {item.val !== null ? (
                <>
                  <h2 className="text-base md:text-2xl font-black text-white leading-tight">R$ {item.val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                  <p className="text-zinc-600 text-[8px] md:text-[9px] font-bold mt-1 uppercase truncate">{item.sub}</p>
                </>
              ) : (
                <>
                  <h2 className="text-base md:text-2xl font-black text-white">{Math.round((pagaCurr / (totalCurr || 1)) * 100)}%</h2>
                  <div className="w-full h-1 md:h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-[#a3ff12]" style={{ width: `${(pagaCurr / (totalCurr || 1)) * 100}%` }} />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 md:gap-4 mb-8 p-1.5 bg-[#15151A]/40 rounded-2xl w-full md:w-fit border border-white/5 backdrop-blur-md overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('pendentes')} className={`flex-1 md:flex-none px-6 md:px-8 py-3 md:py-3.5 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all ${activeTab === 'pendentes' ? 'bg-[#FF4D4D] text-white shadow-xl scale-[1.02] md:scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}>PENDENTES</button>
        <button onClick={() => setActiveTab('pagas')} className={`flex-1 md:flex-none px-6 md:px-8 py-3 md:py-3.5 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all ${activeTab === 'pagas' ? 'bg-[#a3ff12] text-black shadow-xl scale-[1.02] md:scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}>PAGAS</button>
      </div>

      {/* FILTROS AVANÇADOS */}
      <div className="mb-6 bg-[#15151A] p-4 rounded-2xl border border-white/5 flex flex-col lg:flex-row gap-4 relative z-20">
        <div className="flex-1">
          <input 
            type="text" 
            placeholder="Buscar por descrição ou valor..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-[#a3ff12] transition-colors"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <select 
            value={filterCategoria} 
            onChange={(e) => setFilterCategoria(e.target.value)}
            className="w-full sm:w-auto bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-[#a3ff12] appearance-none cursor-pointer transition-colors"
          >
            <option value="">Todas as Categorias</option>
            {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input 
              type="number" 
              placeholder="Min (R$)" 
              value={filterValorMin}
              onChange={(e) => setFilterValorMin(e.target.value)}
              className="w-full sm:w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm text-white font-bold outline-none focus:border-[#a3ff12] transition-colors"
            />
            <span className="text-zinc-500 font-bold">-</span>
            <input 
              type="number" 
              placeholder="Max (R$)" 
              value={filterValorMax}
              onChange={(e) => setFilterValorMax(e.target.value)}
              className="w-full sm:w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm text-white font-bold outline-none focus:border-[#a3ff12] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#a3ff12]" size={32} /></div>
        ) : (activeTab === 'pendentes' ? pendentes : pagas).length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem] text-zinc-500 font-black uppercase tracking-widest text-xs">Tudo liquidado!</div>
        ) : (
          (activeTab === 'pendentes' ? pendentes : pagas).map((conta) => {
            const rel = getRelativeTime(conta.data_vencimento);
            const shouldShowParcela = conta.parcela_atual && conta.numero_parcelas > 1;

            return (
              <div key={conta.id} className={`p-5 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border transition-all duration-500 ${animatingIds.has(conta.id) ? 'opacity-0 translate-x-10 scale-95' : 'opacity-100'} ${conta.pago ? 'bg-white/[0.02] border-white/5' : 'bg-[#15151A] border-white/10 shadow-2xl hover:border-[#a3ff12]/30'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 md:gap-8">
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className={`w-11 h-11 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${conta.pago ? 'bg-[#a3ff12]/10 text-[#a3ff12]' : 'bg-[#FF4D4D]/10 text-[#FF4D4D]'}`}>
                      {conta.pago ? <Check className="w-4 h-4 md:w-5 md:h-5" /> : <DollarSign className="w-4 h-4 md:w-5 md:h-5" />}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-base md:text-2xl font-black text-white tracking-tight truncate">{conta.descricao}</h3>
                      <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
                        <div className="flex items-center gap-1 px-1.5 py-0.5 md:px-2.5 md:py-0.5 bg-white/5 rounded border border-white/5">
                          <Tag className="w-2.5 h-2.5" />
                          <span className="text-[7px] md:text-[9px] font-black text-zinc-400 uppercase tracking-widest">{conta.categoria || 'Outros'}</span>
                        </div>
                        {!conta.pago && <span className={`text-[8px] md:text-[9px] font-black uppercase ${rel.color}`}>{rel.text}</span>}
                        {shouldShowParcela && <span className="text-[8px] md:text-[9px] font-black text-[#FFD700] uppercase tracking-widest truncate">Parc. {conta.parcela_atual}/{conta.numero_parcelas}</span>}
                        {conta.observacoes && (
                          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 bg-white/[0.03] rounded border border-white/5 max-w-[200px]">
                            <Info size={10} className="text-zinc-500 shrink-0" />
                            <span className="text-[9px] font-medium text-zinc-500 truncate italic">"{conta.observacoes}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 md:gap-10 border-t border-white/5 sm:border-0 pt-4 sm:pt-0">
                    <div className="text-left sm:text-right">
                      {editingId === conta.id ? (
                        <div className="flex items-center justify-end gap-2 mb-2">
                          <input
                            type="text"
                            className="w-24 md:w-40 bg-white/5 border border-[#a3ff12]/30 text-white text-lg md:text-3xl font-black rounded-lg px-2 py-1 outline-none focus:border-[#a3ff12]"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateValor(conta.id)}
                            autoFocus
                          />
                          <button onClick={() => handleUpdateValor(conta.id)} className="p-2 bg-[#a3ff12] text-black rounded-lg hover:scale-110 active:scale-95 transition-all">
                            <Save size={16} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-2 bg-white/5 text-zinc-500 rounded-lg hover:text-white transition-all">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 justify-end group">
                          {!conta.pago && (
                            <button
                              onClick={() => { setEditingId(conta.id); setEditingValue(conta.valor.toString()); }}
                              className="p-2 text-zinc-600 hover:text-[#a3ff12] transition-all bg-white/5 rounded-lg"
                              title="Editar valor"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          <p className="text-xl md:text-4xl font-black text-white tracking-tighter leading-none">R$ {Number(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      )}
                      <p className="text-[7px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1">Venc. {formatDate(conta.data_vencimento)}</p>
                    </div>
                    <div className="shrink-0">
                      {conta.pago ? (
                        <button onClick={() => handleUndo(conta.id)} className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/5 text-zinc-500 hover:text-[#FFD700] transition-all flex items-center justify-center active:scale-90"><RotateCcw className="w-4.5 h-4.5 md:w-5 md:h-5" /></button>
                      ) : (
                        <button onClick={() => handlePagar(conta.id)} className="px-6 md:px-10 py-3 md:py-4 bg-white text-black font-black rounded-xl md:rounded-2xl text-[10px] md:text-xs hover:bg-[#a3ff12] active:scale-95 transition-all shadow-xl">PAGAR</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* Calendar Modal */}
      {isCalendarOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => setIsCalendarOpen(false)} />
          <div className="bg-[#15151A] border border-white/10 rounded-[2rem] md:rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-hidden relative z-10 shadow-2xl animate-in zoom-in duration-300 flex flex-col">

            <div className="p-6 md:p-10 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Calendário Mensal</h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{monthName} {currentDate.getFullYear()}</p>
              </div>
              <button onClick={() => setIsCalendarOpen(false)} className="w-12 h-12 rounded-xl bg-white/5 text-zinc-500 flex items-center justify-center hover:text-white transition-all"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10">
              <div className="grid grid-cols-7 gap-1 md:gap-3 mb-4">
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map(d => (
                  <div key={d} className="text-center text-[8px] md:text-[10px] font-black text-zinc-600 uppercase tracking-widest py-2">{d}</div>
                ))}
                {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                  const day = i + 1;
                  const dayDespesas = despesas.filter(d => {
                    const date = new Date(d.data_vencimento);
                    return date.getDate() === day && date.getMonth() === currentDate.getMonth();
                  });
                  const hasPendente = dayDespesas.some(d => !d.pago);
                  const hasPaga = dayDespesas.some(d => d.pago);
                  const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`aspect-square relative rounded-xl md:rounded-2xl border transition-all flex flex-col items-center justify-center group ${selectedDay === day ? 'bg-[#a3ff12] border-[#a3ff12] scale-105 shadow-[0_0_20px_rgba(163,255,18,0.3)]' : 'bg-black/20 border-white/5 hover:border-white/20'}`}
                    >
                      <span className={`text-xs md:text-lg font-black ${selectedDay === day ? 'text-black' : isToday ? 'text-[#a3ff12]' : 'text-white'}`}>{day}</span>
                      <div className="flex gap-1 mt-1">
                        {hasPendente && <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${selectedDay === day ? 'bg-black/40' : 'bg-[#FF4D4D]'}`} />}
                        {hasPaga && <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${selectedDay === day ? 'bg-black/40' : 'bg-[#a3ff12]'}`} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Day Details */}
              {selectedDay && (
                <div className="mt-8 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                      <div className="w-2 h-6 bg-[#a3ff12] rounded-full" /> Contas do dia {selectedDay}
                    </h3>
                    <button onClick={() => setSelectedDay(null)} className="text-[10px] font-black text-zinc-500 uppercase hover:text-white">Limpar</button>
                  </div>
                  <div className="space-y-3">
                    {despesas.filter(d => {
                      const date = new Date(d.data_vencimento);
                      return date.getDate() === selectedDay && date.getMonth() === currentDate.getMonth();
                    }).length === 0 ? (
                      <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest text-center py-8">Nenhum gasto neste dia</p>
                    ) : (
                      despesas.filter(d => {
                        const date = new Date(d.data_vencimento);
                        return date.getDate() === selectedDay && date.getMonth() === currentDate.getMonth();
                      }).map(conta => (
                        <div key={conta.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${conta.pago ? 'bg-[#a3ff12]/10 text-[#a3ff12]' : 'bg-[#FF4D4D]/10 text-[#FF4D4D]'}`}>
                              {conta.pago ? <Check size={20} /> : <DollarSign size={20} />}
                            </div>
                            <div>
                              <h4 className="font-black text-white text-sm">{conta.descricao}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{conta.categoria || 'Geral'}</p>
                                {conta.observacoes && <span className="text-[8px] font-medium text-zinc-600 italic truncate max-w-[150px]"> - "{conta.observacoes}"</span>}
                              </div>
                            </div>
                          </div>
                          <p className="text-lg font-black text-white">R$ {Number(conta.valor).toLocaleString('pt-BR')}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
