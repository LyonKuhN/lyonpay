import { useState, useEffect } from 'react';
import { Plus, Calendar, DollarSign, Tag, Loader2, Sparkles, TrendingUp, Receipt } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

export default function Receitas() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [receitas, setReceitas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    data_recebimento: new Date().toISOString().split('T')[0],
    categoria: 'Salário'
  });

  const [newCat, setNewCat] = useState({ nome: '', cor: '#a3ff12' });

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRec, resCat] = await Promise.all([
        fetch(API_BASE_URL + '/api/receitas', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(API_BASE_URL + '/api/categorias', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const dataRec = await resRec.json();
      const dataCat = await resCat.json();
      setReceitas(dataRec);
      setCategorias(dataCat.filter((c: any) => c.tipo === 'receita'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchData(); }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(API_BASE_URL + '/api/receitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchData();
        setFormData({ ...formData, descricao: '', valor: '' });
      }
    } catch (err) { console.error(err); }
  };

  const handleAddCategory = async () => {
    if (!newCat.nome) return;
    try {
      const response = await fetch(API_BASE_URL + '/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...newCat, tipo: 'receita', icone: 'TrendingUp' })
      });
      if (response.ok) {
        setIsCatModalOpen(false);
        setNewCat({ nome: '', cor: '#a3ff12' });
        fetchData();
      }
    } catch (err) { console.error(err); }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Cálculos para CARDS
  const totalRecebido = receitas.reduce((a, c) => a + Number(c.valor), 0);
  const mediaReceita = receitas.length > 0 ? totalRecebido / receitas.length : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-6xl mx-auto pt-4 pb-20 px-4 md:px-6">
      
      <header className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
        <div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-2 md:mb-3">Receitas</h1>
          <p className="text-zinc-500 font-bold uppercase text-[8px] md:text-[10px] tracking-[0.3em] md:tracking-[0.4em]">Gestão de Entradas e Ganhos</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto flex items-center justify-center gap-3 px-8 md:px-10 py-4 md:py-5 bg-[#a3ff12] text-black font-black rounded-2xl md:rounded-[1.5rem] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl"
        >
          <Plus className="w-5 h-5 md:w-6 md:h-6" strokeWidth={3} /> NOVA ENTRADA
        </button>
      </header>

      {/* CARDS DE RESUMO (RESTAURADOS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
        <div className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-[#15151A] border border-[#a3ff12]/10 shadow-xl flex flex-col justify-between">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-[#a3ff12]/10 flex items-center justify-center text-[#a3ff12] mb-3"><TrendingUp className="w-4 h-4" /></div>
          <div>
            <p className="text-[#a3ff12] text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1">Total Recebido</p>
            <h2 className="text-lg md:text-2xl font-black text-white leading-tight">R$ {totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
          </div>
        </div>

        <div className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-[#15151A] border border-white/5 shadow-xl flex flex-col justify-between">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 mb-3"><Receipt className="w-4 h-4" /></div>
          <div>
            <p className="text-zinc-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1">Qtd Entradas</p>
            <h2 className="text-lg md:text-2xl font-black text-white leading-tight">{receitas.length}</h2>
          </div>
        </div>

        <div className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-[#15151A] border border-white/5 shadow-xl flex flex-col justify-between">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 mb-3"><DollarSign className="w-4 h-4" /></div>
          <div>
            <p className="text-zinc-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1">Média p/ Lançamento</p>
            <h2 className="text-lg md:text-2xl font-black text-white leading-tight">R$ {mediaReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
          </div>
        </div>

        <div className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-gradient-to-br from-[#a3ff12]/10 to-transparent border border-[#a3ff12]/20 shadow-xl flex flex-col justify-between">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-[#a3ff12] flex items-center justify-center text-black shadow-lg mb-3"><Sparkles className="w-4 h-4" /></div>
          <div>
            <p className="text-[#a3ff12] text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1">Previsão</p>
            <h2 className="text-lg md:text-2xl font-black text-white leading-tight">+R$ {(totalRecebido * 1.1).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h2>
          </div>
        </div>
      </div>

      {/* Agrupamento por Ano e Mês */}
      <div className="space-y-6">
        {loading ? (
          <div className="py-40 flex justify-center"><Loader2 className="animate-spin text-[#a3ff12]" size={48} /></div>
        ) : receitas.length === 0 ? (
          <div className="py-40 text-center bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[4rem]">
            <p className="text-zinc-500 font-black uppercase tracking-[0.4em]">Nenhuma receita</p>
          </div>
        ) : (() => {
          const byYearMonth: Record<string, Record<string, any[]>> = {};
          receitas.forEach(exp => {
            let year = "Sem Data";
            let month = "00";
            if (exp.data_recebimento) {
              const d = new Date(exp.data_recebimento);
              year = d.getFullYear().toString();
              month = (d.getMonth() + 1).toString().padStart(2, '0');
            }
            if (!byYearMonth[year]) byYearMonth[year] = {};
            if (!byYearMonth[year][month]) byYearMonth[year][month] = [];
            byYearMonth[year][month].push(exp);
          });

          return Object.keys(byYearMonth).sort((a,b) => b.localeCompare(a)).map(year => (
            <div key={`year-${year}`} className="bg-[#15151A] rounded-[2rem] border border-white/5 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 relative">
              
              {/* Year Header */}
              <button onClick={() => toggleGroup(`year-${year}`)} className="w-full p-6 md:p-8 flex items-center justify-between hover:bg-white/5 transition-colors group relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-8 bg-[#a3ff12] rounded-full shadow-[0_0_15px_rgba(163,255,18,0.4)]" />
                  <span className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase">Ano <span className="text-[#a3ff12]">{year}</span></span>
                </div>
                <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center transition-transform duration-500 group-hover:bg-white/10 ${expandedGroups.has(`year-${year}`) ? 'rotate-180 bg-[#a3ff12]/10 text-[#a3ff12]' : 'text-zinc-500'}`}>
                  <ChevronDown size={24} />
                </div>
              </button>

              {expandedGroups.has(`year-${year}`) && (
                <div className="border-t border-white/5 bg-black/10 relative">
                  {/* Timeline Line */}
                  <div className="absolute left-8 md:left-11 top-0 bottom-0 w-px bg-white/5 z-0" />

                  <div className="space-y-2 pb-6">
                    {Object.keys(byYearMonth[year]).sort((a,b) => b.localeCompare(a)).map(month => (
                      <div key={`month-${year}-${month}`} className="relative">
                        <button onClick={() => toggleGroup(`month-${year}-${month}`)} className="w-full pl-16 pr-6 md:pl-20 md:pr-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors group relative z-10">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${expandedGroups.has(`month-${year}-${month}`) ? 'bg-[#FFD700] border-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.5)]' : 'bg-transparent border-white/20'}`} />
                            <span className="text-lg md:text-xl font-black text-white uppercase tracking-widest">Mês <span className="text-[#FFD700]">{month}</span></span>
                          </div>
                          <ChevronDown size={18} className={`text-zinc-500 transition-transform ${expandedGroups.has(`month-${year}-${month}`) ? 'rotate-180' : ''}`} />
                        </button>

                        {expandedGroups.has(`month-${year}-${month}`) && (
                          <div className="pl-16 pr-4 md:pl-24 md:pr-8 pb-6 space-y-4 animate-in slide-in-from-top-2 duration-300 relative z-10">
                            {byYearMonth[year][month].map((item: any) => (
                              <div key={item.id} className="group relative p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] bg-[#15151A] border border-white/5 hover:border-[#a3ff12]/30 transition-all shadow-2xl">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 md:gap-8">
                                  <div className="flex items-center gap-4 md:gap-6">
                                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-[#a3ff12]/10 text-[#a3ff12] flex items-center justify-center group-hover:scale-110 transition-transform">
                                      <DollarSign className="w-[26px] h-[26px]" />
                                    </div>
                                    <div>
                                      <h3 className="text-lg md:text-3xl font-black text-white tracking-tight">{item.descricao}</h3>
                                      <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 md:mt-2">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 md:px-3 md:py-1 bg-white/5 rounded-md md:rounded-lg border border-white/5">
                                          <Tag className="w-3 h-3" />
                                          <span className="text-[8px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest">{item.categoria}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                          <Calendar className="w-3 h-3" /> {new Date(item.data_recebimento).toLocaleDateString()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-left sm:text-right">
                                    <p className="text-2xl md:text-5xl font-black text-[#a3ff12] tracking-tighter">+ R$ {Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    <p className="text-[8px] md:text-[10px] font-black text-zinc-600 uppercase tracking-widest">RECEBIDO</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ));
        })()}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSubmit} className="bg-[#15151A] border border-white/10 rounded-[2rem] md:rounded-[3rem] w-full max-w-xl p-6 md:p-12 relative z-10 shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter mb-6 md:mb-8">Novo Ganho</h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Descrição</label>
                <input required value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#a3ff12] outline-none" placeholder="Ex: Salário, Venda de Carro..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Valor</label>
                  <input required type="number" step="0.01" value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#a3ff12] outline-none" placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Data</label>
                  <input required type="date" value={formData.data_recebimento} onChange={e => setFormData({...formData, data_recebimento: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#a3ff12] outline-none" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Categoria</label>
                  <button type="button" onClick={() => setIsCatModalOpen(true)} className="text-[10px] font-black text-[#a3ff12] uppercase">+ Criar Nova</button>
                </div>
                <select value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#a3ff12] outline-none appearance-none">
                  {categorias.map(cat => <option key={cat.id} value={cat.nome}>{cat.nome}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button type="submit" className="flex-1 py-5 bg-[#a3ff12] text-black font-black rounded-2xl hover:scale-105 transition-all shadow-2xl">CADASTRAR</button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 py-5 bg-white/5 text-white font-black rounded-2xl">CANCELAR</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Criar Categoria */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={() => setIsCatModalOpen(false)} />
          <div className="bg-[#15151A] border border-white/10 rounded-[2.5rem] w-full max-sm p-10 relative z-10 shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-2xl font-black text-white mb-8">Nova Categoria</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome</label>
                <input value={newCat.nome} onChange={e => setNewCat({...newCat, nome: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold" placeholder="Ex: Dividendos, Extra..." />
              </div>
              <button onClick={handleAddCategory} className="w-full py-4 bg-[#a3ff12] text-black font-black rounded-xl hover:scale-105 transition-all">CRIAR CATEGORIA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
