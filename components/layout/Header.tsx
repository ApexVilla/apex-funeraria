import React from 'react';
import { Menu, Search, Bell, ChevronDown } from 'lucide-react';
import { Input, Button } from '../ui/Components';

export const Header: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
  return (
    <header className="fixed top-0 right-0 z-30 flex h-16 w-full items-center justify-between border-b bg-white px-4 md:pl-[296px] md:pr-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-md"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        {/* Breadcrumb placeholder */}
        <div className="hidden md:block text-sm text-gray-500">
          <span className="font-medium text-gray-900">Sistema</span> / Dashboard
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        {/* Global Search */}
        <div className="hidden md:block w-64 lg:w-80">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Buscar..." 
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border border-white"></span>
          </button>
          
          <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
          
          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded-md">
             <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
              A
            </div>
            <ChevronDown className="h-4 w-4 text-gray-500 hidden sm:block" />
          </div>
        </div>
      </div>
    </header>
  );
};