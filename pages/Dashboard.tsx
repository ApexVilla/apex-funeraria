import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, DollarSign, AlertTriangle, Users, ArrowUpRight } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/ui/Components';
import { useDataStore } from '../lib/DataStore';

export const Dashboard: React.FC = () => {
  const { planos, clientes, atendimentos } = useDataStore();
  const planosAtivos = planos.filter((p) => p.status === 'ativo').length;
  const clientesAtivos = clientes.filter((c) => c.statusAssinatura === 'ativo').length;
  const inadimplentes = clientes.filter((c) => c.statusAssinatura === 'inadimplente').length;

  const stats = [
    {
      label: 'Planos Ativos',
      value: '1.247',
      change: '+45 este mês',
      icon: ClipboardList,
      color: 'blue'
    },
    {
      label: 'Receita Mensal',
      value: 'R$ 156.780,00',
      change: '+12% vs mês anterior',
      icon: DollarSign,
      color: 'green'
    },
    {
      label: 'Inadimplentes',
      value: '23',
      change: 'R$ 3.450,00 pendente',
      icon: AlertTriangle,
      color: 'red'
    },
    {
      label: 'Novos este Mês',
      value: '45',
      change: '+8 vs mês anterior',
      icon: Users,
      color: 'purple'
    }
  ];

  const recentClientes = clientes
    .slice(0, 5)
    .map((c) => ({
      client: c.nome,
      plan: c.planoNome ?? 'Sem plano',
      value: c.valorMensal ? `R$ ${c.valorMensal.toFixed(2)}` : '-',
      time: c.criadoEm ? new Date(c.criadoEm).toLocaleDateString('pt-BR') : '-',
    }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Visão geral do seu negócio" />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const colorClasses = {
            blue: 'bg-blue-100 text-blue-600',
            green: 'bg-green-100 text-green-600',
            red: 'bg-red-100 text-red-600',
            purple: 'bg-purple-100 text-purple-600',
          };

          return (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  <p className={`text-xs mt-2 font-medium ${stat.color === 'red' ? 'text-red-600' : 'text-green-600'}`}>
                    {stat.change}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Novos Planos Vendidos</h3>
          <div className="space-y-4">
            {recentClientes.length > 0 ? (
              recentClientes.map((sale, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                      {sale.client.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{sale.client}</p>
                      <p className="text-xs text-gray-500">{sale.plan}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{sale.value}</p>
                    <p className="text-xs text-gray-500">{sale.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm py-4">Nenhum cliente cadastrado ainda.</p>
            )}
          </div>
          <Link to="/clientes" className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1">
            Ver todos os clientes <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Card>

        {/* Placeholder for Chart or another widget */}
        <Card className="p-6 flex flex-col items-center justify-center text-center min-h-[300px]">
          <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <ClipboardList className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Relatório Rápido</h3>
          <p className="text-gray-500 max-w-xs mt-2">
            Gráficos detalhados de adesão e cancelamento estarão disponíveis no próximo update.
          </p>
        </Card>
      </div>
    </div>
  );
};