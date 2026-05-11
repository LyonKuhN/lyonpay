import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, TrendingDown, Clock, Loader2, Search, X, Calendar, ArrowRight, Tag, AlertCircle, CheckCircle2, BarChart3, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
};

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [atrasadas, setAtrasadas] = useState<any[]>([]);
  const [data, setData] = useState({
    receitas: [] as any[],
    despesas: [] as any[],
    saldo: 0,
    totalReceitas: 0,
    totalDespesas: 0,
    totalPendente: 0,
    categorias: [] as any[],
  });
  const [lembretes, setLembretes] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const [resRec, resDes, resAtrasadas, resRem] = await Promise.all([
        fetch(API_BASE_URL + '/api/receitas', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/despesas?month=${month}&year=${year}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(API_BASE_URL + '/api/despesas/atrasadas', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(API_BASE_URL + '/api/lembretes', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      const receitas = await resRec.json();
      const despesas = await resDes.json();
      const atrasadasData = await resAtrasadas.json();
      const reminders = await resRem.json();

      const totalRec = Array.isArray(receitas) ? receitas.reduce((acc: number, curr: any) => acc + Number(curr.valor), 0) : 0;
      const totalDes = Array.isArray(despesas) ? despesas.filter((d: any) => d.pago).reduce((acc: number, curr: any) => acc + Number(curr.valor), 0) : 0;
      const totalPend = Array.isArray(despesas) ? despesas.filter((d: any) => !d.pago).reduce((acc: number, curr: any) => acc + Number(curr.valor), 0) : 0;

      // Top categorias de despesas
      const catMap: Record<string, number> = {};
      if (Array.isArray(despesas)) {
        despesas.filter((d: any) => d.pago).forEach((d: any) => {
          const cat = d.categoria || 'Outros';
          catMap[cat] = (catMap[cat] || 0) + Number(d.valor);
        });
      }
      const categorias = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

      setAtrasadas(Array.isArray(atrasadasData) ? atrasadasData : []);
      setLembretes(Array.isArray(reminders) ? reminders.filter(r => !r.concluido).slice(0, 3) : []);
      setData({
        receitas: Array.isArray(receitas) ? receitas.slice(0, 5) : [],
        despesas: Array.isArray(despesas) ? despesas.filter((d: any) => !d.pago).sort((a: any, b: any) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()).slice(0, 5) : [],
        totalReceitas: totalRec,
        totalDespesas: totalDes,
        totalPendente: totalPend,
        saldo: totalRec - totalDes,
        categorias,
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 2) { setSearchResults([]); setIsSearching(false); return; }
      setIsSearching(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/search?q=${searchQuery}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const results = await response.json();
        setSearchResults(results);
      } catch (err) { console.error(err); }
      finally { setIsSearching(false); }
    };
    const timer = setTimeout(search, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-[#a3ff12]" size={40} />
      </div>
    );
  }

  const savingsRate = data.totalReceitas > 0 ? Math.max(0, ((data.totalReceitas - data.totalDespesas) / data.totalReceitas) * 100) : 0;
  const spendingRate = data.totalReceitas > 0 ? Math.min(100, (data.totalDespesas / data.totalReceitas) * 100) : 0;
  const healthScore = Math.min(100, Math.round(savingsRate * 0.6 + (atrasadas.length === 0 ? 40 : Math.max(0, 40 - atrasadas.length * 10))));
  const healthColor = healthScore >= 70 ? '#a3ff12' : healthScore >= 40 ? '#FFD700' : '#FF4D4D';
  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-24 px-4 md:px-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6 md:mt-10">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#a3ff12]/10 flex items-center justify-center border border-[#a3ff12]/20">
            <Sparkles className="w-5 h-5 text-[#a3ff12]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Olá, {user?.name?.split(' ')[0]} 👋</h1>
            <p className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest capitalize">{monthName}</p>
          </div>
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
            <p className="text-white font-black text-sm">⚠️ {atrasadas.length} {atrasadas.length === 1 ? 'conta atrasada' : 'contas atrasadas'}</p>
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
            {healthScore >= 70 ? '✓ Excelente' : healthScore >= 40 ? '⚠ Atenção' : '✗ Crítico'}
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
          { label: 'Despesas pagas', value: `${data.despesas.filter((d: any) => d.pago).length} ✓`, icon: <CheckCircle2 className="w-4 h-4 text-[#a3ff12]" /> },
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
