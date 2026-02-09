import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Button, Input, Select, Textarea, Card } from '../../components/ui/Components';
import { useDataStore } from '../../lib/DataStore';
import type { Plano } from '../../types';

const emptyForm = {
  nome: '',
  codigo: '',
  categoria: 'individual' as Plano['categoria'],
  descricao: '',
  valorMensal: '',
  valorAnual: '',
  taxaAdesao: '',
  maxBeneficiarios: '1',
  carencia: '30',
  status: 'ativo' as Plano['status'],
};

export const PlanoForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getPlano, addPlano, updatePlano } = useDataStore();
  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const plano = id ? getPlano(id) : undefined;

  useEffect(() => {
    if (plano) {
      setFormData({
        nome: plano.nome,
        codigo: plano.codigo,
        categoria: plano.categoria,
        descricao: plano.descricao,
        valorMensal: String(plano.valorMensal),
        valorAnual: plano.valorAnual ? String(plano.valorAnual) : '',
        taxaAdesao: plano.taxaAdesao ? String(plano.taxaAdesao) : '',
        maxBeneficiarios: String(plano.numeroMaximoBeneficiarios),
        carencia: String(plano.carenciaDias),
        status: plano.status,
      });
    } else if (!isEditing) {
      setFormData(emptyForm);
    }
  }, [plano, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const valorMensal = parseFloat(formData.valorMensal) || 0;
    const valorAnual = formData.valorAnual ? parseFloat(formData.valorAnual) : undefined;
    const taxaAdesao = formData.taxaAdesao ? parseFloat(formData.taxaAdesao) : undefined;
    const maxBenef = parseInt(formData.maxBeneficiarios, 10) || 1;
    const carencia = parseInt(formData.carencia, 10) || 0;

    if (isEditing && id) {
      updatePlano(id, {
        nome: formData.nome,
        categoria: formData.categoria,
        descricao: formData.descricao,
        valorMensal,
        valorAnual,
        taxaAdesao,
        numeroMaximoBeneficiarios: maxBenef,
        carenciaDias: carencia,
        status: formData.status,
      });
      setLoading(false);
      navigate('/planos');
    } else {
      addPlano({
        nome: formData.nome,
        categoria: formData.categoria,
        descricao: formData.descricao,
        valorMensal,
        valorAnual,
        taxaAdesao,
        numeroMaximoBeneficiarios: maxBenef,
        carenciaDias: carencia,
        status: formData.status,
      });
      setLoading(false);
      navigate('/planos');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (isEditing && id && !plano) {
    return (
      <div className="p-8 text-center text-gray-500">
        Plano não encontrado. <Button variant="outline" onClick={() => navigate('/planos')}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <PageHeader
        title={isEditing ? 'Editar Plano' : 'Novo Plano'}
        subtitle="Preencha as informações básicas do plano"
      />

      <form onSubmit={handleSubmit}>
        <Card className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Nome do Plano *"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              placeholder="Ex: Plano Familiar Premium"
              required
            />
            <Input label="Código" value={formData.codigo} disabled className="bg-gray-50" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select label="Categoria *" name="categoria" value={formData.categoria} onChange={handleChange}>
              <option value="individual">Individual</option>
              <option value="familiar">Familiar</option>
              <option value="empresarial">Empresarial</option>
            </Select>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Status *</label>
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="ativo"
                    checked={formData.status === 'ativo'}
                    onChange={handleChange}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Ativo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="inativo"
                    checked={formData.status === 'inativo'}
                    onChange={handleChange}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Inativo</span>
                </label>
              </div>
            </div>
          </div>

          <Textarea
            label="Descrição *"
            name="descricao"
            value={formData.descricao}
            onChange={handleChange}
            placeholder="Descreva os benefícios do plano..."
            rows={3}
            required
          />

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Valores e Condições</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input
                label="Valor Mensal (R$) *"
                name="valorMensal"
                type="number"
                step="0.01"
                min="0"
                value={formData.valorMensal}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
              <Input
                label="Valor Anual (R$)"
                name="valorAnual"
                type="number"
                step="0.01"
                min="0"
                value={formData.valorAnual}
                onChange={handleChange}
                placeholder="0.00"
              />
              <Input
                label="Taxa de Adesão (R$)"
                name="taxaAdesao"
                type="number"
                step="0.01"
                min="0"
                value={formData.taxaAdesao}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Máx. Beneficiários *"
              name="maxBeneficiarios"
              type="number"
              min="1"
              value={formData.maxBeneficiarios}
              onChange={handleChange}
              required
            />
            <Select label="Carência (dias) *" name="carencia" value={formData.carencia} onChange={handleChange}>
              <option value="0">Sem carência</option>
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
              <option value="90">90 dias</option>
              <option value="180">180 dias</option>
            </Select>
          </div>
        </Card>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/planos')}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Salvar Alterações' : 'Criar Plano'}
          </Button>
        </div>
      </form>
    </div>
  );
};
