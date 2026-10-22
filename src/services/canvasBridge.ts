export interface PngExportOptions {
  scope: 'full' | 'view';
  scale: 1 | 2;
  transparent: boolean;
  padding: number;
}

export interface CanvasBridge {
  exportPng(options: PngExportOptions): Promise<string>;
}

let current: CanvasBridge | null = null;

export function registerCanvasBridge(bridge: CanvasBridge | null): void {
  current = bridge;
}

export const canvasBridge = {
  async exportPng(options: PngExportOptions): Promise<string> {
    if (!current) throw new Error('画布尚未准备好');
    return current.exportPng(options);
  },
  isReady(): boolean {
    return current !== null;
  },
};
