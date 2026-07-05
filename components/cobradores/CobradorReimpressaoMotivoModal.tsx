import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button, Textarea } from '../ui/Components';
import {
  COBRADOR_REIMPRESSAO_MOTIVO_ADMIN_MIN,
  validarMotivoAdminReimpressao,
} from '../../lib/cobradorReciboReimpressao';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void | Promise<void>;
  loading?: boolean;
  qtdRecebimentos?: number;
};

export const CobradorReimpressaoMotivoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  qtdRecebimentos = 1,
}) => {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const handleConfirm = async () => {
    const msg = validarMotivoAdminReimpressao(motivo);
    if (msg) {
      setErro(msg);
      return;
    }
    setErro(null);
    await onConfirm(motivo.trim());
  };

  const handleClose = () => {
    if (loading) return;
    setMotivo('');
    setErro(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Motivo da reimpressão" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 leading-snug">
          Reimpressão pelo escritório de{' '}
          <strong>{qtdRecebimentos} recebimento(s)</strong>. Informe o motivo para registro
          (obrigatório).
        </p>
        <Textarea
          label="Motivo"
          placeholder="Ex.: cliente perdeu o comprovante; impressora falhou na baixa…"
          value={motivo}
          rows={4}
          error={erro || undefined}
          onChange={(e) => {
            setMotivo(e.target.value);
            if (erro) setErro(null);
          }}
        />
        <p className="text-xs text-gray-500">
          Mínimo de {COBRADOR_REIMPRESSAO_MOTIVO_ADMIN_MIN} caracteres.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" disabled={loading} onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="button" className="flex-1" loading={loading} onClick={() => void handleConfirm()}>
            Confirmar e imprimir
          </Button>
        </div>
      </div>
    </Modal>
  );
};
