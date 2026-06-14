import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, TrendingDown, Clock, Loader2, Search, X, Calendar, ArrowRight, Tag, AlertCircle, CheckCircle2, BarChart3, Zap, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '../components/ui/Skeleton';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
};

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const month = selectedMonth;
  const year = selectedYear;

  const { data: receitasRaw = [], isLoading: loadRec } = useQuery({ queryKey: ['receitas'], queryFn: () => apiFetch('/api/receitas'), enabled: !!token });
  const { data: despesasRaw = [], isLoading: loadDes } = useQuery({ queryKey: ['despesas', year, month], queryFn: () => apiFetch(`/api/despesas?month=${month}&year=${year}`), enabled: !!token });
  const { data: atrasadasRaw = [], isLoading: loadAtr } = useQuery({ queryKey: ['despesas', 'atrasadas'], queryFn: () => apiFetch('/api/despesas/atrasadas'), enabled: !!token });
  const { data: lembretesRaw = [], isLoading: loadLem } = useQuery({ queryKey: ['lembretes'], queryFn: () => apiFetch('/api/lembretes'), enabled: !!token });
  const { data: evolucao = { receitas: [], despesas: [] }, isLoading: loadEvo } = useQuery({ queryKey: ['dashboard', 'evolucao', year], queryFn: () => apiFetch(`/api/dashboard/evolucao?year=${year}`), enabled: !!token });
  const { data: saldoData = { saldoGlobal: 0 }, isLoading: loadSaldo } = useQuery({ queryKey: ['dashboard', 'saldo'], queryFn: () => apiFetch('/api/dashboard/saldo'), enabled: !!token });

  const loading = loadRec || loadDes || loadAtr || loadLem || loadEvo || loadSaldo;

  const atrasadas = Array.isArray(atrasadasRaw) ? atrasadasRaw : [];
  const lembretes = Array.isArray(lembretesRaw) ? lembretesRaw.filter(r => !r.concluido).slice(0, 3) : [];

  const data = (() => {
    const receitas = Array.isArray(receitasRaw) ? receitasRaw : [];
    const despesas = Array.isArray(despesasRaw) ? despesasRaw : [];

    const receitasFiltradas = receitas.filter((r: any) => {
      const d = r.data_recebimento ? new Date(r.data_recebimento) : new Date();
      if (month === 0) return d.getFullYear() === year;
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    const totalRec = receitasFiltradas.reduce((acc: number, curr: any) => acc + Number(curr.valor), 0);
    const totalDes = despesas.filter((d: any) => d.pago).reduce((acc: number, curr: any) => acc + Number(curr.valor), 0);
    const totalPend = despesas.filter((d: any) => !d.pago).reduce((acc: number, curr: any) => acc + Number(curr.valor), 0);

    const catMap: Record<string, number> = {};
    despesas.filter((d: any) => d.pago).forEach((d: any) => {
      const cat = d.categoria || 'Outros';
      catMap[cat] = (catMap[cat] || 0) + Number(d.valor);
    });
    const categorias = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

    const chartMap: Record<string, any> = {};
    if (month === 0) {
      for (let i = 1; i <= 12; i++) {
        const mStr = i.toString().padStart(2, '0');
        chartMap[mStr] = { name: mStr, Entradas: 0, Saidas: 0 };
      }
    } else {
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const dayStr = i.toString().padStart(2, '0');
        chartMap[dayStr] = { name: dayStr, Entradas: 0, Saidas: 0 };
      }
    }

    receitasFiltradas.forEach((r: any) => {
      const d = r.data_recebimento ? new Date(r.data_recebimento) : new Date();
      if (month === 0) {
        const mStr = (d.getMonth() + 1).toString().padStart(2, '0');
        if (chartMap[mStr]) chartMap[mStr].Entradas += Number(r.valor);
      } else {
        const dayStr = d.getDate().toString().padStart(2, '0');
        if (chartMap[dayStr]) chartMap[dayStr].Entradas += Number(r.valor);
      }
    });

    despesas.filter((d:any) => d.pago).forEach((d: any) => {
      const dt = d.data_vencimento ? new Date(d.data_vencimento) : new Date();
      if (month === 0) {
        const mStr = (dt.getMonth() + 1).toString().padStart(2, '0');
        if (chartMap[mStr]) chartMap[mStr].Saidas += Number(d.valor);
      } else {
        const dayStr = dt.getDate().toString().padStart(2, '0');
        if (chartMap[dayStr]) chartMap[dayStr].Saidas += Number(d.valor);
      }
    });

    return {
      receitas: receitasFiltradas.sort((a: any, b: any) => new Date(b.data_recebimento).getTime() - new Date(a.data_recebimento).getTime()).slice(0, 5),
      despesas: despesas.filter((d: any) => !d.pago).sort((a: any, b: any) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()).slice(0, 5),
      totalReceitas: totalRec,
      totalDespesas: totalDes,
      totalPendente: totalPend,
      saldo: saldoData.saldoGlobal,
      categorias,
      chartData: Object.values(chartMap),
      pieData: categorias.map(([name, value]) => ({ name, value }))
    };
  })();

  const evolucaoData = (() => {
    const map = new Map<string, { name: string, Receitas: number, Despesas: number }>();
    const rec = evolucao.receitas || [];
    const des = evolucao.despesas || [];
    
    rec.forEach((r: any) => {
      const label = `${String(r.mes).padStart(2, '0')}/${r.ano}`;
      if (!map.has(label)) map.set(label, { name: label, Receitas: 0, Despesas: 0 });
      map.get(label)!.Receitas += Number(r.total);
    });
    
    des.forEach((d: any) => {
      const label = `${String(d.mes).padStart(2, '0')}/${d.ano}`;
      if (!map.has(label)) map.set(label, { name: label, Receitas: 0, Despesas: 0 });
      map.get(label)!.Despesas += Number(d.total);
    });

    return Array.from(map.values()).sort((a, b) => {
      const [m1, a1] = a.name.split('/');
      const [m2, a2] = b.name.split('/');
      return new Date(Number(a1), Number(m1) - 1).getTime() - new Date(Number(a2), Number(m2) - 1).getTime();
    });
  })();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 2) { setSearchResults([]); setIsSearching(false); return; }
      setIsSearching(true);
      try {
        const results = await apiFetch(`/api/search?q=${searchQuery}`);
        setSearchResults(results);
      } catch (err) { console.error(err); }
      finally { setIsSearching(false); }
    };
    const timer = setTimeout(search, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 pb-24 px-4 md:px-6 mt-6 md:mt-10">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="col-span-2 h-40 rounded-[2rem]" />
          <Skeleton className="h-40 rounded-[1.5rem]" />
          <Skeleton className="h-40 rounded-[1.5rem]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const savingsRate = data.totalReceitas > 0 ? Math.max(0, ((data.totalReceitas - data.totalDespesas) / data.totalReceitas) * 100) : 0;
  const spendingRate = data.totalReceitas > 0 ? Math.min(100, (data.totalDespesas / data.totalReceitas) * 100) : 0;
  const healthScore = Math.min(100, Math.round(savingsRate * 0.6 + (atrasadas.length === 0 ? 40 : Math.max(0, 40 - atrasadas.length * 10))));
  const healthColor = healthScore >= 70 ? '#a3ff12' : healthScore >= 40 ? '#FFD700' : '#FF4D4D';
  const monthName = month === 0 ? 'Ano Todo' : new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-24 px-4 md:px-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6 md:mt-10">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#a3ff12]/10 flex items-center justify-center border border-[#a3ff12]/20">
            <Sparkles className="w-5 h-5 text-[#a3ff12]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Olá, {user?.name?.split(' ')[0]}!</h1>
            <p className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest capitalize">{monthName}</p>
          </div>
        </div>
        
        {/* Filtros em linha */}
        <div className="relative z-50">
          <button 
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className="flex items-center gap-2 bg-[#15151A] border border-white/5 hover:border-[#a3ff12]/50 px-4 py-2.5 rounded-2xl transition-all shadow-lg"
          >
            <Calendar size={16} className="text-[#a3ff12]" />
            <span className="text-white font-black text-xs uppercase tracking-widest">
              {month === 0 ? `Ano Todo de ${year}` : `${monthName.split(' ')[0]} ${year}`}
            </span>
            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`} />
          </button>

          {isCalendarOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsCalendarOpen(false)} />
              <div className="absolute top-full md:right-0 left-0 md:left-auto mt-3 w-72 bg-[#15151A] border border-white/10 rounded-3xl shadow-2xl p-5 z-50 animate-in slide-in-from-top-2 fade-in duration-200">
                
                {/* Year Header */}
                <div className="flex items-center justify-between mb-6 bg-white/5 rounded-2xl p-2 border border-white/5">
                  <button onClick={() => setSelectedYear(y => y - 1)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all"><ChevronLeft size={16}/></button>
                  <span className="font-black text-white text-sm">{year}</span>
                  <button onClick={() => setSelectedYear(y => y + 1)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all"><ChevronRight size={16}/></button>
                </div>

                {/* Ano Todo Button */}
                <button 
                  onClick={() => { setSelectedMonth(0); setIsCalendarOpen(false); }}
                  className={`w-full mb-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${month === 0 ? 'bg-[#a3ff12] text-black shadow-[0_0_20px_rgba(163,255,18,0.2)]' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'}`}
                >
                  Visão do Ano Todo
                </button>

                {/* Months Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <button 
                      key={m}
                      onClick={() => { setSelectedMonth(m); setIsCalendarOpen(false); }}
                      className={`py-2 rounded-xl font-bold text-xs transition-all ${month === m ? 'bg-[#a3ff12] text-black shadow-[0_0_15px_rgba(163,255,18,0.2)]' : 'bg-transparent text-zinc-500 hover:text-white hover:bg-white/5'}`}
                    >
                      {new Date(2000, m - 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()}
                    </button>
                  ))}
                </div>

              </div>
            </>
          )}
        </div>

        <div className="relative flex-1 max-w-md w-full">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="text-zinc-500 w-4 h-4" />
          </div>
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar lançamentos..."
            className="w-full bg-[#15151A] border border-white/5 rounded-2xl py-3.5 pl-12 pr-6 text-white text-sm font-bold focus:outline-none focus:border-[#a3ff12]/50 transition-all"
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-4 flex items-center text-zinc-500 hover:text-white"><X size={16} /></button>}
        </div>
      </div>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div className="animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isSearching ? <div className="col-span-full py-10 flex justify-center"><Loader2 className="animate-spin text-[#a3ff12]" /></div>
              : searchResults.length === 0 ? <div className="col-span-full py-10 text-center text-zinc-500 font-black uppercase text-xs tracking-widest">Nada encontrado</div>
                : searchResults.map((item, i) => (
                  <div key={i} className="p-5 rounded-2xl bg-[#15151A] border border-white/5 hover:border-white/15 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${item.row_type === 'receita' ? 'bg-[#a3ff12]/10 text-[#a3ff12]' : 'bg-[#FF4D4D]/10 text-[#FF4D4D]'}`}>{item.row_type}</span>
                      <span className="text-[9px] font-black text-zinc-600">{formatDate(item.data_recebimento || item.data_vencimento)}</span>
                    </div>
                    <h4 className="text-base font-black text-white truncate mb-1">{item.descricao}</h4>
                    <p className={`text-lg font-black ${item.row_type === 'receita' ? 'text-[#a3ff12]' : 'text-white'}`}>{item.row_type === 'receita' ? '+' : '-'} R$ {Number(item.valor).toLocaleString('pt-BR')}</p>
                  </div>
                ))}
          </div>
          <div className="h-px bg-white/5 my-8" />
        </div>
      )}

      {/* Alerta de Atrasados */}
      {atrasadas.length > 0 && (
        <div className="p-5 bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
          <AlertCircle className="text-[#FF4D4D] shrink-0 w-5 h-5" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm">{atrasadas.length} {atrasadas.length === 1 ? 'conta atrasada' : 'contas atrasadas'}</p>
            <p className="text-zinc-400 text-xs">Total: R$ {atrasadas.reduce((a: number, c: any) => a + Number(c.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <button onClick={() => navigate('/pagamentos')} className="shrink-0 px-4 py-2 bg-[#FF4D4D] text-white font-black text-xs rounded-xl hover:bg-[#FF4D4D]/90 transition-all">Ver agora</button>
        </div>
      )}

      {/* Lembretes Rápidos */}
      {lembretes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-300">
          {lembretes.map((rem, i) => (
            <div key={i} onClick={() => navigate('/calendario')} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-all">
              <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 flex items-center justify-center text-[#FFD700]">
                <Clock size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-xs truncate">{rem.titulo}</p>
                <p className="text-zinc-500 text-[10px] font-bold uppercase">{new Date(rem.data_lembrete).toLocaleDateString('pt-BR')} {new Date(rem.data_lembrete).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-2 p-6 md:p-8 rounded-[2rem] bg-gradient-to-br from-[#1C1C21] to-[#0D0D12] border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#a3ff12]/5 blur-3xl group-hover:bg-[#a3ff12]/10 transition-all" />
          <p className="text-zinc-500 font-black text-[9px] uppercase tracking-[0.3em] mb-2">Saldo Disponível</p>
          <h2 className={`text-3xl md:text-4xl font-black tracking-tighter mb-3 leading-none ${data.saldo >= 0 ? 'text-white' : 'text-[#FF4D4D]'}`}>
            R$ {data.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#a3ff12] animate-pulse" />
            <span className="text-[9px] font-black text-[#a3ff12] uppercase tracking-widest">Atualizado agora</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[9px] font-black text-zinc-500 uppercase mb-1.5">
              <span>Gasto do mês</span>
              <span>{spendingRate.toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${spendingRate}%`, backgroundColor: spendingRate > 80 ? '#FF4D4D' : spendingRate > 60 ? '#FFD700' : '#a3ff12' }} />
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6 rounded-[1.5rem] bg-[#15151A] border border-white/5 flex flex-col justify-between">
          <div className="w-9 h-9 rounded-xl bg-[#a3ff12]/10 flex items-center justify-center text-[#a3ff12] mb-3"><TrendingUp className="w-4 h-4" /></div>
          <div>
            <p className="text-zinc-500 font-black text-[9px] uppercase tracking-widest mb-1">Entradas</p>
            <p className="text-xl md:text-2xl font-black text-[#a3ff12] leading-tight">R$ {data.totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="p-5 md:p-6 rounded-[1.5rem] bg-[#15151A] border border-white/5 flex flex-col justify-between">
          <div className="w-9 h-9 rounded-xl bg-[#FF4D4D]/10 flex items-center justify-center text-[#FF4D4D] mb-3"><TrendingDown className="w-4 h-4" /></div>
          <div>
            <p className="text-zinc-500 font-black text-[9px] uppercase tracking-widest mb-1">Saídas Pagas</p>
            <p className="text-xl md:text-2xl font-black text-[#FF4D4D] leading-tight">R$ {data.totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Gráficos Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Evolução ao Longo dos Meses */}
        <div className="col-span-1 lg:col-span-3 p-6 rounded-[2rem] bg-[#15151A] border border-white/5 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-black text-white">Evolução ao Longo dos Meses</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Ano de {year}</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-[#a3ff12]" /><span className="text-[10px] font-bold text-zinc-400 uppercase">Receitas</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-[#FF4D4D]" /><span className="text-[10px] font-bold text-zinc-400 uppercase">Despesas</span></div>
            </div>
          </div>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value >= 1000 ? (value/1000).toFixed(1)+'k' : value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#15151A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#fff' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="Receitas" stroke="#a3ff12" strokeWidth={3} dot={{ r: 4, fill: '#15151A', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Despesas" stroke="#FF4D4D" strokeWidth={3} dot={{ r: 4, fill: '#15151A', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2 p-6 rounded-[2rem] bg-[#15151A] border border-white/5 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-black text-white">Fluxo de Caixa</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{month === 0 ? `Evolução Mensal (${year})` : `Evolução Diária (${monthName})`}</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#a3ff12]" /><span className="text-[10px] font-bold text-zinc-400 uppercase">Entradas</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#FF4D4D]" /><span className="text-[10px] font-bold text-zinc-400 uppercase">Saídas</span></div>
            </div>
          </div>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a3ff12" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a3ff12" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4D4D" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF4D4D" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value >= 1000 ? (value/1000).toFixed(1)+'k' : value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#15151A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#fff' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="Entradas" stroke="#a3ff12" strokeWidth={3} fillOpacity={1} fill="url(#colorEntradas)" />
                <Area type="monotone" dataKey="Saidas" stroke="#FF4D4D" strokeWidth={3} fillOpacity={1} fill="url(#colorSaidas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-1 p-6 rounded-[2rem] bg-[#15151A] border border-white/5 shadow-2xl flex flex-col">
          <div className="mb-4">
            <h3 className="text-xl font-black text-white">Despesas por Categoria</h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Distribuição do Mês</p>
          </div>
          <div className="flex-1 w-full min-h-[200px] flex items-center justify-center relative">
            {data.pieData.length === 0 ? (
              <p className="text-zinc-600 text-xs font-bold uppercase">Sem despesas pagas</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.pieData.map((_, index) => {
                      const colors = ['#a3ff12', '#635BFF', '#FFD700', '#FF4D4D', '#06B6D4'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#15151A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#fff' }}
                    itemStyle={{ fontWeight: 'bold' }}
                    formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {data.pieData.length > 0 && (
               <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                 <span className="text-[10px] font-black text-zinc-500 uppercase">Total</span>
                 <span className="text-lg font-black text-white">R${data.totalDespesas >= 1000 ? (data.totalDespesas/1000).toFixed(1)+'k' : data.totalDespesas}</span>
               </div>
            )}
          </div>
          {data.pieData.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {data.pieData.slice(0,4).map((entry, index) => {
                const colors = ['#a3ff12', '#635BFF', '#FFD700', '#FF4D4D'];
                return (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[index] }} />
                    <span className="text-[10px] font-bold text-zinc-400 truncate">{entry.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Secondary Info Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Saúde Financeira */}
        <div className="p-6 rounded-2xl bg-[#15151A] border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-500 font-black text-[9px] uppercase tracking-widest">Saúde Financeira</p>
            <BarChart3 className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-5xl font-black" style={{ color: healthColor }}>{healthScore}</span>
            <span className="text-zinc-500 font-black text-sm mb-1">/100</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${healthScore}%`, backgroundColor: healthColor }} />
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: healthColor }}>
            {healthScore >= 70 ? 'Excelente' : healthScore >= 40 ? 'Atenção' : 'Crítico'}
          </p>
        </div>

        {/* A pagar este mês */}
        <div className="p-6 rounded-2xl bg-[#15151A] border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-500 font-black text-[9px] uppercase tracking-widest">Pendente Este Mês</p>
            <Clock className="w-4 h-4 text-[#FFD700]" />
          </div>
          <p className="text-3xl font-black text-white mb-1">R$ {data.totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{data.despesas.length} contas em aberto</p>
          <div className="mt-4 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#a3ff12]" />
            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Taxa de poupança: {savingsRate.toFixed(0)}%</span>
          </div>
        </div>

        {/* Top Categorias */}
        <div className="p-6 rounded-2xl bg-[#15151A] border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-500 font-black text-[9px] uppercase tracking-widest">Top Categorias</p>
            <Tag className="w-4 h-4 text-zinc-600" />
          </div>
          {data.categorias.length === 0 ? (
            <p className="text-zinc-600 text-xs font-bold">Sem dados ainda</p>
          ) : (
            <div className="space-y-2.5">
              {data.categorias.map(([cat, val], i) => (
                <div key={i}>
                  <div className="flex justify-between text-[10px] font-black mb-1">
                    <span className="text-zinc-400 truncate">{cat}</span>
                    <span className="text-white ml-2 shrink-0">R$ {Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#a3ff12]" style={{ width: `${Math.min(100, (Number(val) / (data.categorias[0]?.[1] || 1)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Two Column: Next Bills + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Próximos vencimentos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Clock size={18} className="text-[#FFD700]" /> Próximos Vencimentos
            </h3>
            <button onClick={() => navigate('/pagamentos')} className="flex items-center gap-1 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">Ver todos <ArrowRight size={14} /></button>
          </div>
          {data.despesas.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl text-zinc-600 font-black text-xs uppercase tracking-widest">
              <Zap className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
              Sem vencimentos pendentes!
            </div>
          ) : (
            <div className="space-y-3">
              {data.despesas.map((item: any, i) => {
                const today = new Date(); today.setHours(0,0,0,0);
                const due = new Date(item.data_vencimento); due.setHours(0,0,0,0);
                const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);
                const isOverdue = diffDays < 0;
                const isToday = diffDays === 0;
                return (
                  <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${isOverdue ? 'bg-[#FF4D4D]/5 border-[#FF4D4D]/20' : isToday ? 'bg-[#FFD700]/5 border-[#FFD700]/20' : 'bg-[#15151A] border-white/5 hover:border-white/15'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOverdue ? 'bg-[#FF4D4D]/10 text-[#FF4D4D]' : isToday ? 'bg-[#FFD700]/10 text-[#FFD700]' : 'bg-white/5 text-zinc-500'}`}>
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-white text-sm truncate">{item.descricao}</h4>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${isOverdue ? 'text-[#FF4D4D]' : isToday ? 'text-[#FFD700]' : 'text-zinc-500'}`}>
                          {isOverdue ? `Atrasado ${Math.abs(diffDays)}d` : isToday ? 'Vence HOJE' : `${diffDays}d restantes`} · {formatDate(item.data_vencimento)}
                        </p>
                      </div>
                    </div>
                    <p className="text-base font-black text-white shrink-0">R$ {Number(item.valor).toLocaleString('pt-BR')}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Receitas recentes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <TrendingUp size={18} className="text-[#a3ff12]" /> Últimas Entradas
            </h3>
            <button onClick={() => navigate('/receitas')} className="flex items-center gap-1 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">Ver todas <ArrowRight size={14} /></button>
          </div>
          {data.receitas.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl text-zinc-600 font-black text-xs uppercase tracking-widest">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
              Nenhuma entrada registrada
            </div>
          ) : (
            <div className="space-y-3">
              {data.receitas.map((item: any, i) => (
                <div key={i} className="p-4 rounded-2xl bg-[#15151A] border border-white/5 hover:border-[#a3ff12]/20 transition-all flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#a3ff12]/10 text-[#a3ff12] flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-white text-sm truncate">{item.descricao}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Tag size={8} className="text-zinc-600" />
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest truncate">{item.categoria || 'Outros'}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-base font-black text-[#a3ff12] shrink-0">+R$ {Number(item.valor).toLocaleString('pt-BR')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
        {[
          { label: 'Receitas este mês', value: data.receitas.length, icon: <TrendingUp className="w-4 h-4 text-[#a3ff12]" /> },
          { label: 'Despesas pagas', value: data.despesas.filter((d: any) => d.pago).length, icon: <CheckCircle2 className="w-4 h-4 text-[#a3ff12]" /> },
          { label: 'Pendentes', value: data.despesas.length, icon: <Clock className="w-4 h-4 text-[#FFD700]" /> },
          { label: 'Atrasadas', value: atrasadas.length, icon: <AlertCircle className="w-4 h-4 text-[#FF4D4D]" /> },
        ].map((s, i) => (
          <div key={i} className="p-4 rounded-2xl bg-[#15151A]/60 border border-white/5 flex items-center gap-3">
            {s.icon}
            <div>
              <p className="text-white font-black text-lg leading-none">{s.value}</p>
              <p className="text-zinc-600 text-[8px] font-black uppercase tracking-widest mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
