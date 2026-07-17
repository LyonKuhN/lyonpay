import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Search, Trash2, ArrowLeft, Tag, AlertCircle, CheckCircle, Circle, ChevronDown, ChevronUp, Loader2, AlertTriangle, Info, Clock, CheckSquare, Edit3, Save, X, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

interface Compra {
  id: string;
  item: string;
  grupo?: string;
  prioridade: 'Alta' | 'Média' | 'Baixa';
  valor: number;
  data: string;
  comprado: boolean;
}

export default function AdminCompras() {
  const { token } = useAuth();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);

  const [newItem, setNewItem] = useState('');
  const [newGrupo, setNewGrupo] = useState('');
  const [isGrupoFocus, setIsGrupoFocus] = useState(false);
  const [newPrioridade, setNewPrioridade] = useState<'Alta' | 'Média' | 'Baixa'>('Média');
  const [newValor, setNewValor] = useState('');
  const [busca, setBusca] = useState('');
  
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'Pendentes' | 'Comprados'>('Pendentes');

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState('');
  const [editGrupo, setEditGrupo] = useState('');
  const [isEditGrupoFocus, setIsEditGrupoFocus] = useState(false);
  const [editPrioridade, setEditPrioridade] = useState<'Alta' | 'Média' | 'Baixa'>('Média');
  const [editValor, setEditValor] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Export Modal states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const fetchCompras = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/compras`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCompras(data);
      }
    } catch (error) {
      console.error('Erro ao buscar compras:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchCompras();
  }, [token]);

  const handleAddCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem || !newValor) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/compras`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          item: newItem,
          grupo: newGrupo.trim() === '' ? null : newGrupo.trim(),
          prioridade: newPrioridade,
          valor: parseFloat(newValor.replace(',', '.'))
        })
      });

      if (res.ok) {
        const novaCompra = await res.json();
        setCompras([novaCompra, ...compras]);
        setNewItem('');
        setNewValor('');
        setNewGrupo('');
        setNewPrioridade('Média');
        setActiveTab('Pendentes'); 
      }
    } catch (error) {
      console.error('Erro ao adicionar compra:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este item?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/compras/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCompras(compras.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Erro ao remover compra:', error);
    }
  };

  const toggleComprado = async (compra: Compra) => {
    setCompras(compras.map(c => c.id === compra.id ? { ...c, comprado: !c.comprado } : c));
    try {
      await fetch(`${API_BASE_URL}/api/admin/compras/${compra.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ comprado: !compra.comprado })
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setCompras(compras.map(c => c.id === compra.id ? { ...c, comprado: compra.comprado } : c));
    }
  };

  const toggleGrupo = (grupo: string) => {
    setGruposExpandidos(prev => ({ ...prev, [grupo]: !prev[grupo] }));
  };

  const startEdit = (compra: Compra) => {
    setEditingId(compra.id);
    setEditItem(compra.item);
    setEditGrupo(compra.grupo || '');
    setEditPrioridade(compra.prioridade);
    setEditValor(compra.valor.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (compra: Compra) => {
    if (!editItem || !editValor) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/compras/${compra.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          item: editItem,
          grupo: editGrupo.trim() === '' ? null : editGrupo.trim(),
          prioridade: editPrioridade,
          valor: parseFloat(editValor.replace(',', '.')),
          comprado: compra.comprado
        })
      });

      if (res.ok) {
        const updatedCompra = await res.json();
        setCompras(compras.map(c => c.id === updatedCompra.id ? updatedCompra : c));
        setEditingId(null);
      }
    } catch (error) {
      console.error('Erro ao salvar edição:', error);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const exportToWhatsApp = (tipo: 'tudo' | 'avulso' | 'grupo' | 'prioridade', valorExtra?: string) => {
    let itensParaExportar = compras.filter(c => !c.comprado);
    let titulo = 'Lista de Compras Pendentes';
    
    if (tipo === 'avulso') {
      itensParaExportar = itensParaExportar.filter(c => !c.grupo);
      titulo += ' (Itens Avulsos)';
    } else if (tipo === 'grupo' && valorExtra) {
      itensParaExportar = itensParaExportar.filter(c => c.grupo === valorExtra);
      titulo += ` (Grupo: ${valorExtra})`;
    } else if (tipo === 'prioridade' && valorExtra) {
      itensParaExportar = itensParaExportar.filter(c => c.prioridade === valorExtra);
      titulo += ` (Prioridade: ${valorExtra})`;
    }
  
    if (itensParaExportar.length === 0) {
      alert('Nenhum item pendente encontrado para esta seleção.');
      return;
    }
  
    let text = `🛒 *${titulo}*\n\n`;
    
    if (tipo === 'tudo' || tipo === 'prioridade') {
      const itensComGrupo = itensParaExportar.filter(c => c.grupo);
      const semGrupo = itensParaExportar.filter(c => !c.grupo);

      const mapGrupos = itensComGrupo.reduce((acc, curr) => {
        if (!acc[curr.grupo as string]) acc[curr.grupo as string] = [];
        acc[curr.grupo as string].push(curr);
        return acc;
      }, {} as Record<string, Compra[]>);

      Object.entries(mapGrupos).forEach(([g, itensDoGrupo]) => {
        text += `📁 *${g}*\n`;
        itensDoGrupo.forEach(c => {
          text += `  - ${c.item} (R$ ${Number(c.valor).toFixed(2)}) [${c.prioridade}]\n`;
        });
        text += `\n`;
      });

      if (semGrupo.length > 0) {
        text += `🏷️ *Avulsos*\n`;
        semGrupo.forEach(c => {
          text += `  - ${c.item} (R$ ${Number(c.valor).toFixed(2)}) [${c.prioridade}]\n`;
        });
        text += `\n`;
      }
    } else {
      itensParaExportar.forEach(c => {
        text += `- ${c.item} (R$ ${Number(c.valor).toFixed(2)}) [${c.prioridade}]\n`;
      });
    }
    
    const total = itensParaExportar.reduce((acc, curr) => acc + Number(curr.valor), 0);
    text += `\n💰 *Total Estimado: R$ ${total.toFixed(2)}*\n\nGerado via Lyonk.`;
  
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setIsExportModalOpen(false);
  };

  const getPriorityColor = (prioridade: string) => {
    switch (prioridade) {
      case 'Alta': return 'text-[#FF2D55] bg-[#FF2D55]/10 border-[#FF2D55]/20';
      case 'Média': return 'text-[#FFD700] bg-[#FFD700]/10 border-[#FFD700]/20';
      case 'Baixa': return 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20';
      default: return 'text-zinc-500 bg-white/5 border-white/10';
    }
  };

  const priorityWeight = { 'Alta': 3, 'Média': 2, 'Baixa': 1 };

  let filteredCompras = compras.filter(c => {
    const matchesBusca = c.item.toLowerCase().includes(busca.toLowerCase()) || (c.grupo && c.grupo.toLowerCase().includes(busca.toLowerCase()));
    const matchesTab = activeTab === 'Pendentes' ? !c.comprado : c.comprado;
    return matchesBusca && matchesTab;
  });

  filteredCompras.sort((a, b) => priorityWeight[b.prioridade] - priorityWeight[a.prioridade]);

  const pendentesParaTotais = compras.filter(c => !c.comprado);
  const totalEstimado = pendentesParaTotais.reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalAlta = pendentesParaTotais.filter(c => c.prioridade === 'Alta').reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalMedia = pendentesParaTotais.filter(c => c.prioridade === 'Média').reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalBaixa = pendentesParaTotais.filter(c => c.prioridade === 'Baixa').reduce((acc, curr) => acc + Number(curr.valor), 0);

  const itensSemGrupo = filteredCompras.filter(c => !c.grupo);
  const itensPorGrupo = filteredCompras.filter(c => c.grupo).reduce((acc, curr) => {
    const grupo = curr.grupo as string;
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(curr);
    return acc;
  }, {} as Record<string, Compra[]>);

  const todosOsGrupos = Array.from(new Set(pendentesParaTotais.filter(c => c.grupo).map(c => c.grupo as string)));

  const CompraRow = ({ compra, isGrouped = false }: { compra: Compra, isGrouped?: boolean }) => {
    const isEditing = editingId === compra.id;

    if (isEditing) {
      return (
        <div className="group p-4 md:p-6 rounded-3xl bg-[#15151A] border border-[#3B82F6] shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all flex flex-col z-20 relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Item</label>
              <input value={editItem} onChange={e => setEditItem(e.target.value)} className="w-full bg-black/40 border border-[#3B82F6]/50 rounded-xl py-2 px-3 text-sm text-white focus:border-[#3B82F6] outline-none transition-all"/>
            </div>
            <div className="relative">
              <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 md:mb-2 block">Grupo</label>
              <input 
                value={editGrupo} 
                onChange={e => setEditGrupo(e.target.value)} 
                onFocus={() => setIsEditGrupoFocus(true)}
                onBlur={() => setTimeout(() => setIsEditGrupoFocus(false), 200)}
                className="w-full bg-black/40 border border-[#3B82F6]/50 rounded-xl py-2 px-3 text-sm text-white focus:border-[#3B82F6] outline-none transition-all" 
                placeholder="Avulso se vazio"
              />
              {isEditGrupoFocus && todosOsGrupos.filter(g => g.toLowerCase().includes(editGrupo.toLowerCase())).length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#15151A] border border-[#3B82F6]/30 rounded-xl shadow-2xl z-50 max-h-40 overflow-y-auto overflow-x-hidden p-1">
                  {todosOsGrupos.filter(g => g.toLowerCase().includes(editGrupo.toLowerCase())).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setEditGrupo(g);
                        setIsEditGrupoFocus(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-[#3B82F6]/10 hover:text-white rounded-lg transition-colors truncate"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Prioridade</label>
              <select value={editPrioridade} onChange={e => setEditPrioridade(e.target.value as any)} className="w-full bg-black/40 border border-[#3B82F6]/50 rounded-xl py-2 px-3 text-sm text-white focus:border-[#3B82F6] outline-none transition-all appearance-none cursor-pointer">
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
            <div className="sm:col-span-2 md:col-span-4">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Valor (R$)</label>
              <input type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)} className="w-full bg-black/40 border border-[#3B82F6]/50 rounded-xl py-2 px-3 text-sm text-white focus:border-[#3B82F6] outline-none transition-all"/>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5 w-full">
            <button onClick={() => saveEdit(compra)} disabled={isSavingEdit} className="flex-1 md:flex-none px-6 py-2 rounded-xl bg-[#3B82F6] text-white hover:scale-105 active:scale-95 flex items-center justify-center transition-all disabled:opacity-50">
              {isSavingEdit ? <Loader2 size={18} className="animate-spin"/> : <span className="font-bold flex items-center gap-2"><Save size={18}/> Salvar Edição</span>}
            </button>
            <button onClick={cancelEdit} className="w-10 h-10 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all">
              <X size={18}/>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div 
        onClick={() => startEdit(compra)}
        className={`group p-4 md:p-6 rounded-3xl bg-[#15151A] border border-white/5 hover:border-[#3B82F6]/30 cursor-pointer transition-all relative flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 ${compra.comprado ? 'opacity-50 grayscale hover:grayscale-0' : ''}`}
      >
        <div className="absolute top-0 right-0 w-20 h-20 bg-[#3B82F6]/0 group-hover:bg-[#3B82F6]/5 blur-3xl transition-all pointer-events-none" />
        
        {/* Mobile Header: Button + Item Name + Trash */}
        <div className="flex items-start justify-between w-full md:w-auto z-10 relative">
          <div className="flex items-center gap-3 md:gap-5 w-full">
            <button 
              onClick={(e) => { e.stopPropagation(); toggleComprado(compra); }} 
              className="min-w-[40px] w-10 h-10 md:min-w-[56px] md:w-14 md:h-14 rounded-2xl bg-white/5 text-zinc-400 flex items-center justify-center shadow-inner hover:text-[#a3ff12] hover:bg-[#a3ff12]/10 transition-colors"
            >
              {compra.comprado ? <CheckCircle size={24} className="text-[#a3ff12]" /> : <Circle size={24} />}
            </button>
            <div className="flex-1 pr-2 md:pr-0">
              <h4 className={`text-base sm:text-lg md:text-xl font-black tracking-tight flex items-center gap-2 ${compra.comprado ? 'text-zinc-500 line-through' : 'text-white'}`}>
                {compra.item}
                <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-[#3B82F6] transition-opacity shrink-0 hidden md:block" />
              </h4>
              {!isGrouped && <p className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Avulso</p>}
            </div>
          </div>
          
          {/* Trash on top right for mobile */}
          <button 
            onClick={(e) => { e.stopPropagation(); handleDelete(compra.id); }}
            className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 hover:bg-red-500/20 hover:text-red-500 flex items-center justify-center transition-all md:hidden shrink-0"
          >
            <Trash2 size={16}/>
          </button>
        </div>

        {/* Details and Price Area */}
        <div className="flex items-center justify-between md:justify-end gap-4 md:gap-10 w-full md:w-auto pl-[52px] md:pl-0 z-10 relative">
          <div className="md:text-right">
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Prioridade</p>
            <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border ${getPriorityColor(compra.prioridade)}`}>
              {compra.prioridade}
            </span>
          </div>
          <div className="md:text-right">
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Valor</p>
            <p className="text-sm sm:text-base md:text-lg font-black text-white whitespace-nowrap">R$ {Number(compra.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          {/* Trash for desktop */}
          <button 
            onClick={(e) => { e.stopPropagation(); handleDelete(compra.id); }}
            className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 hover:bg-red-500/20 hover:text-red-500 md:flex items-center justify-center transition-all hidden"
          >
            <Trash2 size={18}/>
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-[#3B82F6]" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-10 animate-in fade-in duration-1000 pb-20 px-3 md:px-6">
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-6 md:mt-10">
        <div className="flex items-center gap-3 md:gap-4">
          <Link to="/admin" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-zinc-400 hover:text-white shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#3B82F6]/10 flex items-center justify-center border border-[#3B82F6]/20 shadow-[0_0_20px_rgba(59,130,246,0.2)] shrink-0">
            <ShoppingCart size={20} className="text-[#3B82F6] md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white tracking-tighter">Lista de Compras</h1>
            <p className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest">Planejamento e Aquisições</p>
          </div>
        </div>
        <div className="flex w-full md:w-auto">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="w-full md:w-auto h-12 md:h-[50px] px-6 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 font-black rounded-2xl hover:bg-[#25D366] hover:text-black transition-all flex items-center justify-center gap-2"
          >
            <Share2 size={20}/>
            <span>Exportar WhatsApp</span>
          </button>
        </div>
      </header>

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#15151A] border border-white/10 p-6 md:p-8 rounded-[2.5rem] max-w-md w-full relative shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setIsExportModalOpen(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white">
              <X size={24}/>
            </button>
            <h3 className="text-xl md:text-2xl font-black text-white mb-6 flex items-center gap-2">
              <Share2 className="text-[#25D366]" size={24}/> Exportar Lista
            </h3>
            <p className="text-xs md:text-sm text-zinc-400 mb-6">Selecione o que você deseja exportar para o WhatsApp (apenas itens pendentes serão enviados).</p>
            
            <div className="space-y-3">
              <button onClick={() => exportToWhatsApp('tudo')} className="w-full text-left p-4 rounded-2xl bg-white/5 hover:bg-[#25D366]/10 hover:text-[#25D366] transition-all border border-transparent hover:border-[#25D366]/30">
                <h4 className="font-bold text-white mb-1">Toda a Lista Pendente</h4>
                <p className="text-[10px] md:text-xs text-zinc-500">Exporta todos os itens não comprados organizados por grupo.</p>
              </button>
              
              <button onClick={() => exportToWhatsApp('avulso')} className="w-full text-left p-4 rounded-2xl bg-white/5 hover:bg-[#25D366]/10 hover:text-[#25D366] transition-all border border-transparent hover:border-[#25D366]/30">
                <h4 className="font-bold text-white mb-1">Apenas Itens Avulsos</h4>
                <p className="text-[10px] md:text-xs text-zinc-500">Itens que não pertencem a nenhum grupo.</p>
              </button>

              {todosOsGrupos.length > 0 && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <h4 className="font-bold text-white text-sm md:text-base mb-3">Exportar um Grupo</h4>
                  <div className="flex flex-wrap gap-2">
                    {todosOsGrupos.map(g => (
                      <button key={g} onClick={() => exportToWhatsApp('grupo', g)} className="px-3 py-1.5 md:px-4 md:py-2 bg-black/40 rounded-full text-[10px] md:text-xs font-bold text-zinc-300 hover:bg-[#25D366] hover:text-black transition-all">
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <h4 className="font-bold text-white text-sm md:text-base mb-3">Exportar por Prioridade</h4>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => exportToWhatsApp('prioridade', 'Alta')} className="flex-1 md:flex-none px-3 py-2 bg-[#FF2D55]/10 text-[#FF2D55] border border-[#FF2D55]/20 rounded-xl text-xs font-bold hover:bg-[#FF2D55] hover:text-white transition-all text-center">Alta</button>
                  <button onClick={() => exportToWhatsApp('prioridade', 'Média')} className="flex-1 md:flex-none px-3 py-2 bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/20 rounded-xl text-xs font-bold hover:bg-[#FFD700] hover:text-black transition-all text-center">Média</button>
                  <button onClick={() => exportToWhatsApp('prioridade', 'Baixa')} className="flex-1 md:flex-none px-3 py-2 bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 rounded-xl text-xs font-bold hover:bg-[#3B82F6] hover:text-white transition-all text-center">Baixa</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Cards de Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-[#15151A] p-4 md:p-6 rounded-3xl border border-[#3B82F6]/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#3B82F6]/10 blur-2xl" />
          <p className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 md:mb-2">Total Pendente</p>
          <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white truncate">R$ {totalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
        </div>
        
        <div className="bg-[#15151A] p-4 md:p-6 rounded-3xl border border-[#FF2D55]/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#FF2D55]/10 blur-2xl" />
          <p className="text-[9px] md:text-[10px] font-black text-[#FF2D55] uppercase tracking-widest mb-1 md:mb-2 flex items-center gap-1"><AlertTriangle size={10} className="md:w-3 md:h-3"/> Prioridade Alta</p>
          <h3 className="text-base sm:text-lg md:text-xl font-black text-[#FF2D55] truncate">R$ {totalAlta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
        </div>

        <div className="bg-[#15151A] p-4 md:p-6 rounded-3xl border border-[#FFD700]/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#FFD700]/10 blur-2xl" />
          <p className="text-[9px] md:text-[10px] font-black text-[#FFD700] uppercase tracking-widest mb-1 md:mb-2 flex items-center gap-1"><Clock size={10} className="md:w-3 md:h-3"/> Prioridade Média</p>
          <h3 className="text-base sm:text-lg md:text-xl font-black text-[#FFD700] truncate">R$ {totalMedia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
        </div>

        <div className="bg-[#15151A] p-4 md:p-6 rounded-3xl border border-[#3B82F6]/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#3B82F6]/10 blur-2xl" />
          <p className="text-[9px] md:text-[10px] font-black text-[#3B82F6] uppercase tracking-widest mb-1 md:mb-2 flex items-center gap-1"><Info size={10} className="md:w-3 md:h-3"/> Prioridade Baixa</p>
          <h3 className="text-base sm:text-lg md:text-xl font-black text-[#3B82F6] truncate">R$ {totalBaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
        </div>
      </div>

      <div className="p-5 md:p-8 rounded-[2.5rem] bg-[#15151A] border border-white/5 relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#3B82F6]/5 blur-3xl pointer-events-none rounded-[2.5rem]" />
        <h3 className="text-lg md:text-xl font-black text-white flex items-center gap-2 mb-4 md:mb-6">
          <Plus className="text-[#3B82F6]" size={18}/> Nova Aquisição
        </h3>
        
        <form onSubmit={handleAddCompra} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-end relative z-10">
          <div className="md:col-span-4">
            <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 md:mb-2 block">Item a Comprar</label>
            <input required value={newItem} onChange={e => setNewItem(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm md:text-base text-white focus:border-[#3B82F6] outline-none transition-all placeholder:text-zinc-700" placeholder="Ex: Celular, Papel A4..."/>
          </div>
          <div className="md:col-span-3 relative">
            <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 md:mb-2 block">Grupo (Opcional)</label>
            <input 
              value={newGrupo} 
              onChange={e => setNewGrupo(e.target.value)} 
              onFocus={() => setIsGrupoFocus(true)}
              onBlur={() => setTimeout(() => setIsGrupoFocus(false), 200)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm md:text-base text-white focus:border-[#3B82F6] outline-none transition-all placeholder:text-zinc-700" 
              placeholder="Ex: Mercado, Escritório..." 
            />
            {isGrupoFocus && todosOsGrupos.filter(g => g.toLowerCase().includes(newGrupo.toLowerCase())).length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#15151A] border border-white/10 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto overflow-x-hidden p-1">
                {todosOsGrupos.filter(g => g.toLowerCase().includes(newGrupo.toLowerCase())).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setNewGrupo(g);
                      setIsGrupoFocus(false);
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm md:text-base text-zinc-300 hover:bg-[#3B82F6]/10 hover:text-[#3B82F6] rounded-lg transition-colors truncate"
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:col-span-4 gap-3 md:gap-4">
            <div>
              <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 md:mb-2 block">Prioridade</label>
              <select value={newPrioridade} onChange={e => setNewPrioridade(e.target.value as any)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-3 md:px-4 text-sm md:text-base text-white focus:border-[#3B82F6] outline-none transition-all appearance-none cursor-pointer">
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 md:mb-2 block">Valor (R$)</label>
              <input required type="number" step="0.01" min="0" value={newValor} onChange={e => setNewValor(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-3 md:px-4 text-sm md:text-base text-white focus:border-[#3B82F6] outline-none transition-all placeholder:text-zinc-700" placeholder="Ex: 50.00"/>
            </div>
          </div>
          <div className="md:col-span-1 mt-2 md:mt-0">
            <button type="submit" disabled={isSubmitting} className="w-full h-12 md:h-[50px] bg-[#3B82F6] text-white rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-[#3B82F6]/20 disabled:opacity-50 font-bold md:font-normal gap-2">
              {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20}/>} <span className="md:hidden">Adicionar</span>
            </button>
          </div>
        </form>
      </div>

      <div className="flex bg-[#15151A] p-1.5 md:p-2 rounded-2xl md:rounded-full border border-white/5 w-full md:w-max overflow-hidden">
        <button 
          onClick={() => setActiveTab('Pendentes')}
          className={`flex-1 md:flex-none px-3 py-2 md:px-6 md:py-2 rounded-xl md:rounded-full text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest transition-all flex justify-center items-center gap-1 md:gap-2 ${activeTab === 'Pendentes' ? 'bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/20' : 'text-zinc-500 hover:text-white'}`}
        >
          <Clock size={14} className="md:w-4 md:h-4"/> Pendentes
        </button>
        <button 
          onClick={() => setActiveTab('Comprados')}
          className={`flex-1 md:flex-none px-3 py-2 md:px-6 md:py-2 rounded-xl md:rounded-full text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest transition-all flex justify-center items-center gap-1 md:gap-2 ${activeTab === 'Comprados' ? 'bg-[#a3ff12] text-black shadow-lg shadow-[#a3ff12]/20' : 'text-zinc-500 hover:text-white'}`}
        >
          <CheckSquare size={14} className="md:w-4 md:h-4"/> Pagos
        </button>
      </div>

      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 px-2 md:px-4">
          <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-2 md:gap-3">
            <div className={`w-1.5 md:w-2 h-5 md:h-6 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] ${activeTab === 'Pendentes' ? 'bg-[#3B82F6]' : 'bg-[#a3ff12]'}`} /> 
            {activeTab === 'Pendentes' ? 'Itens a Comprar' : 'Histórico de Pagos'}
          </h3>
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" 
              placeholder="Buscar item ou grupo..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full md:w-64 bg-[#15151A] border border-white/5 rounded-2xl md:rounded-full py-2 pl-10 pr-4 text-xs md:text-sm text-white focus:border-[#3B82F6] outline-none transition-all"
            />
          </div>
        </div>

        {filteredCompras.length === 0 ? (
          <div className="p-8 md:p-12 text-center rounded-[2rem] md:rounded-[2.5rem] bg-[#15151A] border border-white/5 mx-2 md:mx-0">
             <AlertCircle className="mx-auto text-zinc-600 mb-4" size={40} />
             <h4 className="text-lg md:text-xl font-bold text-zinc-400">Nenhum item {activeTab === 'Pendentes' ? 'pendente' : 'comprado'}</h4>
             <p className="text-xs md:text-sm text-zinc-600 mt-2 max-w-xs mx-auto">
                {activeTab === 'Pendentes' ? 'Preencha o formulário acima para planejar suas próximas compras.' : 'Marque um item pendente como comprado.'}
             </p>
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8">
            {Object.entries(itensPorGrupo).map(([grupo, itens]) => {
              const valorTotalGrupo = itens.reduce((acc, curr) => acc + Number(curr.valor), 0);
              const isExpanded = gruposExpandidos[grupo];

              return (
                <div key={grupo} className="rounded-3xl md:rounded-[2.5rem] bg-black/20 border border-white/5 overflow-hidden mx-1 md:mx-0">
                  <div 
                    onClick={() => toggleGrupo(grupo)}
                    className="p-4 md:p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-white/5 transition-all select-none"
                  >
                    <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'Pendentes' ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : 'bg-[#a3ff12]/10 text-[#a3ff12]'}`}>
                         {isExpanded ? <ChevronUp size={20} className="md:w-6 md:h-6"/> : <ChevronDown size={20} className="md:w-6 md:h-6"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base sm:text-lg md:text-xl font-black text-white flex items-center gap-2 truncate">
                          {grupo}
                        </h4>
                        <p className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                          {itens.length} {itens.length === 1 ? 'item' : 'itens'} {activeTab === 'Pendentes' ? 'pendentes' : 'pagos'}
                        </p>
                      </div>
                      
                      {/* Mobile Total (shows on top right for compact view) */}
                      <div className="text-right md:hidden shrink-0">
                        <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Total</p>
                        <p className={`text-sm sm:text-base font-black ${activeTab === 'Pendentes' ? 'text-[#3B82F6]' : 'text-[#a3ff12]'}`}>R$ {valorTotalGrupo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    
                    {/* Desktop Total */}
                    <div className="text-right hidden md:block">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total do Grupo</p>
                      <p className={`text-xl font-black ${activeTab === 'Pendentes' ? 'text-[#3B82F6]' : 'text-[#a3ff12]'}`}>R$ {valorTotalGrupo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-3 md:p-4 pt-0 border-t border-white/5 bg-black/10">
                      <div className="grid grid-cols-1 gap-2 md:gap-3 mt-3 md:mt-4">
                        {itens.map(compra => (
                          <CompraRow key={compra.id} compra={compra} isGrouped={true} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {itensSemGrupo.length > 0 && (
              <div className="space-y-3 md:space-y-4">
                <div className="px-3 md:px-4">
                  <h4 className="text-sm md:text-lg font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <Tag size={16} className="md:w-[18px] md:h-[18px]" /> Itens Avulsos
                  </h4>
                </div>
                <div className="grid grid-cols-1 gap-2 md:gap-4 mx-1 md:mx-0">
                  {itensSemGrupo.map(compra => (
                    <CompraRow key={compra.id} compra={compra} isGrouped={false} />
                  ))}
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}
