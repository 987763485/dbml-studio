import { useState } from 'react';
import { Save, TriangleAlert } from 'lucide-react';
import { Modal } from './Modal';
import { useAppStore } from '../stores/appStore';

function pendingText(type: string | undefined): string {
  if (type === 'closeTab') return '继续将关闭此标签页。';
  if (type === 'welcome') return '继续将关闭所有标签页并返回欢迎页。';
  if (type === 'close') return '继续将关闭所有标签页并退出 DBML Studio。';
  if (type === 'quit') return '继续将退出 DBML Studio。';
  return '继续将离开当前文档。';
}

export function UnsavedDialog() {
  const open = useAppStore((state) => state.unsavedOpen);
  const pending = useAppStore((state) => state.pendingAction);
  const resolveUnsaved = useAppStore((state) => state.resolveUnsaved);
  const saveState = useAppStore((state) => state.saveState);
  const tabs = useAppStore((state) => state.tabs);
  const inactiveDocs = useAppStore((state) => state.inactiveDocs);
  const docId = useAppStore((state) => state.docId);
  const activeDirty = useAppStore((state) => state.dirty);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const dirtyCount =
    pending?.type === 'closeTab'
      ? 1
      : Math.max(
          1,
          tabs.filter((tab) =>
            tab.docId === docId
              ? activeDirty
              : Boolean(inactiveDocs[tab.docId]?.dirty),
          ).length,
        );

  const choose = async (choice: 'save' | 'discard' | 'cancel') => {
    setBusy(true);
    try {
      await resolveUnsaved(choice);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      size="sm"
      title={dirtyCount > 1 ? '保存多个文档？' : '保存修改？'}
      subtitle={`${
        dirtyCount > 1
          ? `有 ${dirtyCount} 个文档存在未保存的修改。`
          : '当前文档有未保存的修改。'
      }${pendingText(pending?.type)}`}
      icon={<TriangleAlert size={17} />}
      onClose={() => void choose('cancel')}
      className="unsaved-modal"
      footer={
        <>
          <button className="btn" onClick={() => void choose('cancel')} disabled={busy}>
            取消
          </button>
          <button
            className="btn danger-ghost"
            onClick={() => void choose('discard')}
            disabled={busy}
          >
            放弃修改
          </button>
          <button
            className="btn primary"
            onClick={() => void choose('save')}
            disabled={busy || saveState === 'saving'}
          >
            <Save size={13} />
            {saveState === 'saving'
              ? '保存中…'
              : dirtyCount > 1
                ? '全部保存并继续'
                : '保存并继续'}
          </button>
        </>
      }
    >
      <p className="confirm-body">
        选择保存会先写入源文件（多个文档将依次保存）；选择「放弃修改」只会丢弃本次未保存的编辑，恢复快照也会一并清理。
      </p>
    </Modal>
  );
}
