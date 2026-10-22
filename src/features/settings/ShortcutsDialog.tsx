import { Command, FileText, Keyboard, LayoutGrid, PencilRuler, Search } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useAppStore } from '../../stores/appStore';
import { isMac, modKey } from '../../utils';

interface Shortcut {
  keys: string[];
  label: string;
  hint?: string;
}

interface ShortcutGroup {
  title: string;
  icon: typeof Command;
  items: Shortcut[];
}

function keyLabel(key: string): string {
  if (key === 'Mod') return modKey;
  if (key === 'Shift') return '⇧';
  if (key === 'Alt') return isMac ? '⌥' : 'Alt';
  if (key === 'Enter') return '↵';
  if (key === 'Esc') return 'Esc';
  if (key === 'Delete') return isMac ? '⌫' : 'Del';
  if (key === 'Drag') return '拖拽';
  return key;
}

const groups: ShortcutGroup[] = [
  {
    title: '文件',
    icon: FileText,
    items: [
      { keys: ['Mod', 'N'], label: '新建文档', hint: '有未保存修改时会先询问' },
      { keys: ['Mod', 'O'], label: '打开 DBML 文件' },
      { keys: ['Mod', 'S'], label: '保存' },
      { keys: ['Mod', 'Shift', 'S'], label: '另存为' },
      { keys: ['Mod', 'E'], label: '导出 SQL / DBML / PNG' },
    ],
  },
  {
    title: '编辑',
    icon: PencilRuler,
    items: [
      { keys: ['Mod', 'Z'], label: '撤销' },
      { keys: ['Mod', 'Shift', 'Z'], label: '重做' },
      { keys: ['Mod', 'F'], label: '在 DBML 中查找', hint: '焦点位于编辑器时' },
      { keys: ['Mod', 'K'], label: '搜索表或字段' },
      { keys: ['Mod', ','], label: '打开设置' },
    ],
  },
  {
    title: '视图',
    icon: LayoutGrid,
    items: [
      { keys: ['Mod', '1'], label: '分栏视图' },
      { keys: ['Mod', '2'], label: '仅代码视图' },
      { keys: ['Mod', '3'], label: '仅画布视图' },
      { keys: ['?'], label: '打开快捷键面板' },
      { keys: ['Esc'], label: '关闭弹窗 / 取消选中' },
    ],
  },
  {
    title: '画布',
    icon: Command,
    items: [
      { keys: ['F'], label: '适应画布' },
      { keys: ['L'], label: '重新整理自动布局' },
      { keys: ['Delete'], label: '删除选中的表或关系' },
      { keys: ['Shift', 'Drag'], label: '框选多张表', hint: '按住 Shift 拖动空白区域' },
    ],
  },
];

export function ShortcutsDialog() {
  const open = useAppStore((state) => state.shortcutsOpen);
  const setOpen = useAppStore((state) => state.setShortcutsOpen);

  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <Modal
      size="lg"
      title="键盘快捷键"
      subtitle={`${isMac ? 'macOS' : 'Windows / Linux'} 下的默认按键，可在编辑器内使用标准文本快捷键。`}
      icon={<Keyboard size={17} />}
      onClose={close}
      footer={
        <>
          <span className="settings-foot-note">
            <Search size={12} />
            在输入框中输入文字时，画布单键快捷键会自动暂停
          </span>
          <button className="btn primary" onClick={close}>
            知道了
          </button>
        </>
      }
    >
      <div className="shortcut-grid">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <section className="shortcut-group" key={group.title}>
              <header>
                <Icon size={12} />
                {group.title}
              </header>
              <div className="shortcut-list">
                {group.items.map((item) => (
                  <div className="shortcut-row" key={`${group.title}-${item.label}`}>
                    <div className="shortcut-copy">
                      <span>{item.label}</span>
                      {item.hint && <small>{item.hint}</small>}
                    </div>
                    <span className="shortcut-keys">
                      {item.keys.map((key) => (
                        <kbd key={key}>{keyLabel(key)}</kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
