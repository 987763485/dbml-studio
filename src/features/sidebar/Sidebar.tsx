import { useMemo, useState } from 'react';
import {
  Braces,
  ChevronDown,
  ChevronRight,
  FolderTree,
  KeyRound,
  Link2,
  Plus,
  Search,
  Table2,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { editorBridge } from '../../services/editorBridge';
import { diagramBridge } from '../../services/diagramBridge';
import { offsetAt } from '../../utils';
import type { TableModel } from '../../core/model';

interface TableMatch {
  table: TableModel;
  columns: string[];
}

function useTableMatches(query: string): TableMatch[] {
  const view = useAppStore((state) => state.view);
  return useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return view.tables.map((table) => ({ table, columns: [] }));
    return view.tables
      .map((table) => {
        const columns = table.columns
          .filter((column) => column.name.toLowerCase().includes(normalized))
          .map((column) => column.name);
        const tableHit =
          table.name.toLowerCase().includes(normalized) ||
          `${table.schemaName}.${table.name}`.toLowerCase().includes(normalized) ||
          (table.note ?? '').toLowerCase().includes(normalized);
        if (!tableHit && columns.length === 0) return null;
        return { table, columns: tableHit ? [] : columns };
      })
      .filter((item): item is TableMatch => Boolean(item));
  }, [query, view]);
}

export function Sidebar() {
  const view = useAppStore((state) => state.view);
  const selection = useAppStore((state) => state.selection);
  const selectTable = useAppStore((state) => state.selectTable);
  const selectRef = useAppStore((state) => state.selectRef);
  const createTableAt = useAppStore((state) => state.createTableAt);
  const requestNew = useAppStore((state) => state.requestNew);
  const cursorTableKey = useAppStore((state) => state.cursorTableKey);
  const content = useAppStore((state) => state.content);

  const [query, setQuery] = useState('');
  const [openTables, setOpenTables] = useState(true);
  const [openEnums, setOpenEnums] = useState(true);
  const [openGroups, setOpenGroups] = useState(true);

  const matches = useTableMatches(query);
  const activeTableKey = selection?.type === 'table' ? selection.key : cursorTableKey;
  const hasSearch = query.trim().length > 0;

  const focusTable = (key: string, column?: string) => {
    selectTable(key, { reveal: true, focus: true, column: column ?? null });
  };

  const focusGroup = (tableKeys: string[]) => {
    if (tableKeys.length === 0) return;
    selectTable(tableKeys[0], { reveal: true });
    diagramBridge.focusTables(tableKeys);
  };

  return (
    <aside className="sidebar" aria-label="对象导航">
      <div className="search-wrap">
        <label className="search">
          <Search size={13} />
          <input
            data-search-input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索表 / 字段"
            aria-label="搜索表或字段"
          />
          <kbd>⌘K</kbd>
        </label>
      </div>

      <div className="side-scroll">
        <div className="side-section">
          <button className="section-head" onClick={() => setOpenTables(!openTables)}>
            <span className="chev">
              {openTables ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
            </span>
            Tables
            <span className="count">{matches.length}</span>
            <span
              className="head-add"
              role="button"
              tabIndex={0}
              title="新建表"
              onClick={(event) => {
                event.stopPropagation();
                createTableAt();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.stopPropagation();
                  createTableAt();
                }
              }}
            >
              <Plus size={12} />
            </span>
          </button>
          {openTables && (
            <div className="side-items">
              {matches.map(({ table, columns }) => (
                <div key={table.key} className="side-table-group">
                  <button
                    className={`side-item ${activeTableKey === table.key ? 'active' : ''}`}
                    onClick={() => focusTable(table.key)}
                    title={table.note || `${table.schemaName}.${table.name}`}
                  >
                    <span className="table-color-dot" style={{ background: table.color }} />
                    <span className="label">
                      {table.schemaName !== 'public' && (
                        <span className="side-schema">{table.schemaName}</span>
                      )}
                      {table.name}
                    </span>
                    <span className="num">{table.columns.length}</span>
                  </button>
                  {hasSearch &&
                    columns.map((column) => {
                      const model = table.columns.find((item) => item.name === column);
                      return (
                        <button
                          key={`${table.key}.${column}`}
                          className="side-item side-column"
                          onClick={() => focusTable(table.key, column)}
                        >
                          <span className="ico">
                            {model?.pk ? (
                              <KeyRound size={10} />
                            ) : model?.isForeignKey ? (
                              <Link2 size={10} />
                            ) : (
                              <span className="column-dot" />
                            )}
                          </span>
                          <span className="label">{column}</span>
                          <span className="num">{model?.type}</span>
                        </button>
                      );
                    })}
                </div>
              ))}
              {matches.length === 0 && (
                <div className="side-empty">
                  {hasSearch ? '没有匹配的表或字段' : '还没有表，从下方新建一张'}
                </div>
              )}
            </div>
          )}
        </div>

        {view.enums.length > 0 && (
          <div className="side-section">
            <button className="section-head" onClick={() => setOpenEnums(!openEnums)}>
              <span className="chev">
                {openEnums ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
              </span>
              Enums
              <span className="count">{view.enums.length}</span>
            </button>
            {openEnums && (
              <div className="side-items">
                {view.enums.map((item) => (
                  <button
                    key={item.key}
                    className="side-item"
                    title={item.values.join(' · ')}
                    onClick={() => {
                      useAppStore.getState().clearSelection();
                      editorBridge.revealOffset(item.offset);
                    }}
                  >
                    <Braces size={12} className="ico" />
                    <span className="label">
                      {item.schemaName !== 'public' && (
                        <span className="side-schema">{item.schemaName}</span>
                      )}
                      {item.name}
                    </span>
                    <span className="num">{item.values.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {view.groups.length > 0 && (
          <div className="side-section">
            <button className="section-head" onClick={() => setOpenGroups(!openGroups)}>
              <span className="chev">
                {openGroups ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
              </span>
              Groups
              <span className="count">{view.groups.length}</span>
            </button>
            {openGroups && (
              <div className="side-items">
                {view.groups.map((group) => (
                  <button
                    key={group.key}
                    className="side-item"
                    title={`${group.tableKeys.length} 张表`}
                    onClick={() => focusGroup(group.tableKeys)}
                  >
                    <FolderTree size={12} className="ico" />
                    <span className="label">{group.name}</span>
                    <span className="num">{group.tableKeys.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {view.stickyNotes.length > 0 && (
          <div className="side-section">
            <div className="section-head">
              Notes
              <span className="count">{view.stickyNotes.length}</span>
            </div>
            <div className="side-items">
              {view.stickyNotes.map((note) => (
                <button
                  key={note.name}
                  className="side-item"
                  title={note.content}
                  onClick={() => editorBridge.revealOffset(offsetAt(content, note.line, 1))}
                >
                  <span className="ico">
                    <Table2 size={11} />
                  </span>
                  <span className="label">{note.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {view.refs.length > 0 && (
          <div className="side-section">
            <div className="section-head">
              Refs
              <span className="count">{view.refs.length}</span>
            </div>
            <div className="side-items refs-list">
              {view.refs.slice(0, 24).map((ref) => (
                <button
                  key={ref.id}
                  className={`side-item ref-item ${
                    selection?.type === 'ref' && selection.edgeId === ref.id ? 'active' : ''
                  }`}
                  title={`${ref.left.tableName}.${ref.left.fieldNames.join(', ')} ${
                    ref.op
                  } ${ref.right.tableName}.${ref.right.fieldNames.join(', ')}`}
                  onClick={() => selectRef(ref.id, { reveal: true })}
                >
                  <Link2 size={10} className="ico" />
                  <span className="label ref-label">
                    {ref.left.tableName}.{ref.left.fieldNames.join('+')}
                    <span className="ref-op">{ref.op}</span>
                    {ref.right.tableName}.{ref.right.fieldNames.join('+')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-foot">
        <button className="new-table" onClick={() => createTableAt()}>
          <Plus size={13} />
          新建表
        </button>
        <button className="new-table ghost" onClick={() => requestNew('blog')} title="新建一个包含完整示例的文档">
          使用示例模型
        </button>
        <div className="local-note">
          <i />
          本地存储 · 无网络请求
        </div>
      </div>
    </aside>
  );
}
