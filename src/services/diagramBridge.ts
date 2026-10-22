export interface DiagramBridge {
  focusTable(key: string): void;
  focusTables(keys: string[]): void;
  fitView(): void;
  zoomIn(): void;
  zoomOut(): void;
  zoomTo(value: number): void;
  getZoom(): number;
}

let current: DiagramBridge | null = null;

export function registerDiagramBridge(bridge: DiagramBridge | null): void {
  current = bridge;
}

export const diagramBridge = {
  focusTable(key: string): void {
    current?.focusTable(key);
  },
  focusTables(keys: string[]): void {
    current?.focusTables(keys);
  },
  fitView(): void {
    current?.fitView();
  },
  zoomIn(): void {
    current?.zoomIn();
  },
  zoomOut(): void {
    current?.zoomOut();
  },
  zoomTo(value: number): void {
    current?.zoomTo(value);
  },
  getZoom(): number {
    return current?.getZoom() ?? 1;
  },
};
