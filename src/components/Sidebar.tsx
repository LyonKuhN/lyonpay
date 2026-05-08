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
      <div className="p-8 flex items-center justify-center">
        <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain drop-shadow-lg" />
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
