import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Connection,
  type Viewport as FlowViewport,
} from '@xyflow/react';
import { toPng } from 'html-to-image';
import {
  AlertTriangle,
  LayoutGrid,
  Loader2,
  Maximize,
  Minus,
  MousePointer2,
  Plus,
  Table2,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import {
  registerDiagramBridge,
  diagramBridge,
} from '../../services/diagramBridge';
import {
  registerCanvasBridge,
  type PngExportOptions,
} from '../../services/canvasBridge';
import { tableSize } from '../../core/model';
import type { TableLayout } from '../../types';
import { RelationEdge } from './RelationEdge';
import { TableNode } from './TableNode';
import type { RelationFlowEdge, TableFlowNode } from './flowTypes';
import { Inspector } from '../inspector/Inspector';

const nodeTypes = { table: TableNode };
const edgeTypes = { relation: RelationEdge };

function gridPosition(index: number): TableLayout {
  return {
    x: 80 + (index % 3) * 320,
    y: 80 + Math.floor(index / 3) * 280,
  };
}

function isOptionalRelation(relation: string): boolean {
  return relation.startsWith('0');
}

interface FocusSet {
  enabled: boolean;
  tables: Set<string>;
  refs: Set<string>;
}

function buildEdges(
  view: ReturnType<typeof useAppStore.getState>['view'],
  focus: FocusSet,
  positionFor: (key: string) => TableLayout,
): RelationFlowEdge[] {
  const edges: RelationFlowEdge[] = [];
  for (const ref of view.refs) {
    const leftTable = view.tableMap.get(ref.left.tableKey);
    const rightTable = view.tableMap.get(ref.right.tableKey);
    if (!leftTable || !rightTable) continue;

    const leftPosition = positionFor(ref.left.tableKey);
    const rightPosition = positionFor(ref.right.tableKey);
    const leftCenter = leftPosition.x + tableSize(leftTable).width / 2;
    const rightCenter = rightPosition.x + tableSize(rightTable).width / 2;
    const leftIsSource = leftCenter <= rightCenter;
    const source = leftIsSource ? ref.left : ref.right;
    const target = leftIsSource ? ref.right : ref.left;
    const sourceTable = leftIsSource ? leftTable : rightTable;
    const targetTable = leftIsSource ? rightTable : leftTable;
    const sourceColumn =
      source.fieldNames.find((name) => sourceTable.columns.some((column) => column.name === name)) ??
      source.fieldNames[0];
    const targetColumn =
      target.fieldNames.find((name) => targetTable.columns.some((column) => column.name === name)) ??
      target.fieldNames[0];
    if (!sourceColumn || !targetColumn) continue;

    const dimmed = focus.enabled && !focus.refs.has(ref.id);
    edges.push({
      id: ref.id,
      type: 'relation',
      source: source.tableKey,
      target: target.tableKey,
      sourceHandle: sourceColumn,
      targetHandle: targetColumn,
      data: {
        ref,
        active: focus.enabled && focus.refs.has(ref.id),
        dimmed,
        sourceRelation: source.relation,
        targetRelation: target.relation,
        sourceOptional: isOptionalRelation(source.relation),
        targetOptional: isOptionalRelation(target.relation),
      },
      zIndex: dimmed ? 0 : 2,
    });
  }
  return edges;
}

function selectionFocus(
  selection: ReturnType<typeof useAppStore.getState>['selection'],
  view: ReturnType<typeof useAppStore.getState>['view'],
): FocusSet {
  const tables = new Set<string>();
  const refs = new Set<string>();
  if (!selection) return { enabled: false, tables, refs };

  if (selection.type === 'table') {
    if (!view.tableMap.has(selection.key)) return { enabled: false, tables, refs };
    tables.add(selection.key);
    for (const ref of view.refs) {
      if (ref.left.tableKey !== selection.key && ref.right.tableKey !== selection.key) continue;
      refs.add(ref.id);
      tables.add(ref.left.tableKey);
      tables.add(ref.right.tableKey);
    }
    return { enabled: true, tables, refs };
  }

  const ref = view.refMap.get(selection.edgeId);
  if (!ref) return { enabled: false, tables, refs };
  refs.add(ref.id);
  tables.add(ref.left.tableKey);
  tables.add(ref.right.tableKey);
  return { enabled: true, tables, refs };
}

function DiagramCanvasInner() {
  const view = useAppStore((state) => state.view);
  const layout = useAppStore((state) => state.layout);
  const selection = useAppStore((state) => state.selection);
  const valid = useAppStore((state) => state.valid);
  const fitSignal = useAppStore((state) => state.fitSignal);
  const zoom = useAppStore((state) => state.zoom);
  const layoutBusy = useAppStore((state) => state.layoutBusy);
  const docId = useAppStore((state) => state.docId);
  const [nodes, setNodes, onNodesChange] = useNodesState<TableFlowNode>([]);
  const [renderAll, setRenderAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFitSignal = useRef(0);
  const {
    fitView,
    zoomIn,
    zoomOut,
    zoomTo,
    getZoom,
    getViewport,
    setCenter,
    setViewport,
    getNode,
    getNodes,
    getNodesBounds,
  } = useReactFlow<TableFlowNode, RelationFlowEdge>();

  const fallbackPositions = useMemo(
    () => new Map(view.tables.map((table, index) => [table.key, gridPosition(index)])),
    [view.tables],
  );
  const positionFor = useCallback(
    (key: string): TableLayout =>
      layout[key] ?? fallbackPositions.get(key) ?? { x: 0, y: 0 },
    [layout, fallbackPositions],
  );

  const focus = useMemo(() => selectionFocus(selection, view), [selection, view]);

  useEffect(() => {
    setNodes((current) => {
      const existing = new Map(current.map((node) => [node.id, node]));
      return view.tables.map((table, index) => {
        const previous = existing.get(table.key);
        const position = layout[table.key] ?? previous?.position ?? gridPosition(index);
        return {
          ...previous,
          id: table.key,
          type: 'table' as const,
          position: { x: position.x, y: position.y },
          dragHandle: '.table-drag-handle',
          data: {
            table,
            dimmed: focus.enabled && !focus.tables.has(table.key),
          },
        };
      });
    });
  }, [view, layout, focus, setNodes]);

  const edges = useMemo(
    () => buildEdges(view, focus, positionFor),
    [view, focus, positionFor],
  );

  useEffect(() => {
    registerDiagramBridge({
      focusTable(key) {
        const node = getNode(key);
        if (!node) return;
        const size = tableSize(node.data.table);
        void setCenter(node.position.x + size.width / 2, node.position.y + size.height / 2, {
          zoom: 1,
          duration: 400,
        });
      },
      focusTables(keys) {
        const targets = keys.filter((key) => getNode(key)).map((id) => ({ id }));
        if (targets.length === 0) return;
        void fitView({ nodes: targets, padding: 0.28, duration: 450, maxZoom: 1.4 });
      },
      fitView() {
        void fitView({ padding: 0.16, duration: 350, maxZoom: 1.25 });
      },
      zoomIn() {
        void zoomIn({ duration: 160 });
      },
      zoomOut() {
        void zoomOut({ duration: 160 });
      },
      zoomTo(value) {
        void zoomTo(value, { duration: 220 });
      },
      getZoom() {
        return getZoom();
      },
    });
    return () => registerDiagramBridge(null);
  }, [fitView, getNode, getZoom, setCenter, zoomIn, zoomOut, zoomTo]);

  useEffect(() => {
    if (fitSignal === lastFitSignal.current || nodes.length === 0) return;
    lastFitSignal.current = fitSignal;
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.16, duration: 380, maxZoom: 1.25 });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [fitSignal, nodes.length, fitView]);

  useEffect(() => {
    if (!docId) return;
    const state = useAppStore.getState();
    if (!state.viewport) return;
    const viewport = { ...state.viewport };
    const timer = window.setTimeout(() => {
      void setViewport(viewport, { duration: 0 });
    }, 90);
    return () => window.clearTimeout(timer);
  }, [docId, setViewport]);

  const exportPng = useCallback(
    async (options: PngExportOptions): Promise<string> => {
      const container = containerRef.current;
      const viewportElement =
        container?.querySelector<HTMLElement>('.react-flow__viewport') ?? null;
      if (!container || !viewportElement) throw new Error('画布尚未准备好');

      const background =
        getComputedStyle(container).getPropertyValue('--canvas').trim() || '#f8f9fc';
      const backgroundColor = options.transparent ? undefined : background;
      let width: number;
      let height: number;
      let transform: FlowViewport;

      if (options.scope === 'full') {
        setRenderAll(true);
        await new Promise((resolve) => setTimeout(resolve, 160));
        const allNodes = getNodes();
        if (allNodes.length === 0) {
          setRenderAll(false);
          throw new Error('画布为空，没有可导出的表');
        }
        const bounds = getNodesBounds(allNodes);
        const contentWidth = Math.max(1, bounds.width);
        const contentHeight = Math.max(1, bounds.height);
        const padding = options.padding;
        const zoom = Math.max(
          0.1,
          Math.min(2, 1, 6400 / (contentWidth + padding * 2), 6400 / (contentHeight + padding * 2)),
        );
        width = Math.min(6400, Math.max(360, Math.round(contentWidth * zoom + padding * 2)));
        height = Math.min(6400, Math.max(240, Math.round(contentHeight * zoom + padding * 2)));
        transform = {
          x: (width - contentWidth * zoom) / 2 - bounds.x * zoom,
          y: (height - contentHeight * zoom) / 2 - bounds.y * zoom,
          zoom,
        };
      } else {
        const rect = container.getBoundingClientRect();
        width = Math.max(1, Math.round(rect.width));
        height = Math.max(1, Math.round(rect.height));
        transform = getViewport();
      }

      try {
        return await toPng(viewportElement, {
          backgroundColor,
          width,
          height,
          pixelRatio: options.scale,
          cacheBust: true,
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
          },
        });
      } finally {
        setRenderAll(false);
      }
    },
    [getNodes, getNodesBounds, getViewport],
  );

  useEffect(() => {
    registerCanvasBridge({ exportPng });
    return () => registerCanvasBridge(null);
  }, [exportPng]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (!connection.sourceHandle || !connection.targetHandle) return;
    useAppStore
      .getState()
      .createRef(
        connection.source,
        connection.sourceHandle,
        connection.target,
        connection.targetHandle,
      );
  }, []);

  const addFirstTable = () => useAppStore.getState().createTableAt();

  const empty = view.tables.length === 0;

  return (
    <div className="diagram-canvas" ref={containerRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => useAppStore.getState().selectTable(node.id)}
        onNodeDoubleClick={(_, node) =>
          useAppStore.getState().selectTable(node.id, { reveal: true })
        }
        onNodeDragStop={(_, __, dragged) => {
          const positions: Record<string, TableLayout> = {};
          for (const node of dragged) {
            positions[node.id] = {
              x: Math.round(node.position.x),
              y: Math.round(node.position.y),
            };
          }
          useAppStore.getState().setNodePositions(positions);
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          useAppStore.getState().selectTable(node.id);
          useAppStore.getState().setContextMenu({
            x: Math.min(event.clientX, window.innerWidth - 230),
            y: Math.min(event.clientY, window.innerHeight - 300),
            kind: 'table',
            id: node.id,
          });
        }}
        onEdgeClick={(_, edge) => useAppStore.getState().selectRef(edge.id)}
        onEdgeDoubleClick={(_, edge) =>
          useAppStore.getState().selectRef(edge.id, { reveal: true })
        }
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault();
          useAppStore.getState().selectRef(edge.id);
          useAppStore.getState().setContextMenu({
            x: Math.min(event.clientX, window.innerWidth - 230),
            y: Math.min(event.clientY, window.innerHeight - 260),
            kind: 'ref',
            id: edge.id,
          });
        }}
        onPaneClick={() => {
          useAppStore.getState().clearSelection();
          useAppStore.getState().dismissContextMenu();
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          useAppStore.getState().setContextMenu({
            x: Math.min(event.clientX, window.innerWidth - 230),
            y: Math.min(event.clientY, window.innerHeight - 220),
            kind: 'pane',
          });
        }}
        onConnect={onConnect}
        onMoveEnd={(_, viewport) => {
          useAppStore.getState().setViewport(
            viewport,
            useAppStore.getState().hasSidecar,
          );
        }}
        isValidConnection={(connection) => {
          if (!connection.source || !connection.target) return false;
          return !(
            connection.source === connection.target &&
            connection.sourceHandle === connection.targetHandle
          );
        }}
        nodesConnectable={valid}
        edgesFocusable
        nodesDraggable
        onlyRenderVisibleElements={!renderAll}
        minZoom={0.1}
        maxZoom={3}
        deleteKeyCode={null}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        zoomOnDoubleClick={false}
        elevateEdgesOnSelect
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 1.6 }}
        className="diagram-flow"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.1} color="var(--dot)" />
        {!empty && (
          <MiniMap
            className="diagram-minimap"
            pannable
            zoomable
            nodeStrokeWidth={2}
            nodeColor={(node) => (node as TableFlowNode).data.table.color}
            maskColor="color-mix(in srgb, var(--canvas) 72%, transparent)"
          />
        )}
      </ReactFlow>

      {!empty && (
        <div className="canvas-badge">
          <Table2 size={11} />
          <strong>{view.tables.length}</strong> 表
          <span className="badge-sep" />
          <strong>{view.refs.length}</strong> 关系
          {view.schemas.length > 1 && (
            <>
              <span className="badge-sep" />
              {view.schemas.length} schema
            </>
          )}
        </div>
      )}

      {!valid && (
        <div className="canvas-warning" role="status">
          <AlertTriangle size={13} />
          <span>DBML 存在语法错误，画布显示上次有效版本</span>
          <button onClick={() => useAppStore.getState().toggleProblems()}>查看问题</button>
        </div>
      )}

      {layoutBusy && (
        <div className="canvas-busy">
          <Loader2 size={12} className="spin" />
          正在计算布局…
        </div>
      )}

      {empty && (
        <div className="canvas-empty">
          {valid ? (
            <>
              <div className="empty-graphic">
                <span />
                <span />
                <span />
              </div>
              <h2>从第一张表开始</h2>
              <p>在左侧编写 DBML，画布会实时呈现；也可以从空白表开始。</p>
              <button className="btn primary" onClick={addFirstTable}>
                <Plus size={14} />
                新建第一张表
              </button>
              <span className="empty-hint">提示：在 DBML 中输入 Table 声明也会自动出现表格</span>
            </>
          ) : (
            <>
              <div className="empty-graphic error">
                <span />
                <span />
                <span />
              </div>
              <h2>暂时无法绘制</h2>
              <p>修复编辑器中的语法错误后，画布会自动恢复；当前位置与布局不会丢失。</p>
              <button className="btn" onClick={() => useAppStore.getState().toggleProblems()}>
                查看问题列表
              </button>
            </>
          )}
        </div>
      )}

      <Inspector />

      {!empty && (
        <div className="canvas-toolbar" role="toolbar" aria-label="画布工具">
          <button title="缩小" aria-label="缩小" onClick={() => void zoomOut({ duration: 160 })}>
            <Minus size={14} />
          </button>
          <button
            className="zoom-value"
            title="重置为 100%"
            onClick={() => void zoomTo(1, { duration: 200 })}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button title="放大" aria-label="放大" onClick={() => void zoomIn({ duration: 160 })}>
            <Plus size={14} />
          </button>
          <span className="tool-sep" />
          <button
            title="适应画布（F）"
            aria-label="适应画布"
            onClick={() => diagramBridge.fitView()}
          >
            <Maximize size={13} />
          </button>
          <button
            title="自动布局（L）"
            aria-label="自动布局"
            onClick={() => void useAppStore.getState().runAutoLayout()}
          >
            <LayoutGrid size={13} />
          </button>
          <span className="tool-sep" />
          <span className="tool-hint">
            <MousePointer2 size={11} />
            拖拽列端点建关系 · Shift 框选
          </span>
        </div>
      )}
    </div>
  );
}

export function DiagramCanvas() {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInner />
    </ReactFlowProvider>
  );
}
