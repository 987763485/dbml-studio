import { useState } from 'react';
import { Clock3, History, RotateCcw, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useAppStore } from '../../stores/appStore';
import { formatRelative } from '../../utils';

export function RecoveryDialog() {
  const open = useAppStore((state) => state.recoveryOpen);
  const recoveries = useAppStore((state) => state.recoveries);
  const setRecoveryOpen = useAppStore((state) => state.setRecoveryOpen);
  const openRecovery = useAppStore((state) => state.openRecovery);
  const discardRecovery = useAppStore((state) => state.discardRecoveryById);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!open) return null;

  const close = () => setRecoveryOpen(false);

  return (
    <Modal
      size="md"
      title="恢复未保存的编辑"
      subtitle="应用保留了最近 7 天内的编辑快照，快照只存储在本机。"
      icon={<History size={17} />}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            稍后处理
          </button>
        </>
      }
    >
      {recoveries.length === 0 ? (
        <div className="recovery-empty">
          <Clock3 size={20} />
          <p>当前没有可恢复的快照。</p>
        </div>
      ) : (
        <div className="recovery-list">
          {recoveries.map((item) => (
            <div className="recovery-item" key={item.id}>
              <div className="recovery-icon">
                <History size={15} />
              </div>
              <div className="recovery-main">
                <span className="recovery-name">{item.fileName || '未命名.dbml'}</span>
                <span className="recovery-path" title={item.path ?? '未保存的文档'}>
                  {item.path ?? '未命名文档 · 尚未写入源文件'}
                </span>
                <span className="recovery-time">
                  <Clock3 size={9} />
                  {formatRelative(item.savedAt)}
                </span>
              </div>
              <div className="recovery-actions">
                <button
                  className="btn small primary"
                  disabled={busyId !== null}
                  onClick={async () => {
                    setBusyId(item.id);
                    try {
                      await openRecovery(item);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  <RotateCcw size={12} />
                  {busyId === item.id ? '恢复中…' : '恢复'}
                </button>
                <button
                  className="icon-btn danger-hover"
                  title="丢弃这份快照"
                  aria-label="丢弃快照"
                  disabled={busyId !== null}
                  onClick={() => void discardRecovery(item.docId)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
