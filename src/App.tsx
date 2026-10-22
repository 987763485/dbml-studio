import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { TitleBar } from './components/TitleBar';
import { StatusBar } from './components/StatusBar';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ContextMenu } from './components/ContextMenu';
import { Toasts } from './components/Toasts';
import { UnsavedDialog } from './components/UnsavedDialog';
import { WelcomeScreen } from './features/welcome/WelcomeScreen';
import { RecoveryDialog } from './features/welcome/RecoveryDialog';
import { Workspace } from './features/workspace/Workspace';
import { ExportDialog } from './features/exporter/ExportDialog';
import { SettingsDialog } from './features/settings/SettingsDialog';
import { ShortcutsDialog } from './features/settings/ShortcutsDialog';
import { useAppStore } from './stores/appStore';
import { editorBridge } from './services/editorBridge';
import { diagramBridge } from './services/diagramBridge';
import { isTauri } from './services/platform';

function BootScreen() {
  return (
    <div className="boot-screen">
      <div className="boot-logo">
        <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
          <rect x="2.2" y="2.6" width="6.2" height="4.6" rx="1.2" stroke="currentColor" strokeWidth="1.25" />
          <rect x="11.6" y="12.8" width="6.2" height="4.6" rx="1.2" stroke="currentColor" strokeWidth="1.25" />
          <rect x="11.6" y="2.6" width="6.2" height="4.6" rx="1.2" stroke="currentColor" strokeWidth="1.25" />
          <path
            d="M8.4 4.9h3.2M14.7 7.2v5.6M5.3 7.2v5.6a2 2 0 0 0 2 2h4.3"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span>正在准备本地工作区…</span>
    </div>
  );
}

function WorkspaceShell() {
  return (
    <>
      <Workspace />
      <StatusBar />
    </>
  );
}

function focusSearch(): void {
  const state = useAppStore.getState();
  if (state.screen !== 'workspace') return;
  if (state.sidebarCollapsed) state.toggleSidebar();
  window.setTimeout(() => {
    document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
  }, 40);
}

export default function App() {
  const ready = useAppStore((state) => state.ready);
  const screen = useAppStore((state) => state.screen);
  const theme = useAppStore((state) => state.theme);
  const resolvedTheme = useAppStore((state) => state.resolvedTheme);
  const docName = useAppStore((state) => state.docName);
  const dirty = useAppStore((state) => state.dirty);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void useAppStore.getState().initialize();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () =>
      useAppStore.getState().setResolvedTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => {
    document.title =
      screen === 'workspace'
        ? `${dirty ? '● ' : ''}${docName} — DBML Studio`
        : 'DBML Studio — 本地数据库建模';
  }, [docName, dirty, screen]);

  useEffect(() => {
    if (isTauri()) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!useAppStore.getState().dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useAppStore.getState();
      const target = event.target instanceof HTMLElement ? event.target : null;
      const inEditor = Boolean(target?.closest('.monaco-editor'));
      const inInput = Boolean(
        target &&
          (target.matches('input, textarea, select') ||
            target.getAttribute('contenteditable') === 'true' ||
            inEditor),
      );
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === 's') {
        event.preventDefault();
        if (event.shiftKey) void state.saveAs();
        else void state.save();
        return;
      }
      if (mod && key === 'o') {
        event.preventDefault();
        state.requestOpen();
        return;
      }
      if (mod && key === 'n') {
        event.preventDefault();
        state.requestNew();
        return;
      }
      if (mod && key === 'e') {
        event.preventDefault();
        if (state.screen === 'workspace') state.setExportOpen(true);
        return;
      }
      if (mod && key === ',') {
        event.preventDefault();
        state.setSettingsOpen(true);
        return;
      }
      if (mod && key === 'k') {
        event.preventDefault();
        focusSearch();
        return;
      }
      if (mod && ['1', '2', '3'].includes(key)) {
        event.preventDefault();
        state.setViewMode(key === '1' ? 'split' : key === '2' ? 'editor' : 'canvas');
        return;
      }
      if (mod && key === 'z' && !inEditor && !inInput) {
        event.preventDefault();
        if (event.shiftKey) editorBridge.redo();
        else editorBridge.undo();
        return;
      }
      if (mod && key === 'y' && !inEditor && !inInput) {
        event.preventDefault();
        editorBridge.redo();
        return;
      }
      if (event.key === 'Escape') {
        if (state.confirm) {
          state.setConfirm(null);
          return;
        }
        if (state.contextMenu) state.dismissContextMenu();
        return;
      }
      if (mod || inInput || event.altKey) return;

      if (event.key === '?') {
        event.preventDefault();
        state.setShortcutsOpen(true);
      } else if (key === 'f') {
        diagramBridge.fitView();
      } else if (key === 'l') {
        void state.runAutoLayout();
      } else if ((key === 'delete' || key === 'backspace') && state.selection) {
        event.preventDefault();
        state.deleteSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let unlistenClose: UnlistenFn | undefined;
    let unlistenMenu: UnlistenFn | undefined;
    let disposed = false;

    void (async () => {
      try {
        unlistenClose = await getCurrentWindow().onCloseRequested(async (event) => {
          event.preventDefault();
          await useAppStore.getState().requestCloseWindow();
        });
      } catch {
        // The browser preview has no window integration.
      }
      try {
        unlistenMenu = await listen<string>('menu', (event) => {
          const state = useAppStore.getState();
          const action = event.payload;
          if (action === 'new') state.requestNew();
          else if (action === 'open') state.requestOpen();
          else if (action === 'save') void state.save();
          else if (action === 'save-as') void state.saveAs();
          else if (action === 'export') state.setExportOpen(true);
          else if (action === 'close') void state.requestCloseWindow();
          else if (action === 'quit') void state.requestQuit();
          else if (action === 'undo') editorBridge.undo();
          else if (action === 'redo') editorBridge.redo();
          else if (action === 'find') editorBridge.find();
          else if (action === 'view-split') state.setViewMode('split');
          else if (action === 'view-editor') state.setViewMode('editor');
          else if (action === 'view-canvas') state.setViewMode('canvas');
          else if (action === 'autolayout') void state.runAutoLayout();
          else if (action === 'fit') diagramBridge.fitView();
          else if (action === 'settings') state.setSettingsOpen(true);
          else if (action === 'shortcuts') state.setShortcutsOpen(true);
          else if (action === 'welcome') state.requestWelcome();
          else if (action === 'toggle-theme') {
            state.setTheme(state.resolvedTheme === 'dark' ? 'light' : 'dark');
          }
        });
      } catch {
        // Menu wiring is best effort.
      }
      if (disposed) {
        unlistenClose?.();
        unlistenMenu?.();
      }
    })();

    return () => {
      disposed = true;
      unlistenClose?.();
      unlistenMenu?.();
    };
  }, []);

  return (
    <div className="app">
      <TitleBar />
      {!ready ? (
        <BootScreen />
      ) : screen === 'welcome' ? (
        <WelcomeScreen />
      ) : (
        <WorkspaceShell />
      )}

      <SettingsDialog />
      <ShortcutsDialog />
      <ExportDialog />
      <UnsavedDialog />
      <ConfirmDialog />
      <RecoveryDialog />
      <ContextMenu />
      <Toasts />
    </div>
  );
}
