import { Bell, ArrowLeft, Construction } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminLembretes() {
  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-1000 pb-20 px-4 md:px-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-10">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-zinc-400 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <div className="w-12 h-12 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center border border-[#8B5CF6]/20 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
            <Bell size={24} className="text-[#8B5CF6]" />
          </div>
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter">Lembretes</h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Avisos e Alertas</p>
          </div>
        </div>
      </header>

      <div className="p-16 text-center rounded-[2.5rem] bg-[#15151A] border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B5CF6]/5 blur-[100px] pointer-events-none" />
        <Construction className="mx-auto text-[#8B5CF6] mb-6 opacity-80" size={64} />
        <h2 className="text-3xl font-black text-white mb-2">Em Construção</h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          O módulo de lembretes está sendo desenvolvido e estará disponível em breve.
        </p>
      </div>
    </div>
  );
}
