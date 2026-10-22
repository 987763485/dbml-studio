import { create } from 'zustand';
import type { Database } from '@dbml/parse';
import type {
  CursorPosition,
  LayoutFile,
  OpenFileResult,
  Problem,
  QuickFix,
  RecentFile,
  RecoveryMeta,
  Selection,
  TableLayout,
  ThemeMode,
  ToastMessage,
  ViewMode,
  Viewport,
} from '../types';
import { parseDbml, renameTableInSource, resetEngine } from '../core/dbmlEngine';
import {
  buildViewModel,
  tableKey as makeTableKey,
  type RefModel,
  type TableModel,
  type ViewModel,
} from '../core/model';
import {
  autoLayout,
  missingTableKeys,
  reconcileLayout,
  type LayoutDirection,
} from '../core/layout';
import {
  addColumn,
  addRef,
  createTable,
  deleteColumn,
  deleteRef,
  deleteTable,
  formatDefaultValue,
  isValidIdentifier,
  quoteString,
  renameColumn,
  setColumnSetting,
  setColumnType,
  setRefRelation,
  setRefSetting,
  setTableColor,
  setTableNote,
  type SourceEdit,
} from '../core/edits';
import { findTemplate } from '../core/templates';
import {
  applyEol,
  detectEol,
  normalizeEol,
  type Eol,
} from '../core/text';
import * as platform from '../services/platform';
import { editorBridge } from '../services/editorBridge';
import { diagramBridge } from '../services/diagramBridge';

export type Screen = 'welcome' | 'workspace';
export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error';
export type EdgeStyle = 'bezier' | 'orthogonal';

export interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

export interface TabMeta {
  docId: string;
  docPath: string | null;
  docName: string;
  dirty: boolean;
  saveState: SaveState;
}

export interface DocumentSnapshot {
  docId: string;
  docPath: string | null;
  docName: string;
  content: string;
  savedContent: string;
  eol: Eol;
  dirty: boolean;
  view: ViewModel;
  valid: boolean;
  problems: Problem[];
  markers: Problem[];
  lastParseMs: number;
  lastSavedAt: number | null;
  saveState: SaveState;
  selection: Selection;
  selectedColumn: string | null;
  cursor: CursorPosition;
  cursorTableKey: string | null;
  pendingTableSelection: string | null;
  pendingColumnSelection: string | null;
  pendingRefSelection: {
    fromTableKey: string;
    fromColumn: string;
    toTableKey: string;
    toColumn: string;
  } | null;
  layout: Record<string, TableLayout>;
  layoutDirection: LayoutDirection;
  viewport: Viewport | undefined;
  hasSidecar: boolean;
  layoutTouched: boolean;
  zoom: number;
}

export type PendingAction =
  | { type: 'welcome' }
  | { type: 'close' }
  | { type: 'quit' }
  | { type: 'closeTab'; docId: string };

interface Prefs {
  theme: ThemeMode;
  fontSize: number;
  edgeStyle: EdgeStyle;
  showRelationLabels: boolean;
  showColumnTypes: boolean;
  sidebarCollapsed: boolean;
  layoutDirection: LayoutDirection;
  backup: boolean;
  autoSave: boolean;
}

export interface AppState {
  ready: boolean;
  screen: Screen;
  tabs: TabMeta[];
  inactiveDocs: Record<string, DocumentSnapshot>;
  docPath: string | null;
  docName: string;
  docId: string;
  editorEpoch: number;
  content: string;
  savedContent: string;
  parsedContent: string;
  eol: Eol;
  dirty: boolean;
  db: Database | null;
  view: ViewModel;
  valid: boolean;
  problems: Problem[];
  markers: Problem[];
  parsing: boolean;
  lastParseMs: number;
  lastSavedAt: number | null;
  saveState: SaveState;
  layoutBusy: boolean;

  selection: Selection;
  selectedColumn: string | null;
  cursor: CursorPosition;
  cursorTableKey: string | null;
  pendingTableSelection: string | null;
  pendingColumnSelection: string | null;
  pendingRefSelection: {
    fromTableKey: string;
    fromColumn: string;
    toTableKey: string;
    toColumn: string;
  } | null;

  layout: Record<string, TableLayout>;
  layoutDirection: LayoutDirection;
  viewport: Viewport | undefined;
  hasSidecar: boolean;
  layoutTouched: boolean;
  zoom: number;
  fitSignal: number;

  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  viewMode: ViewMode;
  fontSize: number;
  edgeStyle: EdgeStyle;
  showRelationLabels: boolean;
  showColumnTypes: boolean;
  sidebarCollapsed: boolean;
  backup: boolean;
  autoSave: boolean;

  problemsOpen: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  exportOpen: boolean;
  recoveryOpen: boolean;
  unsavedOpen: boolean;
  pendingAction: PendingAction | null;
  confirm: ConfirmState | null;
  contextMenu: { x: number; y: number; kind: 'table' | 'ref' | 'pane'; id?: string } | null;
  toasts: ToastMessage[];
  recent: RecentFile[];
  recoveries: RecoveryMeta[];

  initialize: () => Promise<void>;
  updateContent: (content: string) => void;
  parseNow: () => void;
  ensureLayout: () => Promise<void>;

  newDocument: (templateId?: string) => void;
  requestNew: (templateId?: string) => void;
  openFileDialog: () => Promise<void>;
  requestOpen: () => void;
  openPath: (path: string) => Promise<void>;
  requestOpenPath: (path: string) => void;
  activateTab: (docId: string) => void;
  requestCloseTab: (docId: string) => void;
  requestCloseActiveTab: () => void;
  resetWorkspace: () => void;
  requestWelcome: () => void;
  requestCloseWindow: () => Promise<void>;
  performClose: () => Promise<void>;
  requestQuit: () => Promise<void>;
  performQuit: () => Promise<void>;
  resolveUnsaved: (choice: 'save' | 'discard' | 'cancel') => Promise<void>;
  adoptDocument: (options: {
    path: string | null;
    name: string;
    content: string;
    savedContent: string;
    layoutFile: LayoutFile | null;
    docId: string;
  }) => Promise<void>;
  save: (saveAs?: boolean) => Promise<boolean>;
  saveAs: () => Promise<boolean>;

  removeRecent: (path: string) => Promise<void>;
  refreshRecoveries: () => Promise<void>;
  openRecovery: (meta: RecoveryMeta) => Promise<void>;
  discardRecoveryById: (docId: string) => Promise<void>;

  setTheme: (theme: ThemeMode) => void;
  setResolvedTheme: (theme: 'light' | 'dark') => void;
  setViewMode: (mode: ViewMode) => void;
  setFontSize: (size: number) => void;
  setEdgeStyle: (style: EdgeStyle) => void;
  setShowRelationLabels: (show: boolean) => void;
  setShowColumnTypes: (show: boolean) => void;
  setLayoutDirection: (direction: LayoutDirection) => void;
  setBackup: (backup: boolean) => void;
  setAutoSave: (autoSave: boolean) => void;
  toggleSidebar: () => void;
  toggleProblems: () => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setExportOpen: (open: boolean) => void;
  setRecoveryOpen: (open: boolean) => void;
  setUnsavedOpen: (open: boolean) => void;
  dismissContextMenu: () => void;
  setContextMenu: (
    menu: { x: number; y: number; kind: 'table' | 'ref' | 'pane'; id?: string } | null,
  ) => void;
  setConfirm: (confirm: ConfirmState | null) => void;
  showToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  dismissToast: (id: number) => void;

  selectTable: (
    key: string,
    options?: { reveal?: boolean; focus?: boolean; column?: string | null },
  ) => void;
  selectColumn: (tableKey: string, columnName: string, reveal?: boolean) => void;
  selectRef: (id: string, options?: { reveal?: boolean; focus?: boolean }) => void;
  clearSelection: () => void;
  setCursor: (cursor: CursorPosition) => void;
  revealTableInEditor: (key: string) => void;
  revealRefInEditor: (id: string) => void;

  createTableAt: (name?: string) => void;
  addColumnToTable: (tableKey: string) => void;
  renameTable: (key: string, newName: string) => void;
  renameColumnInTable: (tableKey: string, columnName: string, newName: string) => void;
  commitTableNote: (key: string, note: string) => void;
  commitTableColor: (key: string, color: string | null) => void;
  commitColumnType: (tableKey: string, columnName: string, typeName: string) => void;
  commitColumnFlag: (
    tableKey: string,
    columnName: string,
    flag: 'pk' | 'unique' | 'not null' | 'increment',
    value: boolean,
  ) => void;
  commitColumnDefault: (tableKey: string, columnName: string, value: string) => void;
  commitColumnNote: (tableKey: string, columnName: string, value: string) => void;
  createRef: (
    fromTableKey: string,
    fromColumn: string,
    toTableKey: string,
    toColumn: string,
  ) => void;
  commitRefRelation: (refId: string, op: string) => void;
  commitRefSetting: (
    refId: string,
    name: 'delete' | 'update' | 'color',
    value: string | null,
  ) => void;
  requestDeleteTable: (key: string) => void;
  requestDeleteColumn: (tableKey: string, columnName: string) => void;
  requestDeleteRef: (refId: string) => void;
  deleteSelection: () => void;
  applyQuickFix: (fix: QuickFix) => void;

  setNodePositions: (positions: Record<string, TableLayout>) => void;
  setViewport: (viewport: Viewport, persist?: boolean) => void;
  runAutoLayout: () => Promise<void>;
  persistLayoutNow: () => Promise<void>;
  schedulePersistLayout: () => void;
  requestFitView: () => void;
}

export const EMPTY_VIEW: ViewModel = {
  tables: [],
  tableMap: new Map(),
  refs: [],
  refMap: new Map(),
  enums: [],
  enumMap: new Map(),
  groups: [],
  stickyNotes: [],
  schemas: [],
  hasProject: false,
  databaseType: null,
};

const PREFS_KEY = 'dbml-studio:prefs';

const defaultPrefs: Prefs = {
  theme: 'system',
  fontSize: 12,
  edgeStyle: 'bezier',
  showRelationLabels: false,
  showColumnTypes: true,
  sidebarCollapsed: false,
  layoutDirection: 'RIGHT',
  backup: true,
  autoSave: false,
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaultPrefs, ...(JSON.parse(raw) as Partial<Prefs>) } : defaultPrefs;
  } catch {
    return defaultPrefs;
  }
}

function savePrefs(state: AppState): void {
  const prefs: Prefs = {
    theme: state.theme,
    fontSize: state.fontSize,
    edgeStyle: state.edgeStyle,
    showRelationLabels: state.showRelationLabels,
    showColumnTypes: state.showColumnTypes,
    sidebarCollapsed: state.sidebarCollapsed,
    layoutDirection: state.layoutDirection,
    backup: state.backup,
    autoSave: state.autoSave,
  };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Preferences are best effort.
  }
}

function systemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? systemTheme() : mode;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '发生未知错误';
}

function untitledId(): string {
  return `untitled-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

let parseTimer: ReturnType<typeof setTimeout> | undefined;
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
let layoutTimer: ReturnType<typeof setTimeout> | undefined;
let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;
let layoutGeneration = 0;
let toastSequence = 0;

function clearTimers(): void {
  if (parseTimer) clearTimeout(parseTimer);
  if (recoveryTimer) clearTimeout(recoveryTimer);
  if (layoutTimer) clearTimeout(layoutTimer);
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  parseTimer = undefined;
  recoveryTimer = undefined;
  layoutTimer = undefined;
  autoSaveTimer = undefined;
}

function ensureCurrent(get: () => AppState): AppState {
  const state = get();
  if (state.parsedContent !== state.content) {
    get().parseNow();
  }
  return get();
}

function requireEditable(get: () => AppState): AppState | null {
  const state = ensureCurrent(get);
  if (!state.valid) {
    get().showToast('error', 'DBML 存在语法错误，修复后才能编辑结构');
    return null;
  }
  return state;
}

function applyEdits(get: () => AppState, edits: SourceEdit[]): boolean {
  if (edits.length === 0) return false;
  if (!editorBridge.isReady()) {
    get().showToast('error', '编辑器尚未准备好');
    return false;
  }
  editorBridge.applyEdits(edits);
  return true;
}

function scheduleAutoSave(get: () => AppState): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = undefined;
    const state = get();
    if (!state.autoSave || !state.docPath || !state.dirty || state.saveState === 'saving') {
      return;
    }
    state.parseNow();
    const current = get();
    if (!current.valid || !current.dirty || !current.docPath) return;
    void current.save(false);
  }, 1400);
}

function scheduleRecovery(get: () => AppState): void {
  if (recoveryTimer) clearTimeout(recoveryTimer);
  recoveryTimer = setTimeout(() => {
    recoveryTimer = undefined;
    const state = get();
    if (!state.docId) return;
    if (!state.dirty) {
      void platform.discardRecovery(state.docId).catch(() => undefined);
      return;
    }
    void platform
      .saveRecovery(state.docId, state.docPath, state.docName, state.content)
      .catch(() => undefined);
  }, 1000);
}

function newLayoutFile(state: {
  docName: string;
  layout: Record<string, TableLayout>;
  viewport: Viewport | undefined;
  layoutDirection: LayoutDirection;
}): LayoutFile {
  return {
    version: 1,
    document: state.docName,
    tables: state.layout,
    viewport: state.viewport,
    layoutDirection: state.layoutDirection,
    updatedAt: new Date().toISOString(),
  };
}

function snapshotFromState(state: AppState): DocumentSnapshot {
  return {
    docId: state.docId,
    docPath: state.docPath,
    docName: state.docName,
    content: state.content,
    savedContent: state.savedContent,
    eol: state.eol,
    dirty: state.dirty,
    view: state.view,
    valid: state.valid,
    problems: state.problems,
    markers: state.markers,
    lastParseMs: state.lastParseMs,
    lastSavedAt: state.lastSavedAt,
    saveState: state.saveState,
    selection: state.selection,
    selectedColumn: state.selectedColumn,
    cursor: state.cursor,
    cursorTableKey: state.cursorTableKey,
    pendingTableSelection: state.pendingTableSelection,
    pendingColumnSelection: state.pendingColumnSelection,
    pendingRefSelection: state.pendingRefSelection,
    layout: state.layout,
    layoutDirection: state.layoutDirection,
    viewport: state.viewport,
    hasSidecar: state.hasSidecar,
    layoutTouched: state.layoutTouched,
    zoom: state.zoom,
  };
}

function tabFromSnapshot(snapshot: DocumentSnapshot): TabMeta {
  return {
    docId: snapshot.docId,
    docPath: snapshot.docPath,
    docName: snapshot.docName,
    dirty: snapshot.dirty,
    saveState: snapshot.saveState,
  };
}

function isPristineDocument(state: AppState): boolean {
  return (
    state.screen === 'workspace' &&
    !state.docPath &&
    state.content.trim() === '' &&
    state.savedContent.trim() === '' &&
    !state.dirty &&
    Object.keys(state.layout).length === 0
  );
}

function nextUntitledName(tabs: TabMeta[], excludeDocId?: string): string {
  const names = new Set(
    tabs.filter((tab) => tab.docId !== excludeDocId).map((tab) => tab.docName),
  );
  if (!names.has('未命名.dbml')) return '未命名.dbml';
  let index = 2;
  while (names.has(`未命名 ${index}.dbml`)) index += 1;
  return `未命名 ${index}.dbml`;
}

function collectDirtyDocIds(state: AppState): string[] {
  const ids = state.tabs.map((tab) => tab.docId);
  if (state.screen === 'workspace' && !ids.includes(state.docId)) {
    ids.unshift(state.docId);
  }
  return ids.filter((docId) =>
    docId === state.docId ? state.dirty : Boolean(state.inactiveDocs[docId]?.dirty),
  );
}

export const useAppStore = create<AppState>()((set, get) => {
  const prefs = loadPrefs();

  const flushDocument = (snapshot: DocumentSnapshot): void => {
    if (snapshot.dirty) {
      void platform
        .saveRecovery(
          snapshot.docId,
          snapshot.docPath,
          snapshot.docName,
          snapshot.content,
        )
        .catch(() => undefined);
    }
    if (snapshot.layoutTouched && snapshot.docPath) {
      void platform
        .saveLayout(snapshot.docPath, newLayoutFile(snapshot))
        .catch(() => undefined);
    }
  };

  const activateDocument = (
    docId: string,
    options: { discardActive?: boolean } = {},
  ): void => {
    const state = get();
    if (state.docId === docId) return;
    const target = state.inactiveDocs[docId];
    if (!target || !state.tabs.some((tab) => tab.docId === docId)) return;

    if (parseTimer) {
      clearTimeout(parseTimer);
      parseTimer = undefined;
      get().parseNow();
    }

    const current = get();
    const previous = snapshotFromState(current);
    const inactiveDocs = { ...current.inactiveDocs };
    if (options.discardActive) {
      delete inactiveDocs[previous.docId];
    } else {
      inactiveDocs[previous.docId] = previous;
    }
    delete inactiveDocs[docId];

    const tabs = current.tabs.map((tab) => {
      if (!options.discardActive && tab.docId === previous.docId) {
        return tabFromSnapshot(previous);
      }
      const snapshot = inactiveDocs[tab.docId];
      return snapshot ? tabFromSnapshot(snapshot) : tab;
    });

    if (!options.discardActive) flushDocument(previous);

    clearTimers();
    layoutGeneration += 1;
    resetEngine(target.content);

    const saveState: SaveState =
      target.saveState === 'saving'
        ? target.dirty
          ? 'unsaved'
          : 'saved'
        : target.saveState;

    set({
      screen: 'workspace',
      docId,
      docPath: target.docPath,
      docName: target.docName,
      editorEpoch: current.editorEpoch + 1,
      content: target.content,
      savedContent: target.savedContent,
      parsedContent: '__pending__',
      eol: target.eol,
      dirty: target.dirty,
      db: null,
      view: target.view,
      valid: target.valid,
      problems: target.problems,
      markers: target.markers,
      parsing: true,
      lastParseMs: target.lastParseMs,
      lastSavedAt: target.lastSavedAt,
      saveState,
      layoutBusy: false,
      selection: target.selection,
      selectedColumn: target.selectedColumn,
      cursor: target.cursor,
      cursorTableKey: target.cursorTableKey,
      pendingTableSelection: target.pendingTableSelection,
      pendingColumnSelection: target.pendingColumnSelection,
      pendingRefSelection: target.pendingRefSelection,
      layout: target.layout,
      layoutDirection: target.layoutDirection,
      viewport: target.viewport,
      hasSidecar: target.hasSidecar,
      layoutTouched: target.layoutTouched,
      zoom: target.zoom,
      fitSignal: target.viewport ? current.fitSignal : current.fitSignal + 1,
      tabs,
      inactiveDocs,
      unsavedOpen: false,
      pendingAction: null,
      contextMenu: null,
      confirm: null,
    });

    get().parseNow();
    if (target.dirty) scheduleRecovery(get);
    scheduleAutoSave(get);
  };

  const closeTabNow = (docId: string): void => {
    const state = get();
    const index = state.tabs.findIndex((tab) => tab.docId === docId);
    if (index === -1) return;
    const remaining = state.tabs.filter((tab) => tab.docId !== docId);
    const inactiveDocs = { ...state.inactiveDocs };
    delete inactiveDocs[docId];
    void platform.discardRecovery(docId).catch(() => undefined);
    set({
      tabs: remaining,
      inactiveDocs,
      recoveries: get().recoveries.filter((item) => item.docId !== docId),
    });
    if (state.docId !== docId) return;

    clearTimers();
    layoutGeneration += 1;
    if (remaining.length === 0) {
      get().resetWorkspace();
      return;
    }
    const next = remaining[Math.min(index, remaining.length - 1)];
    activateDocument(next.docId, { discardActive: true });
  };

  return {
    ready: false,
    screen: 'welcome',
    tabs: [],
    inactiveDocs: {},
    docPath: null,
    docName: '未命名.dbml',
    docId: untitledId(),
    editorEpoch: 0,
    content: '',
    savedContent: '',
    parsedContent: '',
    eol: '\n',
    dirty: false,
    db: null,
    view: EMPTY_VIEW,
    valid: true,
    problems: [],
    markers: [],
    parsing: false,
    lastParseMs: 0,
    lastSavedAt: null,
    saveState: 'saved',
    layoutBusy: false,

    selection: null,
    selectedColumn: null,
    cursor: { line: 1, column: 1 },
    cursorTableKey: null,
    pendingTableSelection: null,
    pendingColumnSelection: null,
    pendingRefSelection: null,

    layout: {},
    layoutDirection: prefs.layoutDirection,
    viewport: undefined,
    hasSidecar: false,
    layoutTouched: false,
    zoom: 1,
    fitSignal: 0,

    theme: prefs.theme,
    resolvedTheme: resolveTheme(prefs.theme),
    viewMode: 'split',
    fontSize: prefs.fontSize,
    edgeStyle: prefs.edgeStyle,
    showRelationLabels: prefs.showRelationLabels,
    showColumnTypes: prefs.showColumnTypes,
    sidebarCollapsed: prefs.sidebarCollapsed,
    backup: prefs.backup,
    autoSave: prefs.autoSave,

    problemsOpen: false,
    settingsOpen: false,
    shortcutsOpen: false,
    exportOpen: false,
    recoveryOpen: false,
    unsavedOpen: false,
    pendingAction: null,
    confirm: null,
    contextMenu: null,
    toasts: [],
    recent: [],
    recoveries: [],

    initialize: async () => {
      if (get().ready) return;
      let recent: RecentFile[] = [];
      let recoveries: RecoveryMeta[] = [];
      try {
        [recent, recoveries] = await Promise.all([
          platform.listRecentFiles(),
          platform.listRecovery(),
        ]);
      } catch {
        // Start with an empty workspace if local metadata cannot be read.
      }
      set({
        ready: true,
        recent,
        recoveries,
        recoveryOpen: recoveries.length > 0,
        resolvedTheme: resolveTheme(get().theme),
      });
    },

    updateContent: (content) => {
      const state = get();
      const dirty = content !== state.savedContent;
      set({
        content,
        dirty,
        parsing: true,
        saveState: dirty ? 'unsaved' : 'saved',
      });
      if (parseTimer) clearTimeout(parseTimer);
      parseTimer = setTimeout(() => {
        parseTimer = undefined;
        get().parseNow();
      }, 180);
      scheduleRecovery(get);
      scheduleAutoSave(get);
    },

    parseNow: () => {
      if (parseTimer) {
        clearTimeout(parseTimer);
        parseTimer = undefined;
      }
      const state = get();
      if (state.content === state.parsedContent) {
        set({ parsing: false });
        return;
      }
      const started = performance.now();
      const result = parseDbml(state.content);
      const view = result.valid ? buildViewModel(result.db, state.content) : state.view;
      const layout = result.valid ? reconcileLayout(view, state.layout) : state.layout;

      let selection = state.selection;
      if (selection?.type === 'table' && result.valid && !view.tableMap.has(selection.key)) {
        selection = null;
      }
      if (selection?.type === 'ref' && result.valid && !view.refMap.has(selection.edgeId)) {
        selection = null;
      }
      const selectedColumn =
        selection?.type === 'table' && state.selectedColumn
          ? state.selectedColumn
          : null;
      const cursorTable =
        view.tables.find(
          (table) => state.cursor.line >= table.line && state.cursor.line <= table.endLine,
        )?.key ?? null;

      set({
        db: result.db,
        view,
        valid: result.valid,
        problems: result.problems,
        markers: result.markers,
        parsing: false,
        parsedContent: state.content,
        lastParseMs: Math.round(performance.now() - started),
        layout,
        selection,
        selectedColumn,
        cursorTableKey: cursorTable,
      });

      if (!result.valid) return;

      const current = get();
      if (current.pendingTableSelection) {
        const key = current.pendingTableSelection;
        if (view.tableMap.has(key)) {
          const pendingColumn = current.pendingColumnSelection;
          const columnExists =
            pendingColumn &&
            view.tableMap.get(key)?.columns.some((column) => column.name === pendingColumn);
          set({
            selection: { type: 'table', key },
            selectedColumn: columnExists ? pendingColumn : null,
            pendingTableSelection: null,
            pendingColumnSelection: null,
          });
        }
      }
      if (current.pendingRefSelection) {
        const pending = current.pendingRefSelection;
        const ref = view.refs.find(
          (item) =>
            item.left.tableKey === pending.fromTableKey &&
            item.left.fieldNames[0] === pending.fromColumn &&
            item.right.tableKey === pending.toTableKey &&
            item.right.fieldNames[0] === pending.toColumn,
        );
        if (ref) {
          set({
            selection: { type: 'ref', edgeId: ref.id },
            selectedColumn: null,
            pendingRefSelection: null,
          });
        }
      }
      void get().ensureLayout();
    },

    ensureLayout: async () => {
      const state = get();
      if (!state.valid || state.view.tables.length === 0) {
        set({ layoutBusy: false });
        return;
      }
      const missing = missingTableKeys(state.view, state.layout);
      if (missing.length === 0) return;

      const hadPositions = Object.keys(state.layout).length > 0;
      const docId = state.docId;
      const sidecar = state.hasSidecar;
      const generation = ++layoutGeneration;
      set({ layoutBusy: true });

      try {
        const result = await autoLayout(state.view, state.layoutDirection, state.layout, {
          preserveExisting: hadPositions,
          missingOnly: missing,
        });
        if (generation !== layoutGeneration || get().docId !== docId) return;
        set({
          layout: result.positions,
          layoutBusy: false,
          fitSignal:
            !state.viewport && !sidecar ? get().fitSignal + 1 : get().fitSignal,
        });
        if (sidecar) {
          await get().persistLayoutNow();
        }
      } catch (error) {
        if (generation !== layoutGeneration || get().docId !== docId) return;
        const fallback: Record<string, TableLayout> = { ...state.layout };
        let x = 80;
        let y = 80;
        for (const key of missing) {
          fallback[key] = { x, y };
          x += 300;
          if (x > 1200) {
            x = 80;
            y += 220;
          }
        }
        set({ layout: fallback, layoutBusy: false });
          get().showToast('error', `自动布局失败：${errorMessage(error)}`);
      }
    },

    newDocument: (templateId = 'blank') => {
      const state = get();
      const template = findTemplate(templateId);
      const content = template.content;
      const contentDirty = content.length > 0;
      const reusePristine = isPristineDocument(state);

      let docId: string;
      let docName: string;
      let tabs: TabMeta[];
      let inactiveDocs = state.inactiveDocs;

      if (reusePristine) {
        docId = state.docId;
        docName = nextUntitledName(state.tabs, docId);
        tabs = state.tabs.map((tab) =>
          tab.docId === docId
            ? {
                ...tab,
                docName,
                dirty: contentDirty,
                saveState: contentDirty ? 'unsaved' : 'saved',
              }
            : tab,
        );
      } else {
        if (state.screen === 'workspace') {
          if (parseTimer) {
            clearTimeout(parseTimer);
            parseTimer = undefined;
            get().parseNow();
          }
          const previous = snapshotFromState(get());
          flushDocument(previous);
          inactiveDocs = { ...inactiveDocs, [previous.docId]: previous };
          tabs = get().tabs.map((tab) =>
            tab.docId === previous.docId ? tabFromSnapshot(previous) : tab,
          );
        } else {
          tabs = state.tabs;
        }
        docId = untitledId();
        docName = nextUntitledName(tabs);
        tabs = [
          ...tabs,
          {
            docId,
            docPath: null,
            docName,
            dirty: contentDirty,
            saveState: contentDirty ? 'unsaved' : 'saved',
          },
        ];
      }

      clearTimers();
      layoutGeneration += 1;
      resetEngine(content);
      set({
        screen: 'workspace',
        tabs,
        inactiveDocs,
        docPath: null,
        docName,
        docId,
        editorEpoch: get().editorEpoch + 1,
        content,
        savedContent: '',
        parsedContent: '__pending__',
        eol: '\n',
        dirty: contentDirty,
        db: null,
        view: EMPTY_VIEW,
        valid: true,
        problems: [],
        markers: [],
        parsing: true,
        lastParseMs: 0,
        lastSavedAt: null,
        saveState: contentDirty ? 'unsaved' : 'saved',
        selection: null,
        selectedColumn: null,
        layout: {},
        viewport: undefined,
        hasSidecar: false,
        layoutTouched: false,
        zoom: 1,
        fitSignal: get().fitSignal + 1,
        problemsOpen: false,
        recoveryOpen: false,
        unsavedOpen: false,
        pendingAction: null,
        contextMenu: null,
        confirm: null,
        cursor: { line: 1, column: 1 },
        cursorTableKey: null,
        pendingTableSelection: null,
        pendingColumnSelection: null,
        pendingRefSelection: null,
      });
      get().parseNow();
      if (contentDirty) scheduleRecovery(get);
      if (templateId !== 'blank') {
        get().showToast('info', `已从「${template.name}」创建文档`);
      }
    },

    requestNew: (templateId = 'blank') => {
      get().newDocument(templateId);
    },

    openFileDialog: async () => {
      try {
        const picked = await platform.pickOpenFile();
        if (!picked) return;
        await get().openPath(picked.path);
      } catch (error) {
        get().showToast('error', `打开文件失败：${errorMessage(error)}`);
      }
    },

    requestOpen: () => {
      void get().openFileDialog();
    },

    openPath: async (path) => {
      const existing = get().tabs.find(
        (tab) => tab.docPath && tab.docPath === path,
      );
      if (existing) {
        if (existing.docId !== get().docId) {
          activateDocument(existing.docId);
          get().showToast('info', '该文件已在标签页中打开');
        } else {
          get().showToast('info', '该文件已经是最前标签页');
        }
        return;
      }
      try {
        const [snapshot, layoutFile] = await Promise.all([
          platform.readTextFile(path),
          platform.loadLayout(path).catch(() => null),
        ]);
        await get().adoptDocument({
          path,
          name: platform.baseName(path),
          content: snapshot.content,
          savedContent: snapshot.content,
          layoutFile,
          docId: path,
        });
      } catch (error) {
        get().showToast('error', `无法打开文件：${errorMessage(error)}`);
      }
    },

    requestOpenPath: (path) => {
      void get().openPath(path);
    },

    resetWorkspace: () => {
      clearTimers();
      layoutGeneration += 1;
      resetEngine('');
      set({
        screen: 'welcome',
        tabs: [],
        inactiveDocs: {},
        docPath: null,
        docName: '未命名.dbml',
        docId: untitledId(),
        editorEpoch: get().editorEpoch + 1,
        content: '',
        savedContent: '',
        parsedContent: '',
        eol: '\n',
        dirty: false,
        db: null,
        view: EMPTY_VIEW,
        valid: true,
        problems: [],
        markers: [],
        parsing: false,
        lastParseMs: 0,
        lastSavedAt: null,
        saveState: 'saved',
        layoutBusy: false,
        selection: null,
        selectedColumn: null,
        layout: {},
        viewport: undefined,
        hasSidecar: false,
        layoutTouched: false,
        zoom: 1,
        recoveryOpen: false,
        unsavedOpen: false,
        pendingAction: null,
        confirm: null,
        contextMenu: null,
        cursor: { line: 1, column: 1 },
        cursorTableKey: null,
        pendingTableSelection: null,
        pendingColumnSelection: null,
        pendingRefSelection: null,
      });
    },

    activateTab: (docId) => {
      activateDocument(docId);
    },

    requestCloseTab: (docId) => {
      const state = get();
      if (!state.tabs.some((tab) => tab.docId === docId)) return;
      const dirty =
        state.docId === docId ? state.dirty : Boolean(state.inactiveDocs[docId]?.dirty);
      if (!dirty) {
        closeTabNow(docId);
        return;
      }
      if (state.docId !== docId) activateDocument(docId);
      set({ pendingAction: { type: 'closeTab', docId }, unsavedOpen: true });
    },

    requestCloseActiveTab: () => {
      const state = get();
      if (state.screen !== 'workspace' || state.tabs.length === 0) {
        void get().requestCloseWindow();
        return;
      }
      get().requestCloseTab(state.docId);
    },

    requestWelcome: () => {
      if (collectDirtyDocIds(get()).length > 0) {
        set({ pendingAction: { type: 'welcome' }, unsavedOpen: true });
        return;
      }
      const docIds = get().tabs.map((tab) => tab.docId);
      for (const docId of docIds) {
        void platform.discardRecovery(docId).catch(() => undefined);
      }
      set({
        recoveries: get().recoveries.filter(
          (item) => !docIds.includes(item.docId),
        ),
      });
      get().resetWorkspace();
    },

    requestCloseWindow: async () => {
      if (collectDirtyDocIds(get()).length > 0) {
        set({ pendingAction: { type: 'close' }, unsavedOpen: true });
        return;
      }
      await get().performClose();
    },

    performClose: async () => {
      await get().performQuit();
    },

    requestQuit: async () => {
      if (collectDirtyDocIds(get()).length > 0) {
        set({ pendingAction: { type: 'quit' }, unsavedOpen: true });
        return;
      }
      await get().performQuit();
    },

    performQuit: async () => {
      const state = get();
      if (collectDirtyDocIds(state).length > 0) {
        set({ pendingAction: { type: 'quit' }, unsavedOpen: true });
        return;
      }
      const docIds = new Set(state.tabs.map((tab) => tab.docId));
      if (state.screen === 'workspace') docIds.add(state.docId);
      try {
        await Promise.all(
          [...docIds].map((docId) =>
            platform.discardRecovery(docId).catch(() => undefined),
          ),
        );
        set({
          recoveries: get().recoveries.filter(
            (item) => !docIds.has(item.docId),
          ),
        });
      } catch {
        // ignore
      }
      if (platform.isTauri()) {
        try {
          await platform.quitApp();
        } catch (error) {
          get().showToast('error', `退出失败：${errorMessage(error)}`);
        }
      } else {
        get().resetWorkspace();
      }
    },

    resolveUnsaved: async (choice) => {
      const pending = get().pendingAction;
      if (choice === 'cancel') {
        set({ unsavedOpen: false, pendingAction: null });
        return;
      }
      const targetIds =
        pending?.type === 'closeTab'
          ? [pending.docId]
          : collectDirtyDocIds(get());

      if (choice === 'save') {
        for (const docId of targetIds) {
          if (!get().tabs.some((tab) => tab.docId === docId)) continue;
          if (get().docId !== docId) activateDocument(docId);
          const saved = await get().save(false);
          if (!saved) return;
        }
      } else {
        for (const docId of targetIds) {
          try {
            await platform.discardRecovery(docId);
          } catch {
            // ignore
          }
        }
        if (targetIds.length > 0) {
          set({
            recoveries: get().recoveries.filter(
              (item) => !targetIds.includes(item.docId),
            ),
          });
        }
      }

      set({ unsavedOpen: false, pendingAction: null });
      if (!pending) return;
      if (pending.type === 'closeTab') {
        closeTabNow(pending.docId);
      } else if (pending.type === 'welcome') {
        const docIds = get().tabs.map((tab) => tab.docId);
        for (const docId of docIds) {
          void platform.discardRecovery(docId).catch(() => undefined);
        }
        set({
          recoveries: get().recoveries.filter(
            (item) => !docIds.includes(item.docId),
          ),
        });
        get().resetWorkspace();
      } else if (pending.type === 'close' || pending.type === 'quit') {
        await get().performQuit();
      }
    },

    save: async (saveAs = false) => {
      const state = get();
      const docId = state.docId;
      const contentSnapshot = state.content;
      const eol = state.eol;
      let target = state.docPath;
      if (!target || saveAs) {
        const defaultName = platform.pickDefaultSaveName(state.docName);
        try {
          target = await platform.pickSavePath(defaultName, state.docPath);
        } catch (error) {
          get().showToast('error', `无法选择保存位置：${errorMessage(error)}`);
          return false;
        }
        if (!target) {
          if (get().docId === docId) {
            set({ saveState: get().dirty ? 'unsaved' : 'saved' });
          }
          return false;
        }
      }
      if (!target.toLowerCase().endsWith('.dbml')) target = `${target}.dbml`;

      const conflict = get().tabs.find(
        (tab) =>
          tab.docId !== docId &&
          tab.docPath !== null &&
          tab.docPath.toLowerCase() === target!.toLowerCase(),
      );
      if (conflict) {
        const current = get();
        if (current.docId === docId) {
          set({ saveState: current.dirty ? 'unsaved' : 'saved' });
        } else {
          const snapshot = current.inactiveDocs[docId];
          if (snapshot) {
            set({
              inactiveDocs: {
                ...current.inactiveDocs,
                [docId]: {
                  ...snapshot,
                  saveState: snapshot.dirty ? 'unsaved' : 'saved',
                },
              },
            });
          }
        }
        get().showToast('error', '目标路径已在其他标签页中打开');
        return false;
      }

      const layoutSnapshot =
        state.layoutTouched || Object.keys(state.layout).length > 0
          ? {
              layout: state.layout,
              viewport: state.viewport,
              layoutDirection: state.layoutDirection,
            }
          : null;

      const setDocSaveState = (saveState: SaveState) => {
        const current = get();
        if (current.docId === docId) {
          set({ saveState });
          return;
        }
        const snapshot = current.inactiveDocs[docId];
        if (!snapshot) return;
        set({
          inactiveDocs: {
            ...current.inactiveDocs,
            [docId]: { ...snapshot, saveState },
          },
          tabs: current.tabs.map((tab) =>
            tab.docId === docId ? { ...tab, saveState } : tab,
          ),
        });
      };

      setDocSaveState('saving');
      try {
        const result = await platform.writeTextFile(
          target,
          applyEol(contentSnapshot, eol),
          { backup: state.backup },
        );
        const name = platform.baseName(target);
        const savedAt = result.savedAt ?? Date.now();
        const current = get();
        let dirtyNow: boolean | null = null;

        if (current.docId === docId) {
          dirtyNow = current.content !== contentSnapshot;
          set({
            docPath: target,
            docName: name,
            savedContent: contentSnapshot,
            dirty: dirtyNow,
            saveState: dirtyNow ? 'unsaved' : 'saved',
            lastSavedAt: savedAt,
            hasSidecar: current.hasSidecar || Boolean(layoutSnapshot),
          });
          set({
            tabs: get().tabs.map((tab) =>
              tab.docId === docId
                ? {
                    ...tab,
                    docPath: target,
                    docName: name,
                    dirty: dirtyNow!,
                    saveState: dirtyNow ? 'unsaved' : 'saved',
                  }
                : tab,
            ),
          });
        } else {
          const snapshot = current.inactiveDocs[docId];
          if (snapshot) {
            dirtyNow = snapshot.content !== contentSnapshot;
            set({
              inactiveDocs: {
                ...current.inactiveDocs,
                [docId]: {
                  ...snapshot,
                  docPath: target,
                  docName: name,
                  savedContent: contentSnapshot,
                  dirty: dirtyNow,
                  saveState: dirtyNow ? 'unsaved' : 'saved',
                  lastSavedAt: savedAt,
                  hasSidecar: snapshot.hasSidecar || Boolean(layoutSnapshot),
                },
              },
              tabs: current.tabs.map((tab) =>
                tab.docId === docId
                  ? {
                      ...tab,
                      docPath: target,
                      docName: name,
                      dirty: dirtyNow!,
                      saveState: dirtyNow ? 'unsaved' : 'saved',
                    }
                  : tab,
              ),
            });
          }
        }

        if (dirtyNow === false) {
          try {
            await platform.discardRecovery(docId);
            set({
              recoveries: get().recoveries.filter((item) => item.docId !== docId),
            });
          } catch {
            // ignore
          }
        } else if (dirtyNow) {
          if (get().docId === docId) {
            scheduleRecovery(get);
          } else {
            const snapshot = get().inactiveDocs[docId];
            if (snapshot) {
              void platform
                .saveRecovery(docId, target, name, snapshot.content)
                .catch(() => undefined);
            }
          }
        }

        try {
          const recent = await platform.touchRecentFile(target, name);
          set({ recent });
        } catch {
          // ignore
        }

        if (layoutSnapshot) {
          try {
            await platform.saveLayout(
              target,
              newLayoutFile({ docName: name, ...layoutSnapshot }),
            );
            const afterLayout = get();
            if (afterLayout.docId === docId) {
              set({ hasSidecar: true });
            } else if (afterLayout.inactiveDocs[docId]) {
              set({
                inactiveDocs: {
                  ...afterLayout.inactiveDocs,
                  [docId]: { ...afterLayout.inactiveDocs[docId], hasSidecar: true },
                },
              });
            }
          } catch (error) {
            get().showToast('error', `布局保存失败：${errorMessage(error)}`);
          }
        }

        if (get().docId === docId || get().inactiveDocs[docId]) {
          get().showToast('success', '已保存');
        }
        return true;
      } catch (error) {
        setDocSaveState('error');
        get().showToast('error', `保存失败：${errorMessage(error)}`);
        return false;
      }
    },

    saveAs: () => get().save(true),

    removeRecent: async (path) => {
      try {
        const recent = await platform.removeRecentFile(path);
        set({ recent });
      } catch (error) {
        get().showToast('error', `移除失败：${errorMessage(error)}`);
      }
    },

    refreshRecoveries: async () => {
      try {
        const recoveries = await platform.listRecovery();
        set({ recoveries, recoveryOpen: recoveries.length > 0 && get().screen === 'welcome' });
      } catch {
        // ignore
      }
    },

    openRecovery: async (meta) => {
      try {
        const snapshot = await platform.loadRecovery(meta.id);
        let savedContent = '';
        let path: string | null = null;
        let layoutFile: LayoutFile | null = null;
        let name = meta.fileName || '恢复的文档.dbml';
        let eol: Eol = '\n';
        if (snapshot.path) {
          try {
            const file = await platform.readTextFile(snapshot.path);
            savedContent = file.content;
            eol = detectEol(file.content);
            path = snapshot.path;
            name = platform.baseName(snapshot.path);
            layoutFile = await platform.loadLayout(snapshot.path).catch(() => null);
          } catch {
            path = null;
          }
        }
        await get().adoptDocument({
          path,
          name,
          content: applyEol(snapshot.content, eol),
          savedContent,
          layoutFile,
          docId: snapshot.docId,
        });
        set({
          recoveryOpen: false,
          recoveries: get().recoveries.filter((item) => item.docId !== snapshot.docId),
        });
        scheduleRecovery(get);
        get().showToast('success', '已恢复未保存的编辑');
      } catch (error) {
        get().showToast('error', `恢复失败：${errorMessage(error)}`);
      }
    },

    discardRecoveryById: async (docId) => {
      try {
        await platform.discardRecovery(docId);
        const recoveries = get().recoveries.filter((item) => item.docId !== docId);
        set({ recoveries, recoveryOpen: recoveries.length > 0 });
      } catch (error) {
        get().showToast('error', `丢弃快照失败：${errorMessage(error)}`);
      }
    },

    // Internal helper used by openPath/openRecovery, attached below.
    adoptDocument: async (options: {
      path: string | null;
      name: string;
      content: string;
      savedContent: string;
      layoutFile: LayoutFile | null;
      docId: string;
    }) => {
      const state = get();
      const content = normalizeEol(options.content);
      const savedContent = normalizeEol(options.savedContent);
      const dirty = content !== savedContent;
      const replacingActive =
        state.docId === options.docId ||
        (options.path !== null && state.docPath === options.path);
      const reusePristine =
        !replacingActive && isPristineDocument(state);

      if (state.screen === 'workspace' && !replacingActive && !reusePristine) {
        if (parseTimer) {
          clearTimeout(parseTimer);
          parseTimer = undefined;
          get().parseNow();
        }
        const previous = snapshotFromState(get());
        flushDocument(previous);
        set({
          inactiveDocs: { ...get().inactiveDocs, [previous.docId]: previous },
          tabs: get().tabs.map((tab) =>
            tab.docId === previous.docId ? tabFromSnapshot(previous) : tab,
          ),
        });
      }

      const current = get();
      const duplicates = current.tabs.filter(
        (tab) =>
          tab.docId === options.docId ||
          (options.path !== null && tab.docPath === options.path),
      );
      const inactiveDocs = { ...current.inactiveDocs };
      for (const duplicate of duplicates) {
        delete inactiveDocs[duplicate.docId];
      }
      let tabs = current.tabs.filter(
        (tab) => !duplicates.some((duplicate) => duplicate.docId === tab.docId),
      );
      if (reusePristine) {
        tabs = tabs.filter((tab) => tab.docId !== current.docId);
        delete inactiveDocs[current.docId];
        void platform.discardRecovery(current.docId).catch(() => undefined);
      }

      const newTab: TabMeta = {
        docId: options.docId,
        docPath: options.path,
        docName: options.name,
        dirty,
        saveState: dirty ? 'unsaved' : 'saved',
      };
      tabs = [...tabs, newTab];

      clearTimers();
      layoutGeneration += 1;
      resetEngine(content);
      set({
        screen: 'workspace',
        tabs,
        inactiveDocs,
        docPath: options.path,
        docName: options.name,
        docId: options.docId,
        editorEpoch: current.editorEpoch + 1,
        content,
        savedContent,
        parsedContent: '__pending__',
        eol: detectEol(options.content),
        dirty,
        db: null,
        view: EMPTY_VIEW,
        valid: true,
        problems: [],
        markers: [],
        parsing: true,
        lastParseMs: 0,
        saveState: dirty ? 'unsaved' : 'saved',
        lastSavedAt: dirty ? null : Date.now(),
        layoutBusy: false,
        selection: null,
        selectedColumn: null,
        cursor: { line: 1, column: 1 },
        cursorTableKey: null,
        layout: options.layoutFile?.tables ?? {},
        layoutDirection:
          options.layoutFile?.layoutDirection ?? current.layoutDirection,
        viewport: options.layoutFile?.viewport,
        hasSidecar: Boolean(options.layoutFile),
        layoutTouched: Boolean(options.layoutFile),
        zoom: options.layoutFile?.viewport?.zoom ?? 1,
        fitSignal: options.layoutFile?.viewport
          ? current.fitSignal
          : current.fitSignal + 1,
        problemsOpen: false,
        recoveryOpen: false,
        unsavedOpen: false,
        pendingAction: null,
        contextMenu: null,
        confirm: null,
        pendingTableSelection: null,
        pendingColumnSelection: null,
        pendingRefSelection: null,
      });
      get().parseNow();
      if (dirty) {
        scheduleRecovery(get);
      } else {
        try {
          await platform.discardRecovery(options.docId);
          set({
            recoveries: get().recoveries.filter(
              (item) => item.docId !== options.docId,
            ),
          });
        } catch {
          // ignore
        }
      }
      if (options.path) {
        try {
          const recent = await platform.touchRecentFile(options.path, options.name);
          set({ recent });
        } catch {
          // ignore
        }
      }
    },

    setTheme: (theme) => {
      set({ theme, resolvedTheme: resolveTheme(theme) });
      savePrefs(get());
    },
    setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
    setViewMode: (viewMode) => set({ viewMode }),
    setFontSize: (fontSize) => {
      set({ fontSize });
      savePrefs(get());
    },
    setEdgeStyle: (edgeStyle) => {
      set({ edgeStyle });
      savePrefs(get());
    },
    setShowRelationLabels: (showRelationLabels) => {
      set({ showRelationLabels });
      savePrefs(get());
    },
    setShowColumnTypes: (showColumnTypes) => {
      set({ showColumnTypes });
      savePrefs(get());
    },
    setLayoutDirection: (layoutDirection) => {
      set({ layoutDirection });
      savePrefs(get());
    },
    setBackup: (backup) => {
      set({ backup });
      savePrefs(get());
    },
    setAutoSave: (autoSave) => {
      set({ autoSave });
      savePrefs(get());
    },
    toggleSidebar: () => {
      set({ sidebarCollapsed: !get().sidebarCollapsed });
      savePrefs(get());
    },
    toggleProblems: () => set({ problemsOpen: !get().problemsOpen }),
    setSettingsOpen: (settingsOpen) => set({ settingsOpen, contextMenu: null }),
    setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen, contextMenu: null }),
    setExportOpen: (exportOpen) => set({ exportOpen, contextMenu: null }),
    setRecoveryOpen: (recoveryOpen) => set({ recoveryOpen }),
    setUnsavedOpen: (unsavedOpen) => set({ unsavedOpen }),
    dismissContextMenu: () => set({ contextMenu: null }),
    setContextMenu: (contextMenu) => set({ contextMenu }),
    setConfirm: (confirm) => set({ confirm }),
    showToast: (kind, message) => {
      const id = ++toastSequence;
      set({ toasts: [...get().toasts, { id, kind, message }] });
      setTimeout(() => {
        set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
      }, 3600);
    },
    dismissToast: (id) =>
      set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),

    selectTable: (key, options = {}) => {
      const state = get();
      const table = state.view.tableMap.get(key);
      if (!table) return;
      const column = options.column ?? null;
      set({ selection: { type: 'table', key }, selectedColumn: column });
      if (options.reveal) {
        const offset = column
          ? table.columns.find((item) => item.name === column)?.offset ?? table.offset
          : table.offset;
        editorBridge.revealOffset(offset);
      }
      if (options.focus) diagramBridge.focusTable(key);
    },

    selectColumn: (tableKey, columnName, reveal = false) => {
      get().selectTable(tableKey, { reveal, column: columnName });
    },

    selectRef: (id, options = {}) => {
      const state = get();
      const ref = state.view.refMap.get(id);
      if (!ref) return;
      set({ selection: { type: 'ref', edgeId: id }, selectedColumn: null });
      if (options.reveal) editorBridge.revealOffset(ref.offset);
      if (options.focus) {
        diagramBridge.focusTables([ref.left.tableKey, ref.right.tableKey]);
      }
    },

    clearSelection: () => set({ selection: null, selectedColumn: null }),

    setCursor: (cursor) => {
      const state = get();
      const table = state.view.tables.find(
        (item) => cursor.line >= item.line && cursor.line <= item.endLine,
      );
      set({ cursor, cursorTableKey: table?.key ?? null });
    },

    revealTableInEditor: (key) => {
      const table = get().view.tableMap.get(key);
      if (table) editorBridge.revealOffset(table.offset);
    },

    revealRefInEditor: (id) => {
      const ref = get().view.refMap.get(id);
      if (ref) editorBridge.revealOffset(ref.offset);
    },

    createTableAt: (name) => {
      const state = requireEditable(get);
      if (!state) return;
      const outcome = createTable(state.content, state.view, name);
      if (outcome.message && outcome.edits.length === 0) {
        get().showToast('error', outcome.message);
        return;
      }
      if (!applyEdits(get, outcome.edits)) return;
      if (outcome.tableKey) {
        set({
          pendingTableSelection: outcome.tableKey,
          pendingColumnSelection: null,
        });
      }
      if (outcome.message) get().showToast('success', outcome.message);
    },

    addColumnToTable: (tableKey) => {
      const state = requireEditable(get);
      if (!state) return;
      const table = state.view.tableMap.get(tableKey);
      if (!table) return;
      const outcome = addColumn(state.content, table);
      if (outcome.edits.length === 0) {
        if (outcome.message) get().showToast('error', outcome.message);
        return;
      }
      if (!applyEdits(get, outcome.edits)) return;
      set({
        pendingTableSelection: tableKey,
        pendingColumnSelection: outcome.columnName ?? null,
      });
      if (outcome.message) get().showToast('success', outcome.message);
    },

    renameTable: (key, newName) => {
      const state = requireEditable(get);
      if (!state) return;
      const table = state.view.tableMap.get(key);
      if (!table) return;
      const trimmed = newName.trim();
      if (!trimmed || trimmed === table.name) return;
      if (!isValidIdentifier(trimmed)) {
        get().showToast('error', '表名只能包含字母、数字、下划线，且不能以数字开头');
        return;
      }
      const nextKey = makeTableKey(table.schemaName === 'public' ? null : table.schemaName, trimmed);
      if (state.view.tableMap.has(nextKey)) {
        get().showToast('error', '同 schema 下已存在同名表');
        return;
      }
      const result = renameTableInSource(
        state.content,
        table.schemaName === 'public' ? null : table.schemaName,
        table.name,
        trimmed,
      );
      if ('error' in result) {
        get().showToast('error', `表改名失败：${result.error}`);
        return;
      }
      if (!editorBridge.isReady()) {
        get().showToast('error', '编辑器尚未准备好');
        return;
      }
      const oldKey = table.key;
      const nextLayout = { ...state.layout };
      if (nextLayout[oldKey]) {
        nextLayout[nextKey] = nextLayout[oldKey];
        delete nextLayout[oldKey];
      }
      set({
        layout: nextLayout,
        layoutTouched: true,
        selection: { type: 'table', key: nextKey },
        selectedColumn: null,
        pendingTableSelection: nextKey,
      });
      editorBridge.applyFullText(result.text);
      if (state.hasSidecar) void get().persistLayoutNow();
      get().showToast('success', `表已重命名为 ${trimmed}`);
    },

    renameColumnInTable: (tableKey, columnName, newName) => {
      const state = requireEditable(get);
      if (!state) return;
      const table = state.view.tableMap.get(tableKey);
      const column = table?.columns.find((item) => item.name === columnName);
      if (!table || !column) return;
      if (newName.trim() === column.name) return;
      const outcome = renameColumn(state.content, state.view, table, column, newName);
      if (outcome.edits.length === 0) {
        if (outcome.message) get().showToast('error', outcome.message);
        return;
      }
      if (!applyEdits(get, outcome.edits)) return;
      set({
        selectedColumn: outcome.columnName ?? columnName,
        pendingTableSelection: tableKey,
        pendingColumnSelection: outcome.columnName ?? null,
      });
      get().showToast('success', outcome.message ?? '已重命名列');
    },

    commitTableNote: (key, note) => {
      const state = requireEditable(get);
      if (!state) return;
      const table = state.view.tableMap.get(key);
      if (!table) return;
      applyEdits(get, setTableNote(state.content, table, note));
    },

    commitTableColor: (key, color) => {
      const state = requireEditable(get);
      if (!state) return;
      const table = state.view.tableMap.get(key);
      if (!table) return;
      applyEdits(get, setTableColor(state.content, table, color));
    },

    commitColumnType: (tableKey, columnName, typeName) => {
      const state = requireEditable(get);
      if (!state) return;
      const column = state.view.tableMap.get(tableKey)?.columns.find(
        (item) => item.name === columnName,
      );
      if (!column) return;
      applyEdits(get, setColumnType(state.content, column, typeName));
    },

    commitColumnFlag: (tableKey, columnName, flag, value) => {
      const state = requireEditable(get);
      if (!state) return;
      const column = state.view.tableMap.get(tableKey)?.columns.find(
        (item) => item.name === columnName,
      );
      if (!column) return;
      applyEdits(get, setColumnSetting(state.content, column, flag, value ? true : null));
    },

    commitColumnDefault: (tableKey, columnName, value) => {
      const state = requireEditable(get);
      if (!state) return;
      const column = state.view.tableMap.get(tableKey)?.columns.find(
        (item) => item.name === columnName,
      );
      if (!column) return;
      const formatted = value.trim() ? formatDefaultValue(value) : null;
      applyEdits(get, setColumnSetting(state.content, column, 'default', formatted));
    },

    commitColumnNote: (tableKey, columnName, value) => {
      const state = requireEditable(get);
      if (!state) return;
      const column = state.view.tableMap.get(tableKey)?.columns.find(
        (item) => item.name === columnName,
      );
      if (!column) return;
      const trimmed = value.trim();
      applyEdits(
        get,
        setColumnSetting(state.content, column, 'note', trimmed ? quoteString(trimmed) : null),
      );
    },

    createRef: (fromTableKey, fromColumn, toTableKey, toColumn) => {
      const state = requireEditable(get);
      if (!state) return;
      const fromTable = state.view.tableMap.get(fromTableKey);
      const toTable = state.view.tableMap.get(toTableKey);
      const source = fromTable?.columns.find((column) => column.name === fromColumn);
      if (!fromTable || !toTable || !source) return;
      if (fromTableKey === toTableKey && fromColumn === toColumn) {
        get().showToast('error', '不能将列关联到自身');
        return;
      }
      const duplicate = state.view.refs.find(
        (ref) =>
          ref.left.tableKey === fromTableKey &&
          ref.left.fieldNames[0] === fromColumn &&
          ref.right.tableKey === toTableKey &&
          ref.right.fieldNames[0] === toColumn,
      );
      if (duplicate) {
        set({ selection: { type: 'ref', edgeId: duplicate.id }, selectedColumn: null });
        get().showToast('info', '关系已存在');
        return;
      }
      const op = source.notNull ? '>' : '>?';
      const outcome = addRef(
        state.content,
        fromTable,
        fromColumn,
        toTable,
        toColumn,
        op,
      );
      if (!applyEdits(get, outcome.edits)) return;
      set({
        pendingRefSelection: {
          fromTableKey,
          fromColumn,
          toTableKey,
          toColumn,
        },
      });
      get().showToast('success', outcome.message ?? '已创建关系');
    },

    commitRefRelation: (refId, op) => {
      const state = requireEditable(get);
      if (!state) return;
      const ref = state.view.refMap.get(refId);
      if (!ref) return;
      applyEdits(get, setRefRelation(state.content, ref, op));
    },

    commitRefSetting: (refId, name, value) => {
      const state = requireEditable(get);
      if (!state) return;
      const ref = state.view.refMap.get(refId);
      if (!ref) return;
      const outcome = setRefSetting(state.content, ref, name, value);
      if (outcome.edits.length === 0) {
        if (outcome.message) get().showToast('info', outcome.message);
        return;
      }
      applyEdits(get, outcome.edits);
    },

    requestDeleteTable: (key) => {
      const state = ensureCurrent(get);
      if (!state.valid) {
        get().showToast('error', 'DBML 存在语法错误，修复后才能删除结构');
        return;
      }
      const table = state.view.tableMap.get(key);
      if (!table) return;
      const refs = state.view.refs.filter(
        (ref) => ref.left.tableKey === key || ref.right.tableKey === key,
      );
      const body =
        refs.length > 0
          ? `表「${table.name}」被 ${refs.length} 条关系引用，删除时会一并移除这些关系。此操作可通过撤销恢复。`
          : `将删除表「${table.name}」及其字段。此操作可通过撤销恢复。`;
      set({
        confirm: {
          title: '删除表',
          body,
          confirmLabel: '删除表',
          danger: true,
          onConfirm: () => {
            const current = requireEditable(get);
            if (!current) return;
            const target = current.view.tableMap.get(key);
            if (!target) return;
            const outcome = deleteTable(current.content, current.view, target);
            if (!applyEdits(get, outcome.edits)) return;
            const layout = { ...current.layout };
            delete layout[key];
            set({
              layout,
              selection: null,
              selectedColumn: null,
              layoutTouched: true,
            });
            if (current.hasSidecar) void get().persistLayoutNow();
            get().showToast('success', outcome.message ?? '已删除表');
          },
        },
      });
    },

    requestDeleteColumn: (tableKey, columnName) => {
      const state = ensureCurrent(get);
      if (!state.valid) {
        get().showToast('error', 'DBML 存在语法错误，修复后才能删除结构');
        return;
      }
      const table = state.view.tableMap.get(tableKey);
      const column = table?.columns.find((item) => item.name === columnName);
      if (!table || !column) return;
      const refs = state.view.refs.filter((ref) =>
        [ref.left, ref.right].some(
          (endpoint) =>
            endpoint.tableKey === tableKey && endpoint.fieldNames.includes(columnName),
        ),
      );
      const body =
        refs.length > 0
          ? `列「${column.name}」被 ${refs.length} 条关系引用，删除时会一并移除这些关系。此操作可通过撤销恢复。`
          : `将删除列「${column.name}」。此操作可通过撤销恢复。`;
      set({
        confirm: {
          title: '删除列',
          body,
          confirmLabel: '删除列',
          danger: true,
          onConfirm: () => {
            const current = requireEditable(get);
            if (!current) return;
            const targetTable = current.view.tableMap.get(tableKey);
            const targetColumn = targetTable?.columns.find((item) => item.name === columnName);
            if (!targetTable || !targetColumn) return;
            const outcome = deleteColumn(current.content, current.view, targetTable, targetColumn);
            if (!applyEdits(get, outcome.edits)) return;
            set({ selectedColumn: null });
            get().showToast('success', outcome.message ?? '已删除列');
          },
        },
      });
    },

    requestDeleteRef: (refId) => {
      const state = ensureCurrent(get);
      if (!state.valid) {
        get().showToast('error', 'DBML 存在语法错误，修复后才能删除关系');
        return;
      }
      const ref = state.view.refMap.get(refId);
      if (!ref) return;
      set({
        confirm: {
          title: '删除关系',
          body: '将删除这条关系。此操作可通过撤销恢复。',
          confirmLabel: '删除关系',
          danger: true,
          onConfirm: () => {
            const current = requireEditable(get);
            if (!current) return;
            const target = current.view.refMap.get(refId);
            if (!target) return;
            const outcome = deleteRef(current.content, current.view, target);
            if (!applyEdits(get, outcome.edits)) return;
            set({ selection: null, selectedColumn: null });
            get().showToast('success', outcome.message ?? '已删除关系');
          },
        },
      });
    },

    deleteSelection: () => {
      const selection = get().selection;
      if (!selection) return;
      if (selection.type === 'table') {
        get().requestDeleteTable(selection.key);
      } else {
        get().requestDeleteRef(selection.edgeId);
      }
    },

    applyQuickFix: (fix) => {
      if (!editorBridge.isReady()) return;
      editorBridge.applyQuickFix(fix);
      get().showToast('success', fix.shortTitle || fix.title);
    },

    setNodePositions: (positions) => {
      const state = get();
      if (!state.valid) return;
      set({
        layout: { ...state.layout, ...positions },
        layoutTouched: true,
      });
      if (state.docPath) void get().persistLayoutNow();
    },

    setViewport: (viewport, persist = true) => {
      set({ viewport, zoom: viewport.zoom });
      if (persist && get().docPath) {
        set({ layoutTouched: true });
        get().schedulePersistLayout();
      }
    },

    runAutoLayout: async () => {
      const state = ensureCurrent(get);
      if (!state.valid) {
        get().showToast('error', 'DBML 存在语法错误，修复后才能自动布局');
        return;
      }
      if (state.view.tables.length === 0) {
        get().showToast('info', '当前没有可布局的表');
        return;
      }
      const generation = ++layoutGeneration;
      const docId = state.docId;
      set({ layoutBusy: true });
      try {
        const result = await autoLayout(
          state.view,
          state.layoutDirection,
          {},
          { preserveExisting: false },
        );
        if (generation !== layoutGeneration || get().docId !== docId) return;
        set({
          layout: result.positions,
          layoutBusy: false,
          layoutTouched: true,
          fitSignal: get().fitSignal + 1,
        });
        if (state.docPath) await get().persistLayoutNow();
        get().showToast('success', '布局已重新整理');
      } catch (error) {
        set({ layoutBusy: false });
        get().showToast('error', `自动布局失败：${errorMessage(error)}`);
      }
    },

    persistLayoutNow: async () => {
      if (layoutTimer) {
        clearTimeout(layoutTimer);
        layoutTimer = undefined;
      }
      const state = get();
      if (!state.docPath) return;
      const docId = state.docId;
      const path = state.docPath;
      try {
        await platform.saveLayout(path, newLayoutFile(state));
        const current = get();
        if (current.docId === docId) {
          set({ hasSidecar: true });
        } else if (current.inactiveDocs[docId]) {
          set({
            inactiveDocs: {
              ...current.inactiveDocs,
              [docId]: { ...current.inactiveDocs[docId], hasSidecar: true },
            },
          });
        }
      } catch (error) {
        get().showToast('error', `布局保存失败：${errorMessage(error)}`);
      }
    },

    schedulePersistLayout: () => {
      if (layoutTimer) clearTimeout(layoutTimer);
      layoutTimer = setTimeout(() => {
        layoutTimer = undefined;
        void get().persistLayoutNow();
      }, 500);
    },

    requestFitView: () => set({ fitSignal: get().fitSignal + 1 }),
  };
});
