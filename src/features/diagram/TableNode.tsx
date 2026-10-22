import { memo, type MouseEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  ArrowUp,
  ChevronRight,
  FileText,
  KeyRound,
  Link2,
  ListTree,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import type { TableFlowNode } from './flowTypes';

export const TableNode = memo(function TableNode({
  id,
  data,
}: NodeProps<TableFlowNode>) {
  const { table, dimmed } = data;
  const isSelected = useAppStore(
    (state) => state.selection?.type === 'table' && state.selection.key === id,
  );
  const activeColumn = useAppStore((state) =>
    state.selection?.type === 'table' && state.selection.key === id
      ? state.selectedColumn
      : null,
  );
  const cursorActive = useAppStore((state) => state.cursorTableKey === id);
  const showTypes = useAppStore((state) => state.showColumnTypes);
  const selectColumn = useAppStore((state) => state.selectColumn);
  const addColumnToTable = useAppStore((state) => state.addColumnToTable);
  const setContextMenu = useAppStore((state) => state.setContextMenu);

  const openMenu = (event: MouseEvent, column?: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (column) selectColumn(table.key, column, true);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({
      x: Math.min(rect.right, window.innerWidth - 230),
      y: Math.min(rect.bottom + 4, window.innerHeight - 320),
      kind: 'table',
      id: table.key,
    });
  };

  const footerParts: string[] = [];
  if (table.indexes.length > 0) footerParts.push(`${table.indexes.length} 索引`);
  if (table.checks.length > 0) footerParts.push(`${table.checks.length} 检查`);
  if (table.partials.length > 0) footerParts.push(`${table.partials.length} 片段`);

  return (
    <div
      className={[
        'table-node',
        isSelected ? 'is-selected' : '',
        cursorActive ? 'cursor-active' : '',
        dimmed ? 'is-dimmed' : '',
      ].join(' ')}
      style={{ ['--table-color' as string]: table.color }}
    >
      <div className="table-head table-drag-handle">
        {table.schemaName !== 'public' && (
          <span className="table-schema">{table.schemaName}</span>
        )}
        <span className="table-name" title={`${table.schemaName}.${table.name}`}>
          {table.name}
        </span>
        {table.alias && <span className="table-alias">as {table.alias}</span>}
        {table.note && (
          <span className="table-note-icon" title={table.note}>
            <FileText size={10} />
          </span>
        )}
        {isSelected && <span className="selected-tag">SELECTED</span>}
        <button
          className="table-menu nodrag nopan"
          title="表操作"
          onClick={(event) => openMenu(event)}
        >
          <MoreHorizontal size={13} />
        </button>
      </div>

      <div className="table-body">
        {table.columns.map((column) => (
          <div
            key={column.name}
            className={`col-row nodrag nopan ${activeColumn === column.name ? 'highlight' : ''}`}
            title={[
              `${column.name} ${column.type}`,
              column.note,
              column.defaultValue ? `default ${column.defaultValue}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onClick={(event) => {
              event.stopPropagation();
              selectColumn(table.key, column.name, true);
            }}
            onContextMenu={(event) => openMenu(event, column.name)}
          >
            <Handle
              type="target"
              position={Position.Left}
              id={column.name}
              className="column-handle target"
              onClick={(event) => event.stopPropagation()}
            />
            <span
              className={`col-flag ${column.pk ? 'pk' : column.isForeignKey ? 'fk' : ''}`}
              title={column.pk ? '主键' : column.isForeignKey ? '外键' : undefined}
            >
              {column.pk ? (
                <KeyRound size={10} />
              ) : column.isForeignKey ? (
                <Link2 size={10} />
              ) : (
                <span className="col-dot" />
              )}
            </span>
            <span className={`col-name ${column.pk ? 'pk-name' : ''}`}>{column.name}</span>
            {column.unique && !column.pk && <span className="mini-badge uq">UQ</span>}
            {column.increment && (
              <span className="mini-badge inc" title="自增">
                <ArrowUp size={7} />
              </span>
            )}
            {showTypes && (
              <span className={`col-type ${column.isEnum ? 'enum' : ''}`}>{column.type}</span>
            )}
            {!column.notNull && !column.pk && (
              <span className="col-nn" title="可为空" />
            )}
            <Handle
              type="source"
              position={Position.Right}
              id={column.name}
              className="column-handle source"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ))}
        {table.columns.length === 0 && (
          <div className="empty-columns">暂无字段</div>
        )}
      </div>

      <div className="table-foot">
        <button
          className="table-foot-add nodrag nopan"
          title="新增列"
          onClick={(event) => {
            event.stopPropagation();
            addColumnToTable(table.key);
          }}
        >
          <Plus size={10} />
        </button>
        {footerParts.length > 0 && <ListTree size={9} />}
        {footerParts.length > 0 ? (
          <span>{footerParts.join(' · ')}</span>
        ) : table.note ? (
          <span className="table-foot-note">{table.note}</span>
        ) : (
          <span className="table-foot-hint">
            拖拽列两侧圆点建立关系
            <ChevronRight size={8} />
          </span>
        )}
        {footerParts.length > 0 && table.note && (
          <span className="table-foot-note" title={table.note}>
            · {table.note}
          </span>
        )}
      </div>
    </div>
  );
});
