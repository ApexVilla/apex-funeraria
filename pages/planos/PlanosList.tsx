import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ClipboardList } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button, Input, Select, Card } from '../../components/ui/Components';
import { useDataStore } from '../../lib/DataStore';

export const PlanosList: React.FC = () => {
  const navigate = useNavigate();
  const { planos } = useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('');
  
  const filteredPlanos = planos.filter((p) => {
    const matchSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchCategoria = !categoriaFilter || p.categoria === categoriaFilter;
    return matchSearch && matchStatus && matchCategoria;
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Planos" 
        subtitle="Gerencie os planos oferecidos pela empresa"
        actionButton={<Button onClick={() => navigate('/planos/novo')}>+ Novo Plano</Button>}
      />

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-lg shadow-sm border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Buscar plano..." 
            className="pl-9" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Status: Todos</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </Select>
        </div>
        <div className="w-full md:w-48">
          <Select value={categoriaFilter} onChange={(e) => setCategoriaFilter(e.target.value)}>
            <option value="">Categoria: Todas</option>
            <option value="individual">Individual</option>
            <option value="familiar">Familiar</option>
            <option value="empresarial">Empresarial</option>
          </Select>
        </div>
      </div>

      {/* Grid */}
      {filteredPlanos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlanos.map((plano) => (
            <Card key={plano.id} className="overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{plano.nome}</h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">{plano.codigo}</p>
                </div>
                <StatusBadge status={plano.status} />
              </div>
              
              <div className="p-4 flex-1">
                <div className="mb-4">
                  <span className="text-2xl font-bold text-blue-600">
                    R$ {plano.valorMensal.toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">/mês</span>
                  {plano.valorAnual && (
                    <p className="text-xs text-gray-500 mt-1">
                      ou R$ {plano.valorAnual.toFixed(2)}/ano
                    </p>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 line-clamp-2 mb-4 h-10">
                  {plano.descricao}
                </p>
                
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-dashed">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Clientes</p>
                    <p className="font-semibold text-gray-900">{plano.clientesAtivos || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Categoria</p>
                    <p className="font-semibold text-gray-900 capitalize">{plano.categoria}</p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 border-t flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/planos/${plano.id}`)}>
                  Detalhes
                </Button>
                <Button variant="primary" size="sm" className="flex-1" onClick={() => navigate(`/clientes/novo?planoId=${plano.id}`)}>
                  Vender
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Nenhum plano encontrado</h3>
          <p className="text-gray-500 mt-1 max-w-sm mx-auto">
            Não encontramos planos com os filtros selecionados. Tente limpar a busca ou criar um novo.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => setSearchTerm('')}>
            Limpar Filtros
          </Button>
        </div>
      )}
    </div>
  );
};