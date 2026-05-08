import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, DollarSign, Tag, Loader2, Bookmark, PieChart, Wallet, Layers, CheckCircle2, ChevronDown, Calculator } from 'lucide-react';
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

  // Estado para controlar se o valor inserido é o total ou da parcela
  const [parcelInputMode, setParcelInputMode] = useState<'parcela' | 'total'>('parcela');
  // Valor bruto digitado no campo (para manter o que o usuário escreveu)
  const [rawAmount, setRawAmount] = useState('');

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
  const displayList = viewMode === 'todas' ? despesasAgrupadas : modelos;

  return (
    <div className="animate-in fade-in duration-700 max-w-6xl mx-auto pt-4 pb-20 px-4 md:px-6">

      {/* Header */}
      <header className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
        <div className="text-left">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-3 md:mb-4">Despesas</h1>
          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <button onClick={() => setViewMode('todas')} className={`whitespace-nowrap text-[9px] md:text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${viewMode === 'todas' ? 'bg-[#a3ff12] text-black shadow-[0_0_15px_rgba(163,255,18,0.3)]' : 'text-zinc-500 bg-white/5 hover:text-white'}`}>Lançamentos</button>
            <button onClick={() => setViewMode('modelos')} className={`whitespace-nowrap text-[9px] md:text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${viewMode === 'modelos' ? 'bg-[#FFD700] text-black shadow-[0_0_15px_rgba(255,215,0,0.3)]' : 'text-zinc-500 bg-white/5 hover:text-white'}`}>Modelos Fixos</button>
          </div>
        </div>
        <button onClick={() => { setForm(emptyForm); setRawAmount(''); setIsModalOpen(true); }} className="w-full md:w-auto flex items-center justify-center gap-3 px-6 md:px-8 py-4 md:py-5 bg-[#a3ff12] text-black font-black rounded-2xl md:rounded-[1.5rem] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl">
          <Plus size={20} md:size={22} strokeWidth={3}/> NOVO LANÇAMENTO
        </button>
      </header>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
            {[
              { label: 'Total Lançado', val: totalGeral, sub: `${despesas.length} registros`, Icon: PieChart, color: 'text-zinc-500', border: 'border-white/5' },
              { label: 'A Pagar', val: totalPendente, sub: `${pendentes.length} pendentes`, Icon: Wallet, color: 'text-[#FF4D4D]', border: 'border-[#FF4D4D]/10' },
              { label: 'Pago', val: totalPago, sub: `${pagas.length} liquidadas`, Icon: CheckCircle2, color: 'text-[#a3ff12]', border: 'border-[#a3ff12]/10' },
              { label: 'Progresso', val: null, sub: null, Icon: Layers, color: 'text-zinc-500', border: 'border-white/5' },
            ].map(({ label, val, sub, Icon, color, border }, i) => (
              <div key={i} className={`p-4 md:p-6 rounded-2xl md:rounded-3xl bg-[#15151A] border ${border} shadow-xl flex flex-col justify-between`}>
                <div>
                  <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white/5 flex items-center justify-center ${color} mb-3`}><Icon size={16}/></div>
                  <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1 ${color}`}>{label}</p>
                </div>
                {val !== null ? (
                  <div>
                    <h2 className="text-base md:text-xl font-black text-white leading-tight">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                    <p className="text-zinc-600 text-[8px] md:text-[9px] font-bold mt-1 uppercase truncate">{sub}</p>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-base md:text-xl font-black text-white">{pct}%</h2>
                    <div className="w-full h-1 md:h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-[#a3ff12] transition-all" style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

      {viewMode === 'modelos' && (
        <div className="mb-8 p-5 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-2xl flex items-center gap-3">
          <Bookmark size={16} className="text-[#FFD700] shrink-0"/>
          <p className="text-[#FFD700] text-[10px] font-black uppercase tracking-widest">Modelos de despesas fixas — usados para gerar automaticamente os gastos de cada mês.</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-6">
        {loading ? (
          <div className="py-32 flex justify-center"><Loader2 className="animate-spin text-[#a3ff12]" size={40}/></div>
        ) : displayList.length === 0 ? (
          <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[3rem] text-zinc-500 font-black uppercase tracking-widest text-xs">Nenhum item</div>
        ) : (
          displayList.map((item: any) => {
            const mapKey = item._key ?? item.id;
            const isExpanded = expandedGroups.has(mapKey);
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
                          <DollarSign size={20} className="md:w-[26px] md:h-[26px]"/>
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
                          <p className={`text-xl md:text-2xl font-black tracking-tighter ${item.pago ? 'text-[#a3ff12]' : 'text-white'}`}>
                            R$ {Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
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
                              <Trash2 size={16} className="md:w-[18px] md:h-[18px]"/>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {item._isGroup && isExpanded && (
                  <div className="mt-2 ml-6 space-y-2 animate-in slide-in-from-top-2 duration-300">
                    {[...item._items].sort((a: any, b: any) => a.parcela_atual - b.parcela_atual).map((p: any) => (
                      <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${p.pago ? 'bg-[#a3ff12]/5 border-[#a3ff12]/20' : 'bg-black/30 border-white/5'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${p.pago ? 'bg-[#a3ff12] text-black' : 'bg-white/5 text-zinc-500'}`}>
                            {p.parcela_atual}
                          </div>
                          <div>
                            <span className="text-sm font-black text-white">Parcela {p.parcela_atual}/{p.numero_parcelas}</span>
                            <p className="text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                              <Calendar size={9}/> {formatDate(p.data_vencimento)}
                              {p.pago && <span className="text-[#a3ff12] ml-2">✓ Paga</span>}
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
          })
        )}
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
