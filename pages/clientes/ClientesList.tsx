import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Edit } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button, Input, Select, Card } from '../../components/ui/Components';
import { useDataStore } from '../../lib/DataStore';

export const ClientesList: React.FC = () => {
  const navigate = useNavigate();
  const { clientes } = useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const filteredClientes = clientes.filter((c) => {
    const matchSearch =
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cpf.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''));
    const matchStatus = !statusFilter || c.statusAssinatura === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: clientes.length,
    ativos: clientes.filter((c) => c.statusAssinatura === 'ativo').length,
    inadimplentes: clientes.filter((c) => c.statusAssinatura === 'inadimplente').length,
    suspensos: clientes.filter((c) => c.statusAssinatura === 'suspenso').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Clientes" 
        subtitle="Base de clientes e assinaturas"
        actionButton={<Button onClick={() => navigate('/clientes/novo')}>+ Novo Cliente</Button>}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </Card>
        <Card className="p-4 text-center border-b-2 border-b-green-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Ativos</p>
          <p className="text-2xl font-bold text-green-600">{stats.ativos}</p>
        </Card>
        <Card className="p-4 text-center border-b-2 border-b-red-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Inadimplentes</p>
          <p className="text-2xl font-bold text-red-600">{stats.inadimplentes}</p>
        </Card>
        <Card className="p-4 text-center border-b-2 border-b-yellow-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Suspensos</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.suspensos}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Buscar por nome, CPF..." 
            className="pl-9" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Status: Todos</option>
            <option value="ativo">Ativo</option>
            <option value="inadimplente">Inadimplente</option>
            <option value="suspenso">Suspenso</option>
            <option value="cancelado">Cancelado</option>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b">
              <tr>
                <th className="px-6 py-4">Nome / CPF</th>
                <th className="px-6 py-4">Plano</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Próx. Vencimento</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClientes.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                        {cliente.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{cliente.nome}</p>
                        <p className="text-xs text-gray-500 font-mono">{cliente.cpf}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {cliente.planoNome}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={cliente.statusAssinatura} />
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {cliente.proximoVencimento
                      ? new Date(cliente.proximoVencimento).toLocaleDateString('pt-BR')
                      : '-'}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {cliente.valorMensal != null ? `R$ ${cliente.valorMensal.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/clientes/${cliente.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/clientes/${cliente.id}/editar`)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination placeholder */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>Mostrando 1 a {filteredClientes.length} de {filteredClientes.length} resultados</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" disabled>Próximo</Button>
          </div>
        </div>
      </div>
    </div>
  );
};