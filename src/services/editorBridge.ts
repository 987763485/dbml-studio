import type { SourceEdit } from '../core/edits';
import type { QuickFix } from '../types';

export interface EditorBridge {
  applyEdits(edits: SourceEdit[]): void;
  applyQuickFix(fix: QuickFix): void;
  applyFullText(text: string): void;
  revealOffset(offset: number, endOffset?: number): void;
  focus(): void;
  undo(): void;
  redo(): void;
  find(): void;
  getContent(): string;
}

let current: EditorBridge | null = null;

export function registerEditorBridge(bridge: EditorBridge | null): void {
  current = bridge;
}

export const editorBridge = {
  applyEdits(edits: SourceEdit[]): void {
    current?.applyEdits(edits);
  },
  applyQuickFix(fix: QuickFix): void {
    current?.applyQuickFix(fix);
  },
  applyFullText(text: string): void {
    current?.applyFullText(text);
  },
  revealOffset(offset: number, endOffset?: number): void {
    current?.revealOffset(offset, endOffset);
  },
  focus(): void {
    current?.focus();
  },
  undo(): void {
    current?.undo();
  },
  redo(): void {
    current?.redo();
  },
  find(): void {
    current?.find();
  },
  getContent(): string {
    return current?.getContent() ?? '';
  },
  isReady(): boolean {
    return current !== null;
  },
};
