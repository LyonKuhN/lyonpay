import { useState, useEffect } from 'react';
import { Users, TrendingUp, ShieldCheck, Save, Loader2, ArrowRight, Star, Ticket, Plus, Trash2, ShoppingCart, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

export default function Admin() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [cupons, setCupons] = useState<any[]>([]);
  const [newFee, setNewFee] = useState('');
  const [updatingFee, setUpdatingFee] = useState(false);
  const [newCupom, setNewCupom] = useState({ codigo: '', desconto: '', max_usos: '' });
  const [creatingCupom, setCreatingCupom] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [resStats, resUsers, resCupons] = await Promise.all([
        fetch(API_BASE_URL + '/api/admin/stats', { headers }),
        fetch(API_BASE_URL + '/api/admin/users', { headers }),
        fetch(API_BASE_URL + '/api/admin/cupons', { headers })
      ]);
      const dataStats = await resStats.json();
      const dataUsers = await resUsers.json();
      const dataCupons = await resCupons.json();
      setStats(dataStats);
      setUsers(Array.isArray(dataUsers) ? dataUsers : []);
      setCupons(Array.isArray(dataCupons) ? dataCupons : []);
      setNewFee(dataStats.monthlyFee || '');
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleUpdateFee = async () => {
    setUpdatingFee(true);
    try {
      const res = await fetch(API_BASE_URL + '/api/admin/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ key: 'monthly_fee', value: newFee })
      });
      if (res.ok) fetchData();
    } catch (err) { console.error(err); }
    finally { setUpdatingFee(false); }
  };

  const handleCreateCupom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCupom.codigo || !newCupom.desconto) return;
    setCreatingCupom(true);
    try {
      const res = await fetch(API_BASE_URL + '/api/admin/cupons', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          codigo: newCupom.codigo, 
          desconto_percentual: newCupom.desconto, 
          max_usos: newCupom.max_usos || null 
        })
      });
      if (res.ok) {
        setNewCupom({ codigo: '', desconto: '', max_usos: '' });
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || 'Erro ao criar cupom');
      }
    } catch (err) { console.error(err); }
    finally { setCreatingCupom(false); }
  };

  const handleDeleteCupom = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este cupom?')) return;
    try {
      const res = await fetch(API_BASE_URL + '/api/admin/cupons/' + id, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-[#a3ff12]" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-1000 pb-20 px-4 md:px-6">
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 mt-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#a3ff12]/10 flex items-center justify-center border border-[#a3ff12]/20 shadow-[0_0_20px_rgba(163,255,18,0.2)]">
            <ShieldCheck size={24} className="text-[#a3ff12]" />
          </div>
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter">Painel Admin</h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Gestão da Plataforma Lyonk</p>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-8 rounded-[2.5rem] bg-[#15151A] border border-white/5 relative overflow-hidden group hover:border-[#a3ff12]/20 transition-all">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#a3ff12]/5 blur-3xl" />
          <p className="text-zinc-500 font-black text-[10px] uppercase tracking-widest mb-4">Total Usuários</p>
          <div className="flex items-end justify-between">
            <h2 className="text-4xl font-black text-white leading-none">{stats?.totalUsers}</h2>
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500"><Users size={20}/></div>
          </div>
        </div>

        <div className="p-8 rounded-[2.5rem] bg-[#15151A] border border-white/5 relative overflow-hidden group hover:border-[#FFD700]/20 transition-all">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#FFD700]/5 blur-3xl" />
          <p className="text-zinc-500 font-black text-[10px] uppercase tracking-widest mb-4">Assinantes PRO</p>
          <div className="flex items-end justify-between">
            <h2 className="text-4xl font-black text-[#FFD700] leading-none">{stats?.proUsers}</h2>
            <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 flex items-center justify-center text-[#FFD700]"><Star size={20}/></div>
          </div>
        </div>

        <div className="p-8 rounded-[2.5rem] bg-[#15151A] border border-white/5 relative overflow-hidden group">
          <p className="text-zinc-500 font-black text-[10px] uppercase tracking-widest mb-4">Volume Mensal (Mov.)</p>
          <div className="flex items-end justify-between">
            <h2 className="text-4xl font-black text-white leading-none truncate">R$ {stats?.globalVolume.toLocaleString('pt-BR')}</h2>
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500"><TrendingUp size={20}/></div>
          </div>
        </div>

        <div className="p-8 rounded-[2.5rem] bg-[#15151A] border border-[#a3ff12]/20 relative overflow-hidden group shadow-2xl">
          <div className="absolute inset-0 bg-[#a3ff12]/5 pointer-events-none" />
          <p className="text-[#a3ff12] font-black text-[10px] uppercase tracking-widest mb-4">Mensalidade Atual</p>
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3ff12] font-black text-xs">R$</span>
               <input 
                type="number" 
                step="0.01" 
                value={newFee} 
                onChange={(e) => setNewFee(e.target.value)}
                className="w-full bg-black/40 border border-[#a3ff12]/20 rounded-xl py-3 pl-8 pr-3 text-white font-black text-xl outline-none focus:border-[#a3ff12] transition-all"
               />
            </div>
            <button 
              onClick={handleUpdateFee}
              disabled={updatingFee || newFee === stats?.monthlyFee}
              className="p-3.5 bg-[#a3ff12] text-black rounded-xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
            >
              {updatingFee ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
            </button>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-2 h-6 bg-[#a3ff12] rounded-full shadow-[0_0_10px_rgba(163,255,18,0.5)]" /> Lista de Usuários
          </h3>
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{users.length} Registrados</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {users.map((u) => (
            <div key={u.id} className="group p-6 rounded-[2rem] bg-[#15151A] border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-inner ${u.role === 'admin' ? 'bg-[#a3ff12]/10 text-[#a3ff12] border border-[#a3ff12]/20' : 'bg-white/5 text-zinc-500'}`}>
                  {u.role === 'admin' ? <ShieldCheck size={28}/> : <Users size={28}/>}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h4 className="text-xl font-black text-white tracking-tight">{u.display_name || 'Sem nome'}</h4>
                    {u.is_pro && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[#FFD700]/10 text-[#FFD700] text-[8px] font-black uppercase rounded-md border border-[#FFD700]/20 tracking-tighter">
                        <Star size={8} fill="currentColor"/> PRO
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-zinc-500">{u.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-8 md:text-right">
                <div>
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Cadastro em</p>
                  <p className="text-sm font-bold text-zinc-400">{new Date(u.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Nível</p>
                  <p className={`text-sm font-bold ${u.role === 'admin' ? 'text-[#a3ff12]' : 'text-zinc-400'} uppercase`}>{u.role}</p>
                </div>
                <button className="p-3 rounded-xl bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all"><ArrowRight size={20}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cupons List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-2 h-6 bg-[#FF2D55] rounded-full shadow-[0_0_10px_rgba(255,45,85,0.5)]" /> Cupons de Desconto
          </h3>
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{cupons.length} Ativos</span>
        </div>

        {/* Create Cupom Form */}
        <form onSubmit={handleCreateCupom} className="p-6 rounded-[2rem] bg-[#15151A] border border-white/5 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Código do Cupom</label>
            <input required value={newCupom.codigo} onChange={e => setNewCupom({...newCupom, codigo: e.target.value.replace(/\\s/g, '').toUpperCase()})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white uppercase focus:border-[#FF2D55] outline-none transition-all" placeholder="Ex: LYONK100"/>
          </div>
          <div className="flex-1 w-full">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">% de Desconto</label>
            <input required type="number" min="1" max="100" value={newCupom.desconto} onChange={e => setNewCupom({...newCupom, desconto: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#FF2D55] outline-none transition-all" placeholder="Ex: 100"/>
          </div>
          <div className="flex-1 w-full">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Limite de Usos (Opcional)</label>
            <input type="number" min="1" value={newCupom.max_usos} onChange={e => setNewCupom({...newCupom, max_usos: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#FF2D55] outline-none transition-all" placeholder="Ilimitado"/>
          </div>
          <button type="submit" disabled={creatingCupom} className="w-full md:w-auto h-[50px] px-8 bg-[#FF2D55] text-white font-black rounded-xl hover:scale-105 transition-all flex items-center justify-center gap-2">
            {creatingCupom ? <Loader2 className="animate-spin" size={20}/> : <><Plus size={20}/> CRIAR</>}
          </button>
        </form>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cupons.map((c) => (
            <div key={c.id} className="p-6 rounded-[2rem] bg-[#15151A] border border-white/5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#FF2D55]/10 text-[#FF2D55] flex items-center justify-center">
                  <Ticket size={24}/>
                </div>
                <div>
                  <h4 className="text-xl font-black text-white uppercase tracking-tight">{c.codigo}</h4>
                  <p className="text-sm font-bold text-[#FF2D55]">{c.desconto_percentual}% OFF</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Usos</p>
                  <p className="text-sm font-bold text-white">{c.usos_atuais} / {c.max_usos || '∞'}</p>
                </div>
                <button onClick={() => handleDeleteCupom(c.id)} className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 hover:bg-red-500/20 hover:text-red-500 flex items-center justify-center transition-all">
                  <Trash2 size={18}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modulos List */}
      <div className="space-y-6 pb-8">
        <div className="flex items-center justify-between px-4">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-2 h-6 bg-[#3B82F6] rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" /> Ferramentas Adicionais
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/admin/compras" className="p-8 rounded-[2.5rem] bg-[#15151A] border border-white/5 relative overflow-hidden group hover:border-[#3B82F6]/30 transition-all flex items-center justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#3B82F6]/5 blur-3xl group-hover:bg-[#3B82F6]/10 transition-all" />
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShoppingCart size={32} />
              </div>
              <div>
                <h4 className="text-2xl font-black text-white">Lista de Compras</h4>
                <p className="text-sm font-bold text-zinc-500">Gerenciar compras e prioridades</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-hover:bg-[#3B82F6]/20 group-hover:text-[#3B82F6] transition-all relative z-10">
              <ArrowRight size={20} />
            </div>
          </Link>

          <Link to="/admin/lembretes" className="p-8 rounded-[2.5rem] bg-[#15151A] border border-white/5 relative overflow-hidden group hover:border-[#8B5CF6]/30 transition-all flex items-center justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#8B5CF6]/5 blur-3xl group-hover:bg-[#8B5CF6]/10 transition-all" />
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Bell size={32} />
              </div>
              <div>
                <h4 className="text-2xl font-black text-white">Lembretes</h4>
                <p className="text-sm font-bold text-zinc-500">Avisos e alertas agendados</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-hover:bg-[#8B5CF6]/20 group-hover:text-[#8B5CF6] transition-all relative z-10">
              <ArrowRight size={20} />
            </div>
          </Link>
        </div>
      </div>

    </div>
  );
}
