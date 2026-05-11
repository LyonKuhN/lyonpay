import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Bell, Trash2, Check, Loader2, DollarSign, Receipt, Wallet, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

const IC = "block w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-[#a3ff12] transition-colors";
const LC = "block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5";

export default function Calendario() {
  const { token } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [lembretes, setLembretes] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({ titulo: '', descricao: '', data_lembrete: new Date().toISOString().split('T')[0] + 'T12:00' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const h = { Authorization: `Bearer ${token}` };
      const [r1, r2, r3] = await Promise.all([
        fetch(`${API_BASE_URL}/api/despesas`, { headers: h }),
        fetch(`${API_BASE_URL}/api/receitas`, { headers: h }),
        fetch(`${API_BASE_URL}/api/lembretes`, { headers: h }),
      ]);
      
      const despesas = await r1.json();
      const receitas = await r2.json();
      const reminders = await r3.json();

      const combined = [
        ...despesas.map((d: any) => ({ ...d, type: 'despesa', date: d.data_vencimento })),
        ...receitas.map((r: any) => ({ ...r, type: 'receita', date: r.data_recebimento }))
      ];

      setEvents(combined);
      setLembretes(reminders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/lembretes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newReminder),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setNewReminder({ titulo: '', descricao: '', data_lembrete: new Date().toISOString().split('T')[0] + 'T12:00' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleReminder = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`${API_BASE_URL}/api/lembretes/${id}/concluir`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ concluido: !currentStatus }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!confirm('Excluir este lembrete?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/lembretes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const calendarDays = [];

    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="h-24 md:h-32 bg-transparent border border-white/5 opacity-20" />);
    }

    // Days of current month
    for (let day = 1; day <= days; day++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date.startsWith(dateStr));
      const dayReminders = lembretes.filter(r => r.data_lembrete.startsWith(dateStr));
      const isToday = new Date().toISOString().startsWith(dateStr);

      calendarDays.push(
        <div key={day} className={`h-24 md:h-32 bg-[#15151A]/40 border border-white/5 p-1 md:p-2 flex flex-col gap-1 transition-colors hover:bg-white/5 ${isToday ? 'ring-1 ring-[#a3ff12]/50 bg-[#a3ff12]/5' : ''}`}>
          <span className={`text-[10px] md:text-xs font-black ${isToday ? 'text-[#a3ff12]' : 'text-zinc-500'}`}>{day}</span>
          <div className="flex flex-col gap-0.5 md:gap-1 overflow-y-auto no-scrollbar">
            {dayEvents.map((ev, idx) => (
              <div key={idx} className={`px-1.5 py-0.5 rounded text-[8px] md:text-[9px] font-bold truncate border ${ev.type === 'despesa' ? 'bg-[#FF4D4D]/10 text-[#FF4D4D] border-[#FF4D4D]/20' : 'bg-[#a3ff12]/10 text-[#a3ff12] border-[#a3ff12]/20'}`}>
                {ev.type === 'despesa' ? '-' : '+'} R$ {Number(ev.valor).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            ))}
            {dayReminders.map((rem, idx) => (
              <div key={idx} className={`px-1.5 py-0.5 rounded text-[8px] md:text-[9px] font-bold truncate bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 ${rem.concluido ? 'opacity-50 line-through' : ''}`}>
                🔔 {rem.titulo}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return calendarDays;
  };

  return (
    <div className="animate-in fade-in duration-700 max-w-6xl mx-auto pt-4 pb-20 px-4 md:px-6">
      
      <header className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-2">Calendário</h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Visualize suas finanças no tempo</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-3 px-6 py-4 bg-[#a3ff12] text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
        >
          <Bell className="w-5 h-5" strokeWidth={3}/> NOVO LEMBRETE
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Calendar Main View */}
        <div className="lg:col-span-2">
          <div className="bg-[#15151A] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-4">
                <button onClick={prevMonth} className="p-2 text-zinc-500 hover:text-white transition-colors"><ChevronLeft size={24}/></button>
                <h2 className="text-xl font-black text-white">{monthNames[currentDate.getMonth()]} <span className="text-[#a3ff12]">{currentDate.getFullYear()}</span></h2>
                <button onClick={nextMonth} className="p-2 text-zinc-500 hover:text-white transition-colors"><ChevronRight size={24}/></button>
              </div>
              <div className="hidden md:flex gap-4">
                <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-500 uppercase">
                  <div className="w-2 h-2 rounded-full bg-[#a3ff12]" /> Receitas
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-500 uppercase">
                  <div className="w-2 h-2 rounded-full bg-[#FF4D4D]" /> Despesas
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-white/5">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                <div key={d} className="py-3 text-center text-[10px] font-black text-zinc-600 uppercase tracking-widest border-r border-white/5 last:border-0">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {loading ? (
                <div className="col-span-7 py-32 flex justify-center"><Loader2 className="animate-spin text-[#a3ff12]" size={40}/></div>
              ) : renderCalendar()}
            </div>
          </div>
        </div>

        {/* Sidebar: Reminders List */}
        <div className="space-y-6">
          <div className="bg-[#15151A] rounded-[2rem] border border-white/5 p-6 shadow-2xl h-fit">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Bell className="text-[#FFD700]" size={20}/>
                <h3 className="text-lg font-black text-white">Próximos Lembretes</h3>
              </div>
              <span className="bg-[#FFD700]/10 text-[#FFD700] text-[10px] font-black px-2.5 py-1 rounded-full">{lembretes.filter(r => !r.concluido).length}</span>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar pr-1">
              {lembretes.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl">
                  <p className="text-zinc-500 text-[10px] font-black uppercase">Nenhum lembrete</p>
                </div>
              ) : (
                lembretes.map((rem) => (
                  <div key={rem.id} className={`group p-4 rounded-2xl border transition-all ${rem.concluido ? 'bg-black/20 border-white/5 opacity-50' : 'bg-white/5 border-white/10 hover:border-[#FFD700]/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-black text-white truncate ${rem.concluido ? 'line-through text-zinc-500' : ''}`}>{rem.titulo}</h4>
                        <p className="text-[10px] font-medium text-zinc-500 mt-1 line-clamp-2">{rem.descricao}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <CalendarIcon size={10} className="text-zinc-600"/>
                          <span className="text-[9px] font-black text-zinc-600 uppercase">
                            {new Date(rem.data_lembrete).toLocaleDateString('pt-BR')} {new Date(rem.data_lembrete).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button 
                          onClick={() => handleToggleReminder(rem.id, rem.concluido)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${rem.concluido ? 'bg-[#a3ff12] text-black' : 'bg-white/5 text-zinc-500 hover:text-[#a3ff12] hover:bg-[#a3ff12]/10'}`}
                        >
                          <Check size={14} strokeWidth={3}/>
                        </button>
                        <button 
                          onClick={() => handleDeleteReminder(rem.id)}
                          className="w-8 h-8 rounded-xl bg-white/5 text-zinc-500 hover:text-[#FF4D4D] hover:bg-[#FF4D4D]/10 flex items-center justify-center transition-all"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals Section */}
          <div className="bg-[#a3ff12]/5 border border-[#a3ff12]/10 rounded-[2rem] p-6">
            <div className="flex items-center gap-3 mb-4">
              <Receipt className="text-[#a3ff12]" size={20}/>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Resumo do Mês</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-zinc-500 uppercase">Receitas</span>
                <span className="text-sm font-black text-[#a3ff12]">
                  R$ {events.filter(e => e.type === 'receita' && new Date(e.date).getMonth() === currentDate.getMonth()).reduce((a, b) => a + Number(b.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-zinc-500 uppercase">Despesas</span>
                <span className="text-sm font-black text-[#FF4D4D]">
                  R$ {events.filter(e => e.type === 'despesa' && new Date(e.date).getMonth() === currentDate.getMonth()).reduce((a, b) => a + Number(b.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-px bg-white/5 my-2" />
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-white uppercase">Saldo Previsto</span>
                <span className="text-lg font-black text-white">
                  R$ {(
                    events.filter(e => e.type === 'receita' && new Date(e.date).getMonth() === currentDate.getMonth()).reduce((a, b) => a + Number(b.valor), 0) -
                    events.filter(e => e.type === 'despesa' && new Date(e.date).getMonth() === currentDate.getMonth()).reduce((a, b) => a + Number(b.valor), 0)
                  ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Modal Lembrete */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsModalOpen(false)}/>
          <form onSubmit={handleAddReminder} className="bg-[#15151A] border border-white/10 rounded-[2.5rem] w-full max-w-lg p-8 relative z-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-white tracking-tighter">Novo Lembrete</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={24}/></button>
            </div>

            <div className="space-y-6">
              <div>
                <label className={LC}>Título</label>
                <input required value={newReminder.titulo} onChange={e => setNewReminder({...newReminder, titulo: e.target.value})}
                  className={IC} placeholder="Ex: Pagar condomínio, Comprar pão..."/>
              </div>
              <div>
                <label className={LC}>Descrição (Opcional)</label>
                <textarea value={newReminder.descricao} onChange={e => setNewReminder({...newReminder, descricao: e.target.value})}
                  className={`${IC} h-24 resize-none`} placeholder="Detalhes do lembrete..."/>
              </div>
              <div>
                <label className={LC}>Data e Hora</label>
                <input required type="datetime-local" value={newReminder.data_lembrete}
                  onChange={e => setNewReminder({...newReminder, data_lembrete: e.target.value})} className={IC}/>
              </div>
            </div>

            <button type="submit" className="w-full mt-8 py-4 bg-[#a3ff12] text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl">
              CRIAR LEMBRETE
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
