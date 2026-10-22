import { useEffect, useRef, type ReactNode } from 'react';
import {
  ClipboardCopy,
  LayoutGrid,
  LocateFixed,
  Maximize,
  Plus,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { diagramBridge } from '../services/diagramBridge';
import { refEndpointText } from '../core/model';
import { copyText } from '../utils';

export function ContextMenu() {
  const menu = useAppStore((state) => state.contextMenu);
  const table = useAppStore((state) =>
    menu?.kind === 'table' && menu.id ? state.view.tableMap.get(menu.id) : undefined,
  );
  const ref = useAppStore((state) =>
    menu?.kind === 'ref' && menu.id ? state.view.refMap.get(menu.id) : undefined,
  );
  const dismiss = useAppStore((state) => state.dismissContextMenu);
  const refElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!refElement.current?.contains(event.target as Node)) dismiss();
    };
    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menu, dismiss]);

  if (!menu) return null;

  const copy = async (text: string, label: string) => {
    dismiss();
    const ok = await copyText(text);
    useAppStore
      .getState()
      .showToast(ok ? 'success' : 'error', ok ? `${label}已复制` : '复制失败');
  };

  const item = (label: string, icon: ReactNode, action: () => void, danger = false) => (
    <button
      className={`context-item ${danger ? 'danger' : ''}`}
      role="menuitem"
      onClick={() => {
        dismiss();
        action();
      }}
    >
      <span className="context-item-icon">{icon}</span>
      {label}
    </button>
  );

  return (
    <div
      ref={refElement}
      className="context-menu"
      role="menu"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menu.kind === 'table' && table && (
        <>
          <div className="context-label">
            {table.schemaName !== 'public' ? `${table.schemaName}.` : ''}
            {table.name}
          </div>
          {item('在 DBML 中定位', <LocateFixed size={12} />, () => {
            useAppStore.getState().revealTableInEditor(table.key);
          })}
          {item('添加字段', <Plus size={12} />, () => {
            useAppStore.getState().addColumnToTable(table.key);
          })}
          {item('复制表名', <ClipboardCopy size={12} />, () => {
            void copy(table.name, '表名');
          })}
          <div className="context-sep" />
          {item(
            '删除表',
            <Trash2 size={12} />,
            () => useAppStore.getState().requestDeleteTable(table.key),
            true,
          )}
        </>
      )}

      {menu.kind === 'ref' && ref && (
        <>
          <div className="context-label">
            {refEndpointText(ref.left)} {ref.op} {refEndpointText(ref.right)}
          </div>
          {item('在 DBML 中定位', <LocateFixed size={12} />, () => {
            useAppStore.getState().revealRefInEditor(ref.id);
          })}
          {item('复制关系表达式', <ClipboardCopy size={12} />, () => {
            void copy(
              `${refEndpointText(ref.left)} ${ref.op} ${refEndpointText(ref.right)}`,
              '关系表达式',
            );
          })}
          <div className="context-sep" />
          {item(
            '删除关系',
            <Trash2 size={12} />,
            () => useAppStore.getState().requestDeleteRef(ref.id),
            true,
          )}
        </>
      )}

      {menu.kind === 'pane' && (
        <>
          {item('新建表', <Plus size={12} />, () => {
            useAppStore.getState().createTableAt();
          })}
          {item('自动布局', <LayoutGrid size={12} />, () => {
            void useAppStore.getState().runAutoLayout();
          })}
          {item('适应画布', <Maximize size={12} />, () => {
            useAppStore.getState().requestFitView();
          })}
          {item('重置缩放', <ZoomIn size={12} />, () => {
            diagramBridge.zoomTo(1);
          })}
        </>
      )}
    </div>
  );
}
