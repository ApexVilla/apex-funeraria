import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  HandHeart,
  DollarSign, 
  BarChart, 
  Settings, 
  LogOut,
  ShieldCheck
} from 'lucide-react';

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: ClipboardList, label: 'Planos', path: '/planos' },
    { icon: Users, label: 'Clientes', path: '/clientes' },
    { icon: HandHeart, label: 'Atendimentos', path: '/atendimentos' },
    { icon: DollarSign, label: 'Financeiro', path: '/financeiro' },
    { icon: BarChart, label: 'Relatórios', path: '/relatorios' },
    { icon: Settings, label: 'Configurações', path: '/config' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden" 
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-[280px] bg-[#1e293b] text-white transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-700">
          <ShieldCheck className="h-8 w-8 text-blue-500" />
          <span className="text-lg font-bold">Sistema de Planos</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => window.innerWidth < 768 && onClose()}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-md transition-colors
                ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}
              `}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-[#1e293b]">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center font-bold">
              A
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">Admin</p>
              <p className="text-xs text-gray-400 truncate">admin@sistema.com</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm text-gray-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
};