import type { Database } from '@dbml/parse';

export type DbmlDatabase = Database;
export type ThemeMode = 'light' | 'dark' | 'system';
export type ViewMode = 'split' | 'editor' | 'canvas';
export type ProblemSeverity = 'error' | 'warning' | 'info';

export interface QuickFixEdit {
  start: number;
  end: number;
  newText: string;
}

export interface QuickFix {
  title: string;
  shortTitle?: string;
  edits: QuickFixEdit[];
  isPreferred?: boolean;
}

export interface Problem {
  severity: ProblemSeverity;
  message: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  code?: string | number;
  quickFixes?: QuickFix[];
}

export interface TableLayout {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface LayoutFile {
  version: 1;
  document: string;
  tables: Record<string, TableLayout>;
  viewport?: Viewport;
  layoutDirection?: 'RIGHT' | 'DOWN';
  updatedAt: string;
}

export interface RecentFile {
  path: string;
  name: string;
  lastOpened: number;
  exists?: boolean;
}

export interface RecoveryMeta {
  id: string;
  docId: string;
  path: string | null;
  fileName: string;
  savedAt: number;
}

export interface RecoverySnapshot extends RecoveryMeta {
  content: string;
}

export interface FileSnapshot {
  path: string;
  content: string;
  modifiedAt?: number | null;
  size: number;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

export interface OpenFileResult {
  path: string;
  name: string;
  content: string;
  modifiedAt?: number | null;
}

export interface TableSelection {
  type: 'table';
  key: string;
}

export interface RefSelection {
  type: 'ref';
  edgeId: string;
}

export type Selection = TableSelection | RefSelection | null;

export interface ContextMenuState {
  x: number;
  y: number;
  kind: 'table' | 'ref' | 'pane';
  id?: string;
}
