import { useEffect, useRef } from 'react';
import { FileText, Plus, X } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { modKey } from '../utils';

export function TabBar() {
  const tabs = useAppStore((state) => state.tabs);
  const docId = useAppStore((state) => state.docId);
  const activeDirty = useAppStore((state) => state.dirty);
  const activateTab = useAppStore((state) => state.activateTab);
  const requestCloseTab = useAppStore((state) => state.requestCloseTab);
  const requestNew = useAppStore((state) => state.requestNew);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [docId, tabs.length]);

  if (tabs.length === 0) return null;

  return (
    <div className="tabbar" role="tablist" aria-label="打开的文档">
      <div className="tabbar-scroll" ref={stripRef}>
        {tabs.map((tab) => {
          const active = tab.docId === docId;
          const dirty = active ? activeDirty : tab.dirty;
          return (
            <div
              key={tab.docId}
              className={[
                'doc-tab',
                active ? 'active' : '',
                dirty ? 'is-dirty' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              data-active={active}
              title={tab.docPath ? `${tab.docName}\n${tab.docPath}` : `${tab.docName}（尚未保存）`}
              onClick={() => activateTab(tab.docId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  activateTab(tab.docId);
                }
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  requestCloseTab(tab.docId);
                }
              }}
            >
              <FileText size={12} />
              <span className="doc-tab-name">{tab.docName}</span>
              {dirty && <span className="doc-tab-dirty" aria-label="未保存" />}
              <button
                className="doc-tab-close"
                title={`关闭标签页（${modKey}W）`}
                aria-label={`关闭 ${tab.docName}`}
                onClick={(event) => {
                  event.stopPropagation();
                  requestCloseTab(tab.docId);
                }}
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>
      <button
        className="tab-new"
        title={`新建标签页（${modKey}N）`}
        aria-label="新建标签页"
        onClick={() => requestNew()}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
