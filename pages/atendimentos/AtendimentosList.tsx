import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Edit, Plus } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button, Input, Select, Card } from '../../components/ui/Components';
import { useDataStore } from '../../lib/DataStore';
import { Atendimento } from '../../types';

export const AtendimentosList: React.FC = () => {
  const navigate = useNavigate();
  const { atendimentos } = useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const filteredAtendimentos = atendimentos.filter((atd: Atendimento) => {
    const matchesSearch = 
      atd.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      atd.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (atd.deceasedName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesStatus = !statusFilter || atd.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Atendimentos" 
        subtitle="Gestão de serviços funerários"
        actionButton={
          <Button onClick={() => navigate('/atendimentos/novo')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Atendimento
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total</p>
          <p className="text-2xl font-bold text-gray-900">{atendimentos.length}</p>
        </Card>
        <Card className="p-4 text-center border-b-2 border-b-blue-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Em Andamento</p>
          <p className="text-2xl font-bold text-blue-600">
            {atendimentos.filter((a) => a.status === 'em_andamento').length}
          </p>
        </Card>
        <Card className="p-4 text-center border-b-2 border-b-green-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Concluídos</p>
          <p className="text-2xl font-bold text-green-600">
            {atendimentos.filter((a) => a.status === 'concluido').length}
          </p>
        </Card>
        <Card className="p-4 text-center border-b-2 border-b-yellow-500">
          <p className="text-xs text-gray-500 uppercase font-semibold">Aguardando</p>
          <p className="text-2xl font-bold text-yellow-600">
            {atendimentos.filter((a) => a.status === 'aguardando').length}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Buscar por código, cliente, falecido..." 
            className="pl-9" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Status: Todos</option>
            <option value="aguardando">Aguardando</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluido">Concluído</option>
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
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Falecido</th>
                <th className="px-6 py-4">Data Serviço</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Valor Total</th>
                <th className="px-6 py-4">Pago</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAtendimentos.map((atendimento) => (
                <tr key={atendimento.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono font-semibold text-gray-900">
                      {atendimento.codigo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{atendimento.clientName}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {atendimento.deceasedName || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {new Date(atendimento.serviceDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={atendimento.status} />
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {formatCurrency(atendimento.totalValue)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-green-600">
                        {formatCurrency(atendimento.paidValue)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {atendimento.totalValue > 0
                          ? ((atendimento.paidValue / atendimento.totalValue) * 100).toFixed(0)
                          : 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate(`/atendimentos/${atendimento.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/atendimentos/${atendimento.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredAtendimentos.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            Nenhum atendimento encontrado
          </div>
        )}
      </div>
    </div>
  );
};
