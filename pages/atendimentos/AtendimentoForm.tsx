import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Button, Input, Select, Card, Textarea } from '../../components/ui/Components';
import { useDataStore } from '../../lib/DataStore';
import type { AtendimentoService, AtendimentoProduct } from '../../types';

export const AtendimentoForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { clientes, falecidos, services, products, addAtendimento, updateAtendimento, getAtendimento } =
    useDataStore();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    deceasedId: '',
    serviceDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [selectedServices, setSelectedServices] = useState<Array<{ serviceId: string; quantity: number }>>([]);
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: string; quantity: number }>>([]);

  const atendimento = id ? getAtendimento(id) : undefined;

  useEffect(() => {
    if (atendimento) {
      setFormData({
        clientId: atendimento.clientId,
        deceasedId: atendimento.deceasedId ?? '',
        serviceDate: atendimento.serviceDate,
        notes: atendimento.notes ?? '',
      });
      setSelectedServices(
        atendimento.services.map((s) => ({
          serviceId: s.serviceId,
          quantity: s.quantity,
        }))
      );
      setSelectedProducts(
        atendimento.products.map((p) => ({
          productId: p.productId,
          quantity: p.quantity,
        }))
      );
    }
  }, [atendimento]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId) return;

    const validServices = selectedServices.filter((s) => s.serviceId);
    const validProducts = selectedProducts.filter((p) => p.productId);
    if (validServices.length === 0 && validProducts.length === 0) {
      alert('Adicione pelo menos um serviço ou produto.');
      return;
    }

    setLoading(true);

    if (isEdit && id) {
      const client = clientes.find((c) => c.id === formData.clientId);
      const deceased = formData.deceasedId
        ? falecidos.find((f) => f.id === formData.deceasedId)
        : undefined;

      const newServices: AtendimentoService[] = validServices.map((s) => {
        const svc = services.find((x) => x.id === s.serviceId);
        const unitPrice = svc?.basePrice ?? 0;
        return {
          id: `svc-${Date.now()}-${s.serviceId}`,
          attendanceId: id,
          serviceId: s.serviceId,
          serviceName: svc?.name ?? '',
          quantity: s.quantity,
          unitPrice,
          subtotal: unitPrice * s.quantity,
        };
      });
      const newProducts: AtendimentoProduct[] = validProducts.map((p) => {
        const prod = products.find((x) => x.id === p.productId);
        const unitPrice = prod?.price ?? 0;
        return {
          id: `prod-${Date.now()}-${p.productId}`,
          attendanceId: id,
          productId: p.productId,
          productName: prod?.name ?? '',
          quantity: p.quantity,
          unitPrice,
          subtotal: unitPrice * p.quantity,
        };
      });
      const totalValue =
        newServices.reduce((s, x) => s + x.subtotal, 0) + newProducts.reduce((s, x) => s + x.subtotal, 0);

      updateAtendimento(id, {
        clientId: formData.clientId,
        clientName: client?.nome ?? '',
        deceasedId: formData.deceasedId || undefined,
        deceasedName: deceased?.nome,
        serviceDate: formData.serviceDate,
        notes: formData.notes,
        services: newServices,
        products: newProducts,
        totalValue,
      });
      setLoading(false);
      navigate('/atendimentos');
    } else {
      addAtendimento({
        clientId: formData.clientId,
        deceasedId: formData.deceasedId || undefined,
        serviceDate: formData.serviceDate,
        notes: formData.notes,
        services: validServices,
        products: validProducts,
      });
      setLoading(false);
      navigate('/atendimentos');
    }
  };

  const addService = () => {
    setSelectedServices([...selectedServices, { serviceId: '', quantity: 1 }]);
  };
  const removeService = (index: number) => {
    setSelectedServices(selectedServices.filter((_, i) => i !== index));
  };
  const addProduct = () => {
    setSelectedProducts([...selectedProducts, { productId: '', quantity: 1 }]);
  };
  const removeProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    let total = 0;
    selectedServices.forEach((item) => {
      const service = services.find((s) => s.id === item.serviceId);
      if (service) total += service.basePrice * item.quantity;
    });
    selectedProducts.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product) total += product.price * item.quantity;
    });
    return total;
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  if (isEdit && id && !atendimento) {
    return (
      <div className="p-8 text-center text-gray-500">
        Atendimento não encontrado.{' '}
        <Button variant="outline" onClick={() => navigate('/atendimentos')}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? 'Editar Atendimento' : 'Novo Atendimento'}
        subtitle={isEdit ? 'Atualize as informações do atendimento' : 'Crie um novo atendimento funerário'}
        actionButton={
          <Button variant="outline" onClick={() => navigate('/atendimentos')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Informações Básicas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Cliente *"
                  required
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value, deceasedId: '' })}
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome} - {cliente.cpf}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Falecido"
                  value={formData.deceasedId}
                  onChange={(e) => setFormData({ ...formData, deceasedId: e.target.value })}
                >
                  <option value="">Selecione um falecido</option>
                  {falecidos
                    .filter((f) => !formData.clientId || f.clientId === formData.clientId)
                    .map((falecido) => (
                      <option key={falecido.id} value={falecido.id}>
                        {falecido.nome}
                      </option>
                    ))}
                </Select>
                <Input
                  label="Data do Serviço *"
                  type="date"
                  required
                  value={formData.serviceDate}
                  onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })}
                />
              </div>
              <Textarea
                label="Observações"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Informações adicionais sobre o atendimento..."
              />
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Serviços</h3>
                <Button type="button" variant="outline" size="sm" onClick={addService}>
                  + Adicionar Serviço
                </Button>
              </div>
              {selectedServices.map((item, index) => (
                <div key={index} className="flex gap-4 items-end p-4 border rounded-lg">
                  <div className="flex-1">
                    <Select
                      label="Serviço"
                      value={item.serviceId}
                      onChange={(e) => {
                        const updated = [...selectedServices];
                        updated[index].serviceId = e.target.value;
                        setSelectedServices(updated);
                      }}
                    >
                      <option value="">Selecione um serviço</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} - {formatCurrency(service.basePrice)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      label="Qtd"
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...selectedServices];
                        updated[index].quantity = parseInt(e.target.value, 10) || 1;
                        setSelectedServices(updated);
                      }}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeService(index)}>
                    ×
                  </Button>
                </div>
              ))}
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Produtos</h3>
                <Button type="button" variant="outline" size="sm" onClick={addProduct}>
                  + Adicionar Produto
                </Button>
              </div>
              {selectedProducts.map((item, index) => (
                <div key={index} className="flex gap-4 items-end p-4 border rounded-lg">
                  <div className="flex-1">
                    <Select
                      label="Produto"
                      value={item.productId}
                      onChange={(e) => {
                        const updated = [...selectedProducts];
                        updated[index].productId = e.target.value;
                        setSelectedProducts(updated);
                      }}
                    >
                      <option value="">Selecione um produto</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} - {formatCurrency(product.price)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      label="Qtd"
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...selectedProducts];
                        updated[index].quantity = parseInt(e.target.value, 10) || 1;
                        setSelectedProducts(updated);
                      }}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeProduct(index)}>
                    ×
                  </Button>
                </div>
              ))}
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 space-y-4 sticky top-24">
              <h3 className="text-lg font-semibold text-gray-900">Resumo</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal Serviços:</span>
                  <span className="font-medium">
                    {formatCurrency(
                      selectedServices.reduce((sum, item) => {
                        const service = services.find((s) => s.id === item.serviceId);
                        return sum + (service ? service.basePrice * item.quantity : 0);
                      }, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal Produtos:</span>
                  <span className="font-medium">
                    {formatCurrency(
                      selectedProducts.reduce((sum, item) => {
                        const product = products.find((p) => p.id === item.productId);
                        return sum + (product ? product.price * item.quantity : 0);
                      }, 0)
                    )}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold text-lg">
                  <span>Total:</span>
                  <span className="text-blue-600">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
              <Button type="submit" className="w-full" loading={loading}>
                <Save className="h-4 w-4 mr-2" />
                {isEdit ? 'Atualizar' : 'Criar'} Atendimento
              </Button>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
};
