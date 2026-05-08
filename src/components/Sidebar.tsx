import { LayoutDashboard, Receipt, Wallet, Settings, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();

  const links = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Receitas', path: '/receitas', icon: Wallet },
    { name: 'Despesas', path: '/despesas', icon: Receipt },
    { name: 'Configurações', path: '/config', icon: Settings },
  ];

  return (
    <aside className="w-64 glass border-r border-white/5 flex flex-col hidden md:flex">
      <div className="p-8 flex items-center gap-3">
        {/* Placeholder para a logo do Leão */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-yellow-600 flex items-center justify-center font-bold text-background text-xl shadow-lg">
          L
        </div>
        <span className="font-bold text-xl tracking-tight">Lyonpay</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.name}
              to={link.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-white/5'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-primary' : ''} />
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <button className="flex items-center gap-3 px-4 py-3 w-full text-left text-textSecondary hover:text-accentRed hover:bg-accentRed/10 rounded-lg transition-colors">
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </aside>
  );
}
