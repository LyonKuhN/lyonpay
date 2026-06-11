import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, DollarSign, Tag, Loader2, Bookmark, PieChart, Wallet, Layers, ChevronDown, Calculator, Edit2, Save, X, Search, Filter, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
};

const IC = "block w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white font-bold outline-none focus:border-[#a3ff12] transition-colors";
const LC = "block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5";

export default function Despesas() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [modelos, setModelos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'todas' | 'modelos'>('todas');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterTipo, setFilterTipo] = useState('');

  // Estado para controlar se o valor inserido é o total ou da parcela
  const [parcelInputMode, setParcelInputMode] = useState<'parcela' | 'total'>('parcela');
  // Valor bruto digitado no campo (para manter o que o usuário escreveu)
  const [rawAmount, setRawAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const emptyForm = {
    descricao: '', valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    tipo: 'variavel' as string,
    numero_parcelas: '2',
    valor_total: '',
    observacoes: '',
    categoria: 'Outros',
  };
  const [form, setForm] = useState(emptyForm);
  const [newCat, setNewCat] = useState({ nome: '', cor: '#a3ff12' });

  // Sincroniza o form.valor e form.valor_total sempre que o rawAmount, numero_parcelas ou mode mudar
  useEffect(() => {
    if (form.tipo !== 'parcelada') {
      setForm(prev => ({ ...prev, valor: rawAmount, valor_total: '' }));
      return;
    }

    const amt = parseFloat(rawAmount) || 0;
    const n = parseInt(form.numero_parcelas) || 1;

    if (parcelInputMode === 'parcela') {
      setForm(prev => ({
        ...prev,
        valor: rawAmount,
        valor_total: (amt * n).toFixed(2)
      }));
    } else {
      setForm(prev => ({
        ...prev,
        valor: (amt / n).toFixed(2),
        valor_total: rawAmount
      }));
    }
  }, [rawAmount, form.numero_parcelas, parcelInputMode, form.tipo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const h = { Authorization: `Bearer ${token}` };
      const [r1, r2, r3] = await Promise.all([
        fetch(API_BASE_URL + '/api/despesas', { headers: h }),
        fetch(API_BASE_URL + '/api/despesas/modelos', { headers: h }),
        fetch(API_BASE_URL + '/api/categorias', { headers: h }),
      ]);
      setDespesas(await r1.json());
      setModelos(await r2.json());
      const cats = await r3.json();
      setCategorias(cats.filter((c: any) => c.tipo === 'despesa'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchData(); }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(API_BASE_URL + '/api/despesas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) { 
        setIsModalOpen(false); 
        setForm(emptyForm); 
        setRawAmount('');
        fetchData(); 
      }
    } catch (err) { console.error(err); }
  };

  const handleAddCat = async () => {
    if (!newCat.nome.trim()) return;
    try {
      const res = await fetch(API_BASE_URL + '/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...newCat, tipo: 'despesa', icone: 'Tag' }),
      });
      if (res.ok) { setIsCatModalOpen(false); setNewCat({ nome: '', cor: '#a3ff12' }); fetchData(); }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta despesa?')) return;
    await fetch(`${API_BASE_URL}/api/despesas/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchData();
  };

  const handleUpdateValor = async (id: string) => {
    const valorNum = parseFloat(editingValue.replace(',', '.'));
    if (isNaN(valorNum)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/despesas/${id}/valor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ valor: valorNum })
      });
      if (response.ok) {
        setEditingId(null);
        fetchData();
      }
    } catch (err) { console.error(err); }
  };

  const handleTogglePago = async (id: string, isPago: boolean) => {
    try {
      const endpoint = isPago ? 'pendente' : 'pagar';
      const response = await fetch(`${API_BASE_URL}/api/despesas/${id}/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchData();
    } catch (err) { console.error(err); }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const totalGeral = despesas.reduce((a, c) => a + Number(c.valor), 0);
  const pendentes = despesas.filter(d => !d.pago);
  const pagas = despesas.filter(d => d.pago);
  const totalPendente = pendentes.reduce((a, c) => a + Number(c.valor), 0);
  const totalPago = pagas.reduce((a, c) => a + Number(c.valor), 0);
  const pct = totalGeral > 0 ? Math.round((totalPago / totalGeral) * 100) : 0;

  const grouped: Record<string, any> = {};
  for (const d of despesas) {
    if (d.group_id) {
      if (!grouped[d.group_id]) grouped[d.group_id] = { ...d, _isGroup: true, _items: [d], _key: d.group_id };
      else grouped[d.group_id]._items.push(d);
    } else {
      grouped[d.id] = { ...d, _isGroup: false, _key: d.id };
    }
  }
  const despesasAgrupadas = Object.values(grouped);
  let baseList = viewMode === 'todas' ? despesasAgrupadas : modelos;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    baseList = baseList.filter(d => 
      d.descricao?.toLowerCase().includes(q) || 
      d.observacoes?.toLowerCase().includes(q) ||
      (d._isGroup && d._items.some((p: any) => p.observacoes?.toLowerCase().includes(q))) ||
      (d.valor && d.valor.toString().includes(q))
    );
  }
  if (filterCategoria) {
    baseList = baseList.filter(d => d.categoria === filterCategoria);
  }
  if (filterTipo) {
    baseList = baseList.filter(d => {
      if (d._isGroup) return filterTipo === 'parcelada' || filterTipo === 'parcelado';
      const t = d.tipo?.toLowerCase();
      return t === filterTipo || (filterTipo === 'fixa' && t === 'fixo') || (filterTipo === 'parcelada' && t === 'parcelado');
    });
  }

  const displayList = baseList;

  let groupedInstallments: any[] = [];
  let otherExpenses: any[] = [];
  const byYearMonth: Record<string, Record<string, any[]>> = {};

  if (viewMode === 'todas') {
    groupedInstallments = displayList.filter(d => d._isGroup);
    otherExpenses = displayList.filter(d => !d._isGroup);

    for (const exp of otherExpenses) {
      let year = "Sem Data";
      let month = "00";
      if (exp.data_vencimento) {
        const d = new Date(exp.data_vencimento);
        year = d.getFullYear().toString();
        month = (d.getMonth() + 1).toString().padStart(2, '0');
      }
      if (!byYearMonth[year]) byYearMonth[year] = {};
      if (!byYearMonth[year][month]) byYearMonth[year][month] = [];
      byYearMonth[year][month].push(exp);
    }
  }

  return (
    <div className="animate-in fade-in duration-700 max-w-6xl mx-auto pt-4 pb-20 px-4 md:px-6">

      {/* Header */}
      <header className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
        <div className="text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-3 md:mb-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white">Despesas</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <button onClick={() => setViewMode('todas')} className={`whitespace-nowrap text-[9px] md:text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${viewMode === 'todas' ? 'bg-[#a3ff12] text-black shadow-[0_0_15px_rgba(163,255,18,0.3)]' : 'text-zinc-500 bg-white/5 hover:text-white'}`}>Lançamentos</button>
            <button onClick={() => setViewMode('modelos')} className={`whitespace-nowrap text-[9px] md:text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${viewMode === 'modelos' ? 'bg-[#FFD700] text-black shadow-[0_0_15px_rgba(255,215,0,0.3)]' : 'text-zinc-500 bg-white/5 hover:text-white'}`}>Modelos Fixos</button>
          </div>
        </div>
        <button onClick={() => { setForm(emptyForm); setRawAmount(''); setIsModalOpen(true); }} className="w-full md:w-auto flex items-center justify-center gap-3 px-6 md:px-8 py-4 md:py-5 bg-[#a3ff12] text-black font-black rounded-2xl md:rounded-[1.5rem] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl">
          <Plus className="w-5 h-5 md:w-6 md:h-6" strokeWidth={3}/> NOVO LANÇAMENTO
        </button>
      </header>

      {/* ── Analytics Section ── */}
      {viewMode === 'todas' && !loading && despesas.length > 0 && (() => {
        // Cálculos analíticos
        const fixas   = despesas.filter((d: any) => d.tipo === 'fixa' || d.tipo === 'fixo');
        const parcela = despesas.filter((d: any) => d.tipo === 'parcelada' || d.tipo === 'parcelado');
        const variav  = despesas.filter((d: any) => d.tipo === 'variavel' || d.tipo === 'variável' || (!d.tipo || (d.tipo !== 'fixa' && d.tipo !== 'fixo' && d.tipo !== 'parcelada' && d.tipo !== 'parcelado')));

        const totalFixas   = fixas.reduce((a: number, c: any) => a + Number(c.valor), 0);
        const totalParcela = parcela.reduce((a: number, c: any) => a + Number(c.valor), 0);
        const totalVariav  = variav.reduce((a: number, c: any) => a + Number(c.valor), 0);

        // Agrupamento por categoria
        const catMap: Record<string, number> = {};
        despesas.forEach((d: any) => {
          const cat = d.categoria || 'Outros';
          catMap[cat] = (catMap[cat] || 0) + Number(d.valor);
        });
        const catRanking = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
        const maxCatVal  = catRanking[0]?.[1] || 1;

        // Top 5 maiores despesas individuais
        const top5 = [...despesas].sort((a: any, b: any) => Number(b.valor) - Number(a.valor)).slice(0, 5);

        const catColors = ['#a3ff12', '#FFD700', '#00D1FF', '#FF7A00', '#FF4D4D', '#9B59B6', '#2ECC71'];

        return (
          <div className="mb-10 space-y-6">

            {/* KPI Cards — Tipo de despesa */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {[
                { label: 'Total Lançado',  val: totalGeral,    sub: `${despesas.length} registros`, color: '#a3ff12', bg: 'bg-[#a3ff12]/8',  Icon: PieChart },
                { label: 'Contas Fixas',   val: totalFixas,    sub: `${fixas.length} fixas`,        color: '#00D1FF', bg: 'bg-[#00D1FF]/8', Icon: Bookmark },
                { label: 'Parcelamentos',  val: totalParcela,  sub: `${parcela.length} parcelas`,   color: '#FFD700', bg: 'bg-[#FFD700]/8', Icon: Layers },
                { label: 'Variáveis',      val: totalVariav,   sub: `${variav.length} lançamentos`, color: '#FF7A00', bg: 'bg-[#FF7A00]/8', Icon: Wallet },
              ].map(({ label, val, sub, color, bg, Icon }, i) => (
                <div key={i} className={`p-4 md:p-6 rounded-2xl md:rounded-3xl bg-[#15151A] border border-white/5 shadow-xl`}>
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`} style={{ color }}>
                    <Icon size={16} />
                  </div>
                  <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">{label}</p>
                  <h2 className="text-base md:text-xl font-black text-white leading-tight">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                  <p className="text-zinc-600 text-[8px] md:text-[9px] font-bold mt-1 uppercase">{sub}</p>
                </div>
              ))}
            </div>

            {/* Progresso pago/pendente */}
            <div className="p-4 md:p-6 rounded-2xl bg-[#15151A] border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Progresso do Mês</p>
                <p className="text-[#a3ff12] font-black text-sm">{pct}% pago</p>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full bg-[#a3ff12] transition-all duration-1000" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                <span>Pago: R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <span>Pendente: R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Duas colunas: Gráfico por categoria + Top 5 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Gráfico de barras por categoria */}
              <div className="p-5 md:p-6 rounded-2xl bg-[#15151A] border border-white/5">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-1.5 h-5 bg-[#a3ff12] rounded-full" />
                  <p className="text-sm font-black text-white">Gasto por Categoria</p>
                </div>
                <div className="space-y-3">
                  {catRanking.slice(0, 7).map(([cat, val], i) => {
                    const pctCat = Math.round((Number(val) / maxCatVal) * 100);
                    const col = catColors[i % catColors.length];
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col }} />
                            <span className="text-[10px] font-black text-zinc-300 uppercase tracking-wider truncate">{cat}</span>
                          </div>
                          <span className="text-[10px] font-black text-white ml-2 shrink-0">R$ {Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pctCat}%`, backgroundColor: col }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top 5 maiores despesas */}
              <div className="p-5 md:p-6 rounded-2xl bg-[#15151A] border border-white/5">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-1.5 h-5 bg-[#FFD700] rounded-full" />
                  <p className="text-sm font-black text-white">Maiores Gastos</p>
                </div>
                <div className="space-y-3">
                  {top5.map((d: any, i: number) => {
                    const pctTop = Math.round((Number(d.valor) / Number(top5[0].valor)) * 100);
                    return (
                      <div key={d.id} className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-zinc-600 w-4 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-zinc-300 truncate">{d.descricao}</span>
                            <span className="text-[10px] font-black text-white ml-2 shrink-0">R$ {Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pctTop}%`, backgroundColor: i === 0 ? '#FFD700' : i === 1 ? '#a3ff12' : '#00D1FF' }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Divisão visual do orçamento (donut simulado com segmentos) */}
            <div className="p-5 md:p-6 rounded-2xl bg-[#15151A] border border-white/5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1.5 h-5 bg-[#00D1FF] rounded-full" />
                <p className="text-sm font-black text-white">Distribuição do Orçamento</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-5 rounded-full overflow-hidden flex">
                  {totalFixas > 0 && (
                    <div className="h-full bg-[#00D1FF] transition-all" style={{ width: `${(totalFixas / totalGeral) * 100}%` }} title={`Fixas: ${((totalFixas/totalGeral)*100).toFixed(0)}%`} />
                  )}
                  {totalParcela > 0 && (
                    <div className="h-full bg-[#FFD700]" style={{ width: `${(totalParcela / totalGeral) * 100}%` }} title={`Parcelados: ${((totalParcela/totalGeral)*100).toFixed(0)}%`} />
                  )}
                  {totalVariav > 0 && (
                    <div className="h-full bg-[#FF7A00]" style={{ width: `${(totalVariav / totalGeral) * 100}%` }} title={`Variáveis: ${((totalVariav/totalGeral)*100).toFixed(0)}%`} />
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-3">
                {[
                  { label: 'Fixas',      val: totalFixas,    pct: totalGeral > 0 ? ((totalFixas/totalGeral)*100).toFixed(0) : '0',    col: '#00D1FF' },
                  { label: 'Parcelados', val: totalParcela,  pct: totalGeral > 0 ? ((totalParcela/totalGeral)*100).toFixed(0) : '0',  col: '#FFD700' },
                  { label: 'Variáveis',  val: totalVariav,   pct: totalGeral > 0 ? ((totalVariav/totalGeral)*100).toFixed(0) : '0',   col: '#FF7A00' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.col }} />
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{s.label}</span>
                    <span className="text-[9px] font-black text-white">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/5" />
          </div>
        );
      })()}

      {viewMode === 'modelos' && (
        <div className="mb-8 p-5 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-2xl flex items-center gap-3">
          <Bookmark size={16} className="text-[#FFD700] shrink-0"/>
          <p className="text-[#FFD700] text-[10px] font-black uppercase tracking-widest">Modelos de despesas fixas — usados para gerar automaticamente os gastos de cada mês.</p>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 bg-[#15151A] p-4 rounded-2xl border border-white/5">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por descrição, valor ou observação..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white font-bold outline-none focus:border-[#a3ff12] transition-colors"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
            <select 
              value={filterCategoria} 
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="w-full sm:w-auto min-w-[160px] bg-black/40 border border-white/10 rounded-xl pl-10 pr-10 py-3.5 text-sm text-white font-bold outline-none focus:border-[#a3ff12] appearance-none cursor-pointer transition-colors"
            >
              <option value="">Todas as Categorias</option>
              {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
            <select 
              value={filterTipo} 
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full sm:w-auto min-w-[160px] bg-black/40 border border-white/10 rounded-xl pl-10 pr-10 py-3.5 text-sm text-white font-bold outline-none focus:border-[#a3ff12] appearance-none cursor-pointer transition-colors"
            >
              <option value="">Todos os Tipos</option>
              <option value="variavel">Variável</option>
              <option value="fixa">Fixa</option>
              <option value="parcelada">Parcelada</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-6">
        {(() => {
          if (loading) return <div className="py-32 flex justify-center"><Loader2 className="animate-spin text-[#a3ff12]" size={40}/></div>;
          if (displayList.length === 0) return <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[3rem] text-zinc-500 font-black uppercase tracking-widest text-xs">Nenhum item</div>;

          const renderCard = (item: any) => {
            const mapKey = item._key ?? item.id;
            const isExpanded = expandedGroups.has(mapKey);
            
            let paidParcels = 0, totalParcels = 1, paidValue = 0, totalValue = 0, lastDate = '';
            if (item._isGroup) {
              const items = item._items || [];
              totalParcels = item.numero_parcelas || items.length;
              paidParcels = items.filter((p: any) => p.pago).length;
              totalValue = items.reduce((a: number, p: any) => a + Number(p.valor), 0);
              paidValue = items.filter((p: any) => p.pago).reduce((a: number, p: any) => a + Number(p.valor), 0);
              const sorted = [...items].sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());
              if (sorted.length > 0) lastDate = sorted[sorted.length - 1].data_vencimento;
            }

            return (
              <div key={mapKey}>
                <div className="relative">
                  {item._isGroup && !isExpanded && (
                    <>
                      <div className="absolute inset-x-4 -bottom-2 h-full rounded-[2rem] bg-[#1e1e24] border border-white/5 z-0"/>
                      <div className="absolute inset-x-8 -bottom-4 h-full rounded-[2rem] bg-[#1a1a20] border border-white/5 z-[-1]"/>
                    </>
                  )}
                  <div
                    className={`relative z-10 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] bg-[#15151A] border transition-all shadow-xl ${item._isGroup ? 'border-[#FFD700]/20 hover:border-[#FFD700]/40 cursor-pointer' : 'border-white/5 hover:border-white/15'}`}
                    onClick={() => item._isGroup && toggleGroup(mapKey)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 md:gap-5">
                        <div className={`w-11 h-11 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${item.pago ? 'bg-[#a3ff12]/10 text-[#a3ff12]' : item._isGroup ? 'bg-[#FFD700]/10 text-[#FFD700]' : 'bg-white/5 text-zinc-500'}`}>
                          <DollarSign className="w-5 h-5 md:w-6 md:h-6"/>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base md:text-lg font-black text-white truncate">{item._isGroup ? item.descricao.replace(/ \(\d+\/\d+\)$/, '') : item.descricao}</h3>
                          <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-1">
                            {item.categoria && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 rounded border border-white/5 text-[8px] md:text-[9px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                                <Tag size={8} className="text-[#a3ff12]"/> {item.categoria}
                              </span>
                            )}
                            {item._isGroup ? (
                              <span className="text-[8px] md:text-[9px] font-black text-[#FFD700] uppercase tracking-widest">
                                {item._items.length}/{item.numero_parcelas} parcelas
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[8px] md:text-[9px] font-black text-zinc-500 uppercase">
                                <Calendar size={9}/> {formatDate(item.data_vencimento)}
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 bg-white/5 rounded text-[7px] md:text-[8px] font-black text-zinc-600 uppercase">{item.tipo}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <div className="text-left sm:text-right">
                          {editingId === item.id ? (
                            <div className="flex items-center justify-end gap-2 mb-2" onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                className="w-24 md:w-32 bg-white/5 border border-[#a3ff12]/30 text-white text-lg md:text-xl font-black rounded-lg px-2 py-1 outline-none focus:border-[#a3ff12]"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateValor(item.id)}
                                autoFocus
                              />
                              <button onClick={() => handleUpdateValor(item.id)} className="p-2 bg-[#a3ff12] text-black rounded-lg hover:scale-110 active:scale-95 transition-all">
                                <Save size={14} />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-2 bg-white/5 text-zinc-500 rounded-lg hover:text-white transition-all">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-end group/edit">
                              {!item.pago && !item._isGroup && (
                                <>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleTogglePago(item.id, false); }}
                                    className="p-1.5 text-zinc-600 hover:text-[#a3ff12] transition-all bg-white/5 rounded-lg mr-1"
                                    title="Marcar como pago"
                                  >
                                    <Check size={12} strokeWidth={4} />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditingValue(item.valor.toString()); }}
                                    className="p-1.5 text-zinc-600 hover:text-white transition-all bg-white/5 rounded-lg"
                                    title="Editar valor"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </>
                              )}
                              {item.pago && !item._isGroup && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleTogglePago(item.id, true); }}
                                  className="p-1.5 text-[#a3ff12] hover:text-[#FF4D4D] transition-all bg-[#a3ff12]/10 rounded-lg mr-1 group-hover/edit:opacity-100 opacity-50"
                                  title="Desfazer pagamento"
                                >
                                  <Check size={12} strokeWidth={4} />
                                </button>
                              )}
                              <p className={`text-xl md:text-2xl font-black tracking-tighter ${item.pago ? 'text-[#a3ff12]' : 'text-white'}`}>
                                R$ {Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          )}
                          {item._isGroup && <p className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase">por parcela</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {item._isGroup ? (
                            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[#FFD700]/10 text-[#FFD700] flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                              <ChevronDown size={18}/>
                            </div>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                              className="w-9 h-9 md:w-11 md:h-11 rounded-xl bg-[#FF4D4D]/10 text-[#FF4D4D] hover:bg-[#FF4D4D] hover:text-white transition-all flex items-center justify-center active:scale-90">
                              <Trash2 className="w-4 h-4 md:w-5 md:h-5"/>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {item._isGroup && (
                      <div className="mt-5 pt-5 border-t border-white/5">
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Progresso do Parcelamento</span>
                           <span className="text-[10px] font-black text-[#FFD700]">{totalValue > 0 ? Math.round((paidValue / totalValue) * 100) : 0}% Pago</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                           <div className="h-full bg-[#FFD700] rounded-full transition-all duration-1000" style={{ width: `${totalValue > 0 ? (paidValue / totalValue) * 100 : 0}%` }} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                           <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-[#a3ff12]"></div>
                             Pagas: <span className="text-white">{paidParcels}/{totalParcels}</span>
                           </div>
                           <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-[#FFD700]"></div>
                             Restam: <span className="text-white">{totalParcels - paidParcels} parcelas</span>
                           </div>
                           <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-[#00D1FF]"></div>
                             Falta Pagar: <span className="text-white">R$ {(totalValue - paidValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                           </div>
                           {lastDate && (
                             <div className="flex items-center gap-1.5">
                               <Calendar size={10} className="text-zinc-400"/>
                               Última em: <span className="text-white">{formatDate(lastDate)}</span>
                             </div>
                           )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {item._isGroup && isExpanded && (
                  <div className="mt-2 ml-6 space-y-2 animate-in slide-in-from-top-2 duration-300">
                    {[...item._items].sort((a: any, b: any) => a.parcela_atual - b.parcela_atual).map((p: any) => (
                      <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${p.pago ? 'bg-[#a3ff12]/5 border-[#a3ff12]/20' : 'bg-black/30 border-white/5'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black cursor-pointer transition-all ${p.pago ? 'bg-[#a3ff12] text-black hover:bg-[#FF4D4D] hover:text-white' : 'bg-white/5 text-zinc-500 hover:bg-[#a3ff12] hover:text-black'}`}
                               onClick={(e) => { e.stopPropagation(); handleTogglePago(p.id, p.pago); }}
                               title={p.pago ? "Desfazer pagamento" : "Marcar como pago"}>
                            {p.pago ? <Check size={14} strokeWidth={4} /> : p.parcela_atual}
                          </div>
                          <div>
                            <span className="text-sm font-black text-white">Parcela {p.parcela_atual}/{p.numero_parcelas}</span>
                            <p className="text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                              <Calendar size={9}/> {formatDate(p.data_vencimento)}
                              {p.pago && <span className="text-[#a3ff12] ml-2 flex items-center gap-1"><Check size={10} /> Paga</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className={`font-black text-lg ${p.pago ? 'text-[#a3ff12]' : 'text-white'}`}>
                            R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <button onClick={() => handleDelete(p.id)}
                            className="w-8 h-8 rounded-lg bg-[#FF4D4D]/10 text-[#FF4D4D] hover:bg-[#FF4D4D] hover:text-white transition-all flex items-center justify-center">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          };

          if (viewMode === 'modelos') return displayList.map(item => renderCard(item));

          return (
            <div className="space-y-6">
              {groupedInstallments.length > 0 && (
                <div className="space-y-4">
                  {groupedInstallments.map(item => renderCard(item))}
                </div>
              )}

              {Object.keys(byYearMonth).sort((a,b) => b.localeCompare(a)).map(year => (
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
                      {/* Timeline Line for Year */}
                      <div className="absolute left-8 md:left-11 top-0 bottom-0 w-px bg-white/5 z-0" />

                      <div className="space-y-2 pb-6">
                        {Object.keys(byYearMonth[year]).sort((a,b) => b.localeCompare(a)).map(month => (
                          <div key={`month-${year}-${month}`} className="relative">
                            
                            {/* Month Header */}
                            <button onClick={() => toggleGroup(`month-${year}-${month}`)} className="w-full pl-16 pr-6 md:pl-20 md:pr-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors group relative z-10">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${expandedGroups.has(`month-${year}-${month}`) ? 'bg-[#FFD700] border-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.5)]' : 'bg-transparent border-white/20'}`} />
                                <span className="text-lg md:text-xl font-black text-white uppercase tracking-widest">Mês <span className="text-[#FFD700]">{month}</span></span>
                              </div>
                              <div className={`w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center transition-transform duration-300 group-hover:bg-white/10 ${expandedGroups.has(`month-${year}-${month}`) ? 'rotate-180' : ''}`}>
                                <ChevronDown size={18} className="text-zinc-500" />
                              </div>
                            </button>

                            {expandedGroups.has(`month-${year}-${month}`) && (
                              <div className="pl-16 pr-4 md:pl-24 md:pr-8 pb-6 space-y-4 animate-in slide-in-from-top-2 duration-300 relative z-10">
                                {byYearMonth[year][month].map(item => renderCard(item))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsModalOpen(false)}/>
          <form onSubmit={handleSubmit} className="bg-[#15151A] border border-white/10 rounded-[2rem] md:rounded-[2.5rem] w-full max-w-xl p-6 md:p-10 relative z-10 shadow-2xl animate-in zoom-in duration-300 my-8 space-y-4 md:space-y-5">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Novo Gasto</h2>

            {/* Tipo */}
            <div>
              <label className={LC}>Tipo de Despesa</label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {(['variavel', 'fixa', 'parcelada'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, tipo: t })}
                    className={`py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${form.tipo === t ? 'bg-[#a3ff12] text-black shadow-lg' : 'bg-white/5 text-zinc-500 border border-white/5 hover:border-white/10'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={LC}>Descrição</label>
                <input required value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                  className={IC} placeholder="Ex: Aluguel, Netflix..."/>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className={LC}>Categoria</label>
                  <button type="button" onClick={() => setIsCatModalOpen(true)} className="text-[10px] font-black text-[#a3ff12] uppercase hover:opacity-70">+ Criar</button>
                </div>
                <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className={`${IC} appearance-none`}>
                  {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
            </div>

            {/* VALOR COM SELETOR DE MODO (Para Parcelada) */}
            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <label className={LC}>Valor</label>
                {form.tipo === 'parcelada' && (
                  <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                    <button type="button" onClick={() => setParcelInputMode('parcela')} 
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${parcelInputMode === 'parcela' ? 'bg-[#a3ff12] text-black' : 'text-zinc-500 hover:text-white'}`}>
                      P/ Parcela
                    </button>
                    <button type="button" onClick={() => setParcelInputMode('total')} 
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${parcelInputMode === 'total' ? 'bg-[#a3ff12] text-black' : 'text-zinc-500 hover:text-white'}`}>
                      Total
                    </button>
                  </div>
                )}
              </div>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
                <input required type="number" step="0.01" min="0.01" value={rawAmount}
                  onChange={e => setRawAmount(e.target.value)} 
                  className={`${IC} pl-12 text-xl`} placeholder="0,00"/>
              </div>
              
              {/* Preview para parcelada */}
              {form.tipo === 'parcelada' && rawAmount && (
                <div className="flex items-center gap-3 p-3 bg-[#a3ff12]/5 border border-[#a3ff12]/10 rounded-xl animate-in fade-in slide-in-from-top-1">
                  <Calculator size={14} className="text-[#a3ff12]"/>
                  <div className="text-[10px] font-bold uppercase tracking-tight text-zinc-400">
                    {parcelInputMode === 'parcela' ? (
                      <>Total desta compra: <span className="text-[#a3ff12]">R$ {form.valor_total}</span></>
                    ) : (
                      <>Cada uma das {form.numero_parcelas} parcelas: <span className="text-[#a3ff12]">R$ {form.valor}</span></>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {form.tipo === 'variavel' && (
                <div className="col-span-2">
                  <label className={LC}>Data de Vencimento</label>
                  <input required type="date" value={form.data_vencimento}
                    onChange={e => setForm({ ...form, data_vencimento: e.target.value })} className={IC}/>
                </div>
              )}
              {form.tipo === 'fixa' && (
                <div className="col-span-2">
                  <label className={LC}>Dia de Vencimento (1-31)</label>
                  <input required type="number" min="1" max="31"
                    value={form.data_vencimento ? new Date(form.data_vencimento + 'T12:00:00').getDate() : ''}
                    onChange={e => {
                      const day = parseInt(e.target.value);
                      if (day >= 1 && day <= 31) {
                        const now = new Date();
                        const d = new Date(now.getFullYear(), now.getMonth(), day);
                        setForm({ ...form, data_vencimento: d.toISOString().split('T')[0] });
                      }
                    }}
                    className={IC} placeholder="Ex: 5"/>
                </div>
              )}
              {form.tipo === 'parcelada' && (
                <>
                  <div>
                    <label className={LC}>Nº Parcelas</label>
                    <input required type="number" min="2" value={form.numero_parcelas}
                      onChange={e => setForm({ ...form, numero_parcelas: e.target.value })} className={IC}/>
                  </div>
                  <div>
                    <label className={LC}>1ª Parcela em</label>
                    <input required type="date" value={form.data_vencimento}
                      onChange={e => setForm({ ...form, data_vencimento: e.target.value })} className={IC}/>
                  </div>
                </>
              )}
            </div>

            <div>
              <label className={LC}>Observações (opcional)</label>
              <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                className={`${IC} h-20 resize-none text-sm`} placeholder="Algum detalhe extra?"/>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 py-4 bg-[#a3ff12] text-black font-black rounded-xl hover:scale-105 transition-all shadow-xl">CONFIRMAR GASTO</button>
              <button type="button" onClick={() => setIsModalOpen(false)}
                className="px-8 py-4 bg-white/5 text-white font-black rounded-xl hover:bg-white/10 transition-all">CANCELAR</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Categoria */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={() => setIsCatModalOpen(false)}/>
          <div className="bg-[#15151A] border border-white/10 rounded-[2.5rem] w-full max-w-sm p-10 relative z-10 shadow-2xl animate-in zoom-in duration-300 space-y-5">
            <h2 className="text-2xl font-black text-white">Nova Categoria</h2>
            <div>
              <label className={LC}>Nome</label>
              <input value={newCat.nome} onChange={e => setNewCat({ ...newCat, nome: e.target.value })}
                className={IC} placeholder="Ex: Pets, Assinaturas..."/>
            </div>
            <button onClick={handleAddCat} className="w-full py-4 bg-[#a3ff12] text-black font-black rounded-xl hover:scale-105 transition-all">CRIAR CATEGORIA</button>
          </div>
        </div>
      )}
    </div>
  );
}
