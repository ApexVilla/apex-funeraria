import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PlanosList } from './pages/planos/PlanosList';
import { PlanoForm } from './pages/planos/PlanoForm';
import { ClientesList } from './pages/clientes/ClientesList';
import { ClienteForm } from './pages/clientes/ClienteForm';
import { ClienteProfile } from './pages/clientes/ClienteProfile';
import { AtendimentosList } from './pages/atendimentos/AtendimentosList';
import { AtendimentoForm } from './pages/atendimentos/AtendimentoForm';
import { DataStoreProvider } from './lib/DataStore';

/** Protege rotas que exigem autenticação */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  const location = useLocation();
  if (!token) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <DataStoreProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          
          <Route element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Planos */}
            <Route path="/planos" element={<PlanosList />} />
            <Route path="/planos/novo" element={<PlanoForm />} />
            <Route path="/planos/:id" element={<PlanoForm />} />
            
            {/* Clientes */}
            <Route path="/clientes" element={<ClientesList />} />
            <Route path="/clientes/novo" element={<ClienteForm />} />
            <Route path="/clientes/:id/editar" element={<ClienteForm />} />
            <Route path="/clientes/:id" element={<ClienteProfile />} />
            
            {/* Atendimentos */}
            <Route path="/atendimentos" element={<AtendimentosList />} />
            <Route path="/atendimentos/novo" element={<AtendimentoForm />} />
            <Route path="/atendimentos/:id" element={<AtendimentoForm />} />
            
            {/* Módulos futuros */}
            <Route path="/financeiro" element={<div className="p-8 text-center text-gray-500">Módulo Financeiro em Breve</div>} />
            <Route path="/relatorios" element={<div className="p-8 text-center text-gray-500">Módulo de Relatórios em Breve</div>} />
            <Route path="/config" element={<div className="p-8 text-center text-gray-500">Configurações em Breve</div>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DataStoreProvider>
    </HashRouter>
  );
};

export default App;