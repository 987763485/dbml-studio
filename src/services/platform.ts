import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import type {
  FileSnapshot,
  LayoutFile,
  OpenFileResult,
  RecentFile,
  RecoveryMeta,
  RecoverySnapshot,
} from '../types';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const browserRecentKey = 'dbml-studio:recent';
const browserRecoveryKey = 'dbml-studio:recovery';
const browserFilesKey = 'dbml-studio:files';
const browserLayoutPrefix = 'dbml-studio:layout:';

function readBrowserJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeBrowserJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function baseName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() || path;
}

function browserPathFor(name: string): string {
  return `browser://${name}`;
}

export async function pickOpenFile(): Promise<OpenFileResult | null> {
  if (isTauri()) {
    const selected = await openDialog({
      multiple: false,
      directory: false,
      filters: [{ name: 'DBML', extensions: ['dbml', 'dbml.txt'] }],
    });
    if (!selected || Array.isArray(selected)) return null;
    const snapshot = await readTextFile(selected);
    return {
      path: selected,
      name: baseName(selected),
      content: snapshot.content,
      modifiedAt: snapshot.modifiedAt,
    };
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dbml,.txt,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const content = await file.text();
      const path = browserPathFor(file.name);
      const files = readBrowserJson<Record<string, string>>(browserFilesKey, {});
      files[path] = content;
      writeBrowserJson(browserFilesKey, files);
      resolve({ path, name: file.name, content });
    };
    input.click();
  });
}

export async function pickSavePath(
  defaultName: string,
  currentPath?: string | null,
): Promise<string | null> {
  if (isTauri()) {
    const defaultPath = currentPath?.replace(/\.bak$/, '') || defaultName;
    return saveDialog({
      defaultPath,
      filters: [{ name: 'DBML', extensions: ['dbml'] }],
    });
  }
  return browserPathFor(defaultName);
}

export async function pickExportPath(
  defaultName: string,
  extension: string,
  filterName: string,
): Promise<string | null> {
  if (isTauri()) {
    return saveDialog({
      defaultPath: defaultName,
      filters: [{ name: filterName, extensions: [extension] }],
    });
  }
  return browserPathFor(defaultName);
}

export async function readTextFile(path: string): Promise<FileSnapshot> {
  if (isTauri()) {
    return invoke<FileSnapshot>('read_text_file', { path });
  }
  const files = readBrowserJson<Record<string, string>>(browserFilesKey, {});
  if (!(path in files)) {
    throw new Error('浏览器预览模式无法读取本地路径，请重新打开文件');
  }
  return {
    path,
    content: files[path],
    size: new Blob([files[path]]).size,
    modifiedAt: null,
  };
}

export async function writeTextFile(
  path: string,
  content: string,
  options: { backup?: boolean } = {},
): Promise<{ path: string; bytes: number; savedAt: number }> {
  if (isTauri()) {
    return invoke('save_text_atomic', {
      path,
      content,
      options: { backup: options.backup ?? true },
    });
  }
  const files = readBrowserJson<Record<string, string>>(browserFilesKey, {});
  files[path] = content;
  writeBrowserJson(browserFilesKey, files);
  downloadText(baseName(path), content);
  return { path, bytes: new Blob([content]).size, savedAt: Date.now() };
}

export async function loadLayout(docPath: string): Promise<LayoutFile | null> {
  if (isTauri()) {
    const layout = await invoke<LayoutFile | null>('load_layout', { docPath });
    return layout ?? null;
  }
  return readBrowserJson<LayoutFile | null>(`${browserLayoutPrefix}${docPath}`, null);
}

export async function saveLayout(docPath: string, layout: LayoutFile): Promise<void> {
  if (isTauri()) {
    await invoke('save_layout', { docPath, layout });
    return;
  }
  writeBrowserJson(`${browserLayoutPrefix}${docPath}`, layout);
}

export async function listRecentFiles(): Promise<RecentFile[]> {
  if (isTauri()) {
    return invoke<RecentFile[]>('recent_files');
  }
  return readBrowserJson<RecentFile[]>(browserRecentKey, []);
}

export async function touchRecentFile(path: string, name: string): Promise<RecentFile[]> {
  if (isTauri()) {
    return invoke<RecentFile[]>('touch_recent', { path, name });
  }
  const files = readBrowserJson<RecentFile[]>(browserRecentKey, []);
  const next = [
    { path, name, lastOpened: Date.now(), exists: true },
    ...files.filter((file) => file.path !== path),
  ].slice(0, 10);
  writeBrowserJson(browserRecentKey, next);
  return next;
}

export async function removeRecentFile(path: string): Promise<RecentFile[]> {
  if (isTauri()) {
    return invoke<RecentFile[]>('remove_recent', { path });
  }
  const files = readBrowserJson<RecentFile[]>(browserRecentKey, []).filter(
    (file) => file.path !== path,
  );
  writeBrowserJson(browserRecentKey, files);
  return files;
}

interface BrowserRecovery extends RecoverySnapshot {}

export async function saveRecovery(
  docId: string,
  path: string | null,
  fileName: string,
  content: string,
): Promise<RecoveryMeta> {
  if (isTauri()) {
    return invoke<RecoveryMeta>('recovery_save', {
      docId,
      path,
      fileName,
      content,
    });
  }
  const snapshots = readBrowserJson<BrowserRecovery[]>(browserRecoveryKey, []);
  const snapshot: BrowserRecovery = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    docId,
    path,
    fileName,
    content,
    savedAt: Date.now(),
  };
  const next = [snapshot, ...snapshots.filter((item) => item.docId !== docId)].slice(0, 5);
  writeBrowserJson(browserRecoveryKey, next);
  return snapshot;
}

export async function listRecovery(): Promise<RecoveryMeta[]> {
  if (isTauri()) {
    return invoke<RecoveryMeta[]>('recovery_list');
  }
  return readBrowserJson<BrowserRecovery[]>(browserRecoveryKey, []).sort(
    (a, b) => b.savedAt - a.savedAt,
  );
}

export async function loadRecovery(id: string): Promise<RecoverySnapshot> {
  if (isTauri()) {
    return invoke<RecoverySnapshot>('recovery_load', { id });
  }
  const snapshots = readBrowserJson<BrowserRecovery[]>(browserRecoveryKey, []);
  const snapshot = snapshots.find((item) => item.id === id);
  if (!snapshot) throw new Error('恢复快照不存在');
  return snapshot;
}

export async function discardRecovery(docId: string): Promise<void> {
  if (isTauri()) {
    await invoke('recovery_discard', { docId });
    return;
  }
  const snapshots = readBrowserJson<BrowserRecovery[]>(browserRecoveryKey, []).filter(
    (item) => item.docId !== docId,
  );
  writeBrowserJson(browserRecoveryKey, snapshots);
}

export async function exportBinaryFile(path: string, dataBase64: string): Promise<void> {
  if (isTauri()) {
    await invoke('export_binary_file', { path, dataBase64 });
    return;
  }
  const encoded = dataBase64.split(',').pop() || dataBase64;
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = baseName(path);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function revealInFileManager(path: string): Promise<void> {
  if (isTauri()) {
    await invoke('reveal_in_file_manager', { path });
  }
}

export async function quitApp(): Promise<void> {
  if (isTauri()) {
    await invoke('quit_app');
  }
}

export function downloadText(name: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickDefaultSaveName(name: string): string {
  return name.toLowerCase().endsWith('.dbml') ? name : `${name}.dbml`;
}

export { baseName };
