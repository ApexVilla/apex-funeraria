import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Button, Input, Select, Card } from '../../components/ui/Components';
import { useDataStore } from '../../lib/DataStore';
import type { Cliente } from '../../types';

const emptyEndereco = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: 'SP',
};

const emptyForm = {
  nome: '',
  cpf: '',
  dataNascimento: '',
  email: '',
  telefone: '',
  endereco: emptyEndereco,
  planoId: '',
  diaVencimento: '10',
  formaPagamento: 'Cartão de Crédito' as Cliente['formaPagamento'],
  periodicidade: 'mensal' as Cliente['periodicidade'],
};

export const ClienteForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const planoIdFromUrl = searchParams.get('planoId');
  const { planos, addCliente, updateCliente, getCliente } = useDataStore();
  const isEditRoute = !!id;
  const clienteId = id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const cliente = clienteId ? getCliente(clienteId) : undefined;
  const selectedPlano = formData.planoId ? planos.find((p) => p.id === formData.planoId) : undefined;

  useEffect(() => {
    if (cliente && isEditRoute) {
      setFormData({
        nome: cliente.nome,
        cpf: cliente.cpf,
        dataNascimento: cliente.dataNascimento,
        email: cliente.email,
        telefone: cliente.telefone,
        endereco: { ...emptyEndereco, ...cliente.endereco },
        planoId: cliente.planoId ?? '',
        diaVencimento: String(cliente.diaVencimento ?? 10),
        formaPagamento: cliente.formaPagamento ?? 'Cartão de Crédito',
        periodicidade: cliente.periodicidade ?? 'mensal',
      });
    } else if (planoIdFromUrl && !cliente) {
      setFormData((prev) => ({ ...prev, planoId: planoIdFromUrl }));
    }
  }, [cliente, planoIdFromUrl, isEditRoute]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const valorMensal = selectedPlano?.valorMensal ?? 0;
    const dataContratacao = new Date().toISOString().split('T')[0];
    const diaVenc = parseInt(formData.diaVencimento, 10) || 10;
    const proximoVenc = new Date();
    proximoVenc.setDate(diaVenc);
    if (proximoVenc <= new Date()) {
      proximoVenc.setMonth(proximoVenc.getMonth() + 1);
    }

    const payload = {
      nome: formData.nome,
      cpf: formData.cpf,
      rg: undefined,
      email: formData.email,
      telefone: formData.telefone,
      dataNascimento: formData.dataNascimento,
      endereco: {
        cep: formData.endereco.cep,
        logradouro: formData.endereco.logradouro,
        numero: formData.endereco.numero,
        complemento: formData.endereco.complemento || undefined,
        bairro: formData.endereco.bairro,
        cidade: formData.endereco.cidade,
        estado: formData.endereco.estado,
      },
      planoId: formData.planoId || undefined,
      planoNome: selectedPlano?.nome,
      statusAssinatura: formData.planoId ? ('ativo' as const) : undefined,
      valorMensal: formData.planoId ? valorMensal : undefined,
      periodicidade: formData.planoId ? formData.periodicidade : undefined,
      diaVencimento: formData.planoId ? diaVenc : undefined,
      formaPagamento: formData.planoId ? formData.formaPagamento : undefined,
      dataContratacao: formData.planoId ? dataContratacao : undefined,
      proximoVencimento: formData.planoId ? proximoVenc.toISOString().split('T')[0] : undefined,
    };

    if (clienteId && isEditRoute) {
      updateCliente(clienteId, payload);
      setLoading(false);
      navigate(`/clientes/${clienteId}`);
    } else {
      const novo = addCliente(payload);
      setLoading(false);
      navigate(`/clientes/${novo.id}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('endereco.')) {
      const field = name.split('.')[1] as keyof typeof emptyEndereco;
      setFormData((prev) => ({
        ...prev,
        endereco: { ...prev.endereco, [field]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const formatCpf = (v: string) => {
    const n = v.replace(/\D/g, '');
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatPhone = (v: string) => {
    const n = v.replace(/\D/g, '');
    if (n.length <= 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const formatCep = (v: string) => {
    return v.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <PageHeader title={isEditRoute ? 'Editar Cliente' : 'Novo Cliente'} />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">Dados Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Nome Completo *"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  placeholder="Nome do cliente"
                  required
                />
              </div>
              <Input
                label="CPF *"
                name="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData((p) => ({ ...p, cpf: formatCpf(e.target.value) }))}
                placeholder="000.000.000-00"
                required
              />
              <Input
                label="Data de Nascimento *"
                name="dataNascimento"
                type="date"
                value={formData.dataNascimento}
                onChange={handleChange}
                required
              />
              <Input
                label="Email *"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="email@exemplo.com"
                required
              />
              <Input
                label="Telefone *"
                name="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData((p) => ({ ...p, telefone: formatPhone(e.target.value) }))}
                placeholder="(00) 00000-0000"
                required
              />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="CEP *"
                  name="endereco.cep"
                  value={formData.endereco.cep}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      endereco: { ...p.endereco, cep: formatCep(e.target.value) },
                    }))
                  }
                  placeholder="00000-000"
                  required
                />
              </div>
              <div className="md:col-span-4">
                <Input
                  label="Logradouro *"
                  name="endereco.logradouro"
                  value={formData.endereco.logradouro}
                  onChange={handleChange}
                  placeholder="Rua, Av..."
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Número *"
                  name="endereco.numero"
                  value={formData.endereco.numero}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="md:col-span-4">
                <Input
                  label="Complemento"
                  name="endereco.complemento"
                  value={formData.endereco.complemento}
                  onChange={handleChange}
                />
              </div>
              <div className="md:col-span-3">
                <Input
                  label="Bairro *"
                  name="endereco.bairro"
                  value={formData.endereco.bairro}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Cidade *"
                  name="endereco.cidade"
                  value={formData.endereco.cidade}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="md:col-span-1">
                <Select
                  label="UF *"
                  name="endereco.estado"
                  value={formData.endereco.estado}
                  onChange={handleChange}
                >
                  <option value="SP">SP</option>
                  <option value="RJ">RJ</option>
                  <option value="MG">MG</option>
                  <option value="ES">ES</option>
                  <option value="BA">BA</option>
                  <option value="PR">PR</option>
                  <option value="SC">SC</option>
                  <option value="RS">RS</option>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">Dados do Plano</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Select
                  label="Plano"
                  name="planoId"
                  value={formData.planoId}
                  onChange={handleChange}
                >
                  <option value="">Sem plano</option>
                  {planos.filter((p) => p.status === 'ativo').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} - R$ {p.valorMensal.toFixed(2)}/mês
                    </option>
                  ))}
                </Select>
              </div>
              {formData.planoId && (
                <>
                  <Select
                    label="Dia de Vencimento *"
                    name="diaVencimento"
                    value={formData.diaVencimento}
                    onChange={handleChange}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="15">15</option>
                    <option value="20">20</option>
                    <option value="25">25</option>
                  </Select>
                  <Select
                    label="Forma de Pagamento *"
                    name="formaPagamento"
                    value={formData.formaPagamento}
                    onChange={handleChange}
                  >
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Débito Automático">Débito Automático</option>
                    <option value="Boleto">Boleto</option>
                    <option value="PIX">PIX</option>
                  </Select>
                </>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 bg-blue-50 border-blue-100 sticky top-24">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Resumo da Adesão</h3>
            <div className="space-y-3 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Plano:</span>
                <span className="font-medium">{selectedPlano?.nome ?? '--'}</span>
              </div>
              <div className="flex justify-between">
                <span>Valor Mensal:</span>
                <span className="font-medium">
                  {selectedPlano ? `R$ ${selectedPlano.valorMensal.toFixed(2)}` : 'R$ 0,00'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Vencimento:</span>
                <span className="font-medium">Dia {formData.diaVencimento || '--'}</span>
              </div>
              <div className="pt-3 mt-3 border-t border-blue-200">
                <p className="text-xs mb-1">Primeira Cobrança (Estimada)</p>
                <p className="font-bold text-lg">
                  {selectedPlano ? `R$ ${selectedPlano.valorMensal.toFixed(2)}` : 'R$ 0,00'}
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <Button type="submit" className="w-full" loading={loading}>
                {isEditRoute ? 'Salvar Alterações' : 'Confirmar Cadastro'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white"
                onClick={() => navigate('/clientes')}
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
};
