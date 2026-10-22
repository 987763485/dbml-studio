import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { useAppStore } from '../stores/appStore';

export function ConfirmDialog() {
  const confirm = useAppStore((state) => state.confirm);
  const setConfirm = useAppStore((state) => state.setConfirm);
  const [busy, setBusy] = useState(false);

  if (!confirm) return null;

  const close = () => {
    if (!busy) setConfirm(null);
  };

  const run = async () => {
    setBusy(true);
    try {
      await confirm.onConfirm();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <Modal
      size="sm"
      title={confirm.title}
      subtitle="此操作会立即改写 DBML 文本"
      icon={
        confirm.danger ? (
          <AlertTriangle size={17} />
        ) : (
          <Trash2 size={17} />
        )
      }
      onClose={close}
      className={confirm.danger ? 'danger-modal' : ''}
      footer={
        <>
          <button className="btn" onClick={close} disabled={busy}>
            取消
          </button>
          <button
            className={`btn ${confirm.danger ? 'danger' : 'primary'}`}
            onClick={() => void run()}
            disabled={busy}
          >
            {busy ? '处理中…' : confirm.confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-body">{confirm.body}</p>
    </Modal>
  );
}
