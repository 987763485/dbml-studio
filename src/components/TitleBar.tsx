import {
  Code2,
  Columns2,
  Download,
  FileText,
  Keyboard,
  LayoutGrid,
  Moon,
  Network,
  PanelLeft,
  PanelLeftClose,
  Redo2,
  Settings,
  Sun,
  Undo2,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { editorBridge } from '../services/editorBridge';
import { modKey } from '../utils';
import { isTauri } from '../services/platform';
import { BrandMark } from './BrandMark';

export function TitleBar() {
  const screen = useAppStore((state) => state.screen);
  const docName = useAppStore((state) => state.docName);
  const dirty = useAppStore((state) => state.dirty);
  const saveState = useAppStore((state) => state.saveState);
  const viewMode = useAppStore((state) => state.viewMode);
  const resolvedTheme = useAppStore((state) => state.resolvedTheme);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const setExportOpen = useAppStore((state) => state.setExportOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const setShortcutsOpen = useAppStore((state) => state.setShortcutsOpen);
  const setTheme = useAppStore((state) => state.setTheme);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const runAutoLayout = useAppStore((state) => state.runAutoLayout);

  const workspace = screen === 'workspace';

  return (
    <header className={`titlebar ${isTauri() ? 'tauri' : ''}`} data-tauri-drag-region>
      <div className="traffic" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="brand" data-tauri-drag-region>
        <BrandMark size={28} />
        <span className="brand-name">DBML Studio</span>
        <span className="pill-local">本地</span>
      </div>

      {workspace ? (
        <>
          <div className="titlebar-center" data-tauri-drag-region>
            <div className={`doc-chip ${dirty ? 'dirty' : ''}`}>
              <FileText size={13} />
              <span className="doc-name">{docName}</span>
              {dirty ? (
                <span className="doc-state dirty-dot" title="有未保存的修改" />
              ) : saveState === 'error' ? (
                <span className="doc-state failed">保存失败</span>
              ) : (
                <span className="doc-state saved">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.2 6.3 4.6 8.7 9.8 3.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  已保存
                </span>
              )}
            </div>
          </div>

          <div className="title-actions">
            <button
              className="icon-btn"
              title={sidebarCollapsed ? '展开对象导航' : '收起对象导航'}
              aria-label="切换对象导航"
              onClick={toggleSidebar}
            >
              {sidebarCollapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
            </button>
            <div className="icon-group">
              <button
                className="icon-btn"
                title={`撤销（${modKey}Z）`}
                aria-label="撤销"
                onClick={() => editorBridge.undo()}
              >
                <Undo2 size={14} />
              </button>
              <button
                className="icon-btn"
                title={`重做（⇧${modKey}Z）`}
                aria-label="重做"
                onClick={() => editorBridge.redo()}
              >
                <Redo2 size={14} />
              </button>
            </div>

            <div className="segmented view-switch" role="group" aria-label="视图模式">
              <button
                className={viewMode === 'editor' ? 'active' : ''}
                title={`仅代码（${modKey}2）`}
                onClick={() => setViewMode('editor')}
              >
                <Code2 size={12} />
                代码
              </button>
              <button
                className={viewMode === 'split' ? 'active' : ''}
                title={`分栏（${modKey}1）`}
                onClick={() => setViewMode('split')}
              >
                <Columns2 size={12} />
                分栏
              </button>
              <button
                className={viewMode === 'canvas' ? 'active' : ''}
                title={`仅画布（${modKey}3）`}
                onClick={() => setViewMode('canvas')}
              >
                <Network size={12} />
                画布
              </button>
            </div>

            <button className="btn hide-narrow" title="重新整理自动布局（L）" onClick={() => void runAutoLayout()}>
              <LayoutGrid size={13} />
              自动布局
            </button>

            <button className="btn primary" title={`导出 SQL / 图片（${modKey}E）`} onClick={() => setExportOpen(true)}>
              <Download size={13} />
              导出
            </button>
          </div>
        </>
      ) : (
        <div className="titlebar-center welcome-center" data-tauri-drag-region>
          <span className="welcome-chip">Local-first database modeling</span>
        </div>
      )}

      <div className={`title-tail ${workspace ? '' : 'welcome-tail'}`}>
        <button
          className="icon-btn"
          title={resolvedTheme === 'dark' ? '切换为浅色' : '切换为深色'}
          aria-label="切换主题"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button className="icon-btn" title={`设置（${modKey},）`} aria-label="设置" onClick={() => setSettingsOpen(true)}>
          <Settings size={14} />
        </button>
        <button className="icon-btn" title="快捷键（?）" aria-label="快捷键" onClick={() => setShortcutsOpen(true)}>
          <Keyboard size={14} />
        </button>
      </div>
    </header>
  );
}
