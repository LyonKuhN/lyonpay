import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Clock, PieChart, Loader2, Search, X, Calendar, ArrowRight, Tag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
};

export default function Dashboard() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [data, setData] = useState({
    receitas: [],
    despesas: [],
    saldo: 0,
    totalReceitas: 0,
    totalDespesas: 0
  });

  const fetchData = async () => {
    try {
      const [resRec, resDes] = await Promise.all([
        fetch(API_BASE_URL + '/api/receitas', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(API_BASE_URL + '/api/despesas', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const receitas = await resRec.json();
      const despesas = await resDes.json();
      const totalRec = receitas.reduce((acc: any, curr: any) => acc + Number(curr.valor), 0);
      const totalDes = despesas.filter((d: any) => d.pago).reduce((acc: any, curr: any) => acc + Number(curr.valor), 0);

      setData({
        receitas: receitas.slice(0, 4),
        despesas: despesas.slice(0, 3),
        totalReceitas: totalRec,
        totalDespesas: totalDes,
        saldo: totalRec - totalDes
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/search?q=${searchQuery}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
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

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-20 px-4 md:px-6">
      
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 mt-6 md:mt-10">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#a3ff12]/10 flex items-center justify-center border border-[#a3ff12]/20">
            <Sparkles className="w-5 h-5 text-[#a3ff12]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Olá, {user?.name}</h1>
            <p className="text-zinc-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest">Painel Lyonpay</p>
          </div>
        </div>

        <div className="relative flex-1 max-w-xl w-full">
          <div className="absolute inset-y-0 left-5 md:left-6 flex items-center pointer-events-none">
            <Search className="text-zinc-500 w-5 h-5" />
          </div>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisa Global..." 
            className="w-full bg-[#15151A] border border-white/5 rounded-2xl md:rounded-3xl py-4 md:py-5 pl-14 md:pl-16 pr-6 text-white text-sm md:text-base font-bold focus:outline-none focus:border-[#a3ff12]/50 focus:ring-4 focus:ring-[#a3ff12]/5 transition-all shadow-2xl"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-6 flex items-center text-zinc-500 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Global Search Results */}
      {searchQuery.length >= 2 && (
        <div className="animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-6 px-4">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <div className="w-2 h-6 bg-[#a3ff12] rounded-full" /> Resultados para "{searchQuery}"
            </h3>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{searchResults.length} encontrados</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isSearching ? (
              <div className="col-span-full py-12 flex justify-center"><Loader2 className="animate-spin text-[#a3ff12]" /></div>
            ) : searchResults.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-white/[0.01] rounded-[2.5rem] border-2 border-dashed border-white/5 text-zinc-500 uppercase text-xs font-black tracking-widest">Nada encontrado</div>
            ) : (
              searchResults.map((item, i) => (
                <div key={i} className="p-6 rounded-[2rem] bg-[#15151A] border border-white/5 hover:border-white/10 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${item.row_type === 'receita' ? 'bg-[#a3ff12]/10 text-[#a3ff12]' : 'bg-[#FF4D4D]/10 text-[#FF4D4D]'}`}>
                      {item.row_type}
                    </span>
                    <span className="text-[9px] font-black text-zinc-600 uppercase">
                      {new Date(item.data_recebimento || item.data_vencimento).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-xl font-black text-white mb-2 truncate group-hover:text-[#a3ff12] transition-colors">{item.descricao}</h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-500 uppercase">
                      <Tag size={10} /> {item.categoria || 'Outros'}
                    </div>
                    <p className={`text-xl font-black ${item.row_type === 'receita' ? 'text-[#a3ff12]' : 'text-white'}`}>
                      {item.row_type === 'receita' ? '+' : '-'} R$ {Number(item.valor).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="h-px bg-white/5 my-12" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <div className="p-8 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-gradient-to-br from-[#1C1C21] to-[#0D0D12] border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#a3ff12]/5 blur-3xl group-hover:bg-[#a3ff12]/10 transition-all" />
          <p className="text-zinc-500 font-black text-[9px] md:text-[10px] uppercase tracking-[0.3em] mb-3 md:mb-4">Saldo Disponível</p>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-4 md:mb-6 leading-none">R$ {data.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#a3ff12] animate-pulse" />
            <span className="text-[9px] md:text-[10px] font-black text-[#a3ff12] uppercase tracking-widest whitespace-nowrap">Atualizado Agora</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-1 md:col-span-2 gap-4 md:gap-6">
          <div className="p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] bg-[#15151A] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <p className="text-zinc-500 font-black text-[8px] md:text-[10px] uppercase tracking-widest mb-1 md:mb-2">Entradas</p>
              <p className="text-xl md:text-3xl font-black text-[#a3ff12] leading-tight">R$ {data.totalReceitas.toLocaleString('pt-BR')}</p>
            </div>
            <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-[#a3ff12]/5 flex items-center justify-center text-[#a3ff12]"><TrendingUp className="w-5 h-5 md:w-6 md:h-6"/></div>
          </div>
          <div className="p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] bg-[#15151A] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <p className="text-zinc-500 font-black text-[8px] md:text-[10px] uppercase tracking-widest mb-1 md:mb-2">Saídas</p>
              <p className="text-xl md:text-3xl font-black text-[#FF4D4D] leading-tight">R$ {data.totalDespesas.toLocaleString('pt-BR')}</p>
            </div>
            <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-[#FF4D4D]/5 flex items-center justify-center text-[#FF4D4D]"><TrendingDown className="w-5 h-5"/></div>
          </div>
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-2xl font-black text-white flex items-center gap-3"><Clock size={24} className="text-[#FFD700]" /> Próximos Vencimentos</h3>
            <ArrowRight size={20} className="text-zinc-700" />
          </div>
          <div className="space-y-3 md:space-y-4">
            {data.despesas.map((item: any, i) => (
              <div key={i} className="p-5 md:p-6 rounded-2xl md:rounded-[2.5rem] bg-[#15151A]/60 border border-white/5 hover:border-white/20 transition-all flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 md:gap-5 min-w-0">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${item.pago ? 'bg-[#a3ff12]/10 text-[#a3ff12]' : 'bg-[#FF4D4D]/10 text-[#FF4D4D]'}`}>
                    <Calendar className="w-5 h-5 md:w-5 md:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-white text-sm md:text-lg truncate">{item.descricao}</h4>
                    <p className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate">{formatDate(item.data_vencimento)}</p>
                  </div>
                </div>
                <p className="text-base md:text-xl font-black text-white shrink-0">R$ {Number(item.valor).toLocaleString('pt-BR')}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-2xl font-black text-white flex items-center gap-3"><PieChart size={24} className="text-[#00D1FF]" /> Movimentações Recentes</h3>
            <ArrowRight size={20} className="text-zinc-700" />
          </div>
          <div className="space-y-3 md:space-y-4">
            {[...data.receitas, ...data.despesas].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4).map((item: any, i) => (
              <div key={i} className="p-5 md:p-6 rounded-2xl md:rounded-[2.5rem] bg-[#15151A]/60 border border-white/5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 md:gap-5 min-w-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/5 flex items-center justify-center text-base md:text-xl shrink-0">
                    {item.data_recebimento ? '💰' : '💸'}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-white text-sm md:text-lg truncate">{item.descricao}</h4>
                    <p className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate">{item.categoria || 'Geral'}</p>
                  </div>
                </div>
                <p className={`text-base md:text-xl font-black shrink-0 ${item.data_recebimento ? 'text-[#a3ff12]' : 'text-white'}`}>
                  {item.data_recebimento ? '+' : '-'} R$ {Number(item.valor).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
