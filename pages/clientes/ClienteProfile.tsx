import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Phone, Mail, CreditCard, Shield, Users } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button, Card, Badge } from '../../components/ui/Components';
import { useDataStore } from '../../lib/DataStore';

export const ClienteProfile: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getCliente } = useDataStore();
  const cliente = id ? getCliente(id) : undefined;
  const [activeTab, setActiveTab] = useState<'geral' | 'beneficiarios' | 'financeiro'>('geral');

  return (
    <div className="space-y-6 pb-12">
      {/* Header Profile */}
      <div className="bg-white rounded-lg border shadow-sm p-6 flex flex-col md:flex-row gap-6 items-start">
        <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-3xl font-bold text-blue-600 border-4 border-white shadow-sm">
          {cliente.nome.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{cliente.nome}</h1>
            <StatusBadge status={cliente.statusAssinatura} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1"><User className="h-4 w-4" /> {cliente.cpf}</span>
            <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {cliente.email}</span>
            <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {cliente.telefone}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/clientes/${cliente.id}/editar`)}>Editar</Button>
          <Button>Adicionar Beneficiário</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {['geral', 'beneficiarios', 'financeiro'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm capitalize
                ${activeTab === tab 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab === 'geral' ? 'Visão Geral' : tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Info Card */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-gray-400" />
                Dados Pessoais
              </h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Data de Nascimento</dt>
                  <dd className="font-medium">{new Date(cliente.dataNascimento).toLocaleDateString('pt-BR')}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Endereço</dt>
                  <dd className="font-medium">
                    {cliente.endereco.logradouro}, {cliente.endereco.numero}
                    <br />
                    {cliente.endereco.bairro} - {cliente.endereco.cidade}/{cliente.endereco.estado}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Plan Info */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-gray-400" />
                Plano Contratado
              </h3>
              <div className="bg-blue-50 p-3 rounded-md mb-4 border border-blue-100">
                <p className="font-bold text-blue-900">{cliente.planoNome ?? 'Sem plano'}</p>
                <p className="text-sm text-blue-700">R$ {cliente.valorMensal?.toFixed(2) ?? '0,00'} / mês</p>
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Vencimento</dt>
                  <dd className="font-medium">Todo dia {cliente.diaVencimento ?? '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Forma de Pag.</dt>
                  <dd className="font-medium">{cliente.formaPagamento ?? '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Contratado em</dt>
                  <dd className="font-medium">{cliente.dataContratacao ? new Date(cliente.dataContratacao).toLocaleDateString('pt-BR') : '-'}</dd>
                </div>
              </dl>
            </Card>

            {/* Financial Summary */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gray-400" />
                Financeiro
              </h3>
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-1">Próxima Fatura</p>
                <p className="text-3xl font-bold text-gray-900">R$ {cliente.valorMensal?.toFixed(2) ?? '0,00'}</p>
                <p className="text-sm font-medium text-orange-600 mt-2">
                  {cliente.proximoVencimento ? `Vence em ${new Date(cliente.proximoVencimento).toLocaleDateString('pt-BR')}` : 'Sem vencimento'}
                </p>
              </div>
              <Button className="w-full" variant="outline">Registrar Pagamento</Button>
            </Card>
          </div>
        )}

        {activeTab === 'beneficiarios' && (
           <Card className="p-12 text-center text-gray-500">
             <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
             <p>Funcionalidade de beneficiários em desenvolvimento.</p>
             <Button variant="outline" className="mt-4">Adicionar Novo</Button>
           </Card>
        )}

        {activeTab === 'financeiro' && (
           <Card className="overflow-hidden">
             <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 text-gray-600">
                 <tr>
                   <th className="px-6 py-3">Competência</th>
                   <th className="px-6 py-3">Vencimento</th>
                   <th className="px-6 py-3">Valor</th>
                   <th className="px-6 py-3">Status</th>
                   <th className="px-6 py-3"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {[1, 2, 3].map(i => (
                   <tr key={i}>
                     <td className="px-6 py-4">Jun/2023</td>
                     <td className="px-6 py-4">10/06/2023</td>
                     <td className="px-6 py-4">R$ {cliente.valorMensal?.toFixed(2) ?? '0,00'}</td>
                     <td className="px-6 py-4"><Badge variant="success">Pago</Badge></td>
                     <td className="px-6 py-4 text-right"><Button size="sm" variant="ghost">Recibo</Button></td>
                   </tr>
                 ))}
                 <tr>
                    <td className="px-6 py-4">Jul/2023</td>
                    <td className="px-6 py-4">10/07/2023</td>
                    <td className="px-6 py-4">R$ {cliente.valorMensal.toFixed(2)}</td>
                    <td className="px-6 py-4"><Badge variant="warning">Pendente</Badge></td>
                    <td className="px-6 py-4 text-right"><Button size="sm" variant="outline">Pagar</Button></td>
                 </tr>
               </tbody>
             </table>
           </Card>
        )}
      </div>
    </div>
  );
};