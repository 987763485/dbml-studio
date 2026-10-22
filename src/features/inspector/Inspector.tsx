import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Braces,
  ChevronDown,
  FileText,
  KeyRound,
  Link2,
  LocateFixed,
  Plus,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import type { ColumnModel, TableModel } from '../../core/model';

const TABLE_COLORS = [
  '#4f8ff7',
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#8b5cf6',
  '#0ea5e9',
  '#f97316',
  '#94a3b8',
];

const REF_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

const RELATION_OPTIONS = [
  { value: '>', label: '多对一（>）' },
  { value: '>?', label: '多对一 · 可选（>?）' },
  { value: '<', label: '一对多（<）' },
  { value: '<?', label: '一对多 · 可选（<?）' },
  { value: '-', label: '一对一（-）' },
  { value: '-?', label: '一对一 · 可选（-?）' },
  { value: '<>', label: '多对多（<>）' },
];

function InspectorShell({
  title,
  eyebrow,
  accent,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  eyebrow: ReactNode;
  accent: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <aside className="inspector" aria-label="属性面板">
      <header className="inspector-head">
        <div className="inspector-title">
          <div className="eyebrow">
            <span className="accent-dot" style={{ background: accent }} />
            {eyebrow}
          </div>
          {title}
        </div>
        <div className="inspector-actions">
          <button className="icon-btn" title="关闭属性面板" aria-label="关闭" onClick={onClose}>
            <X size={13} />
          </button>
        </div>
      </header>
      <div className="inspector-body">{children}</div>
      <footer className="inspector-foot">{footer}</footer>
    </aside>
  );
}

function ColumnEditor({ table, column }: { table: TableModel; column: ColumnModel }) {
  const valid = useAppStore((state) => state.valid);
  const renameColumnInTable = useAppStore((state) => state.renameColumnInTable);
  const commitColumnType = useAppStore((state) => state.commitColumnType);
  const commitColumnFlag = useAppStore((state) => state.commitColumnFlag);
  const commitColumnDefault = useAppStore((state) => state.commitColumnDefault);
  const commitColumnNote = useAppStore((state) => state.commitColumnNote);
  const requestDeleteColumn = useAppStore((state) => state.requestDeleteColumn);
  const selectTable = useAppStore((state) => state.selectTable);
  const [name, setName] = useState(column.name);
  const [type, setType] = useState(column.type);
  const [defaultValue, setDefaultValue] = useState(column.defaultValue ?? '');
  const [note, setNote] = useState(column.note ?? '');

  useEffect(() => setName(column.name), [column.name]);
  useEffect(() => setType(column.type), [column.type]);
  useEffect(() => setDefaultValue(column.defaultValue ?? ''), [column.defaultValue]);
  useEffect(() => setNote(column.note ?? ''), [column.note]);

  const commitName = () => {
    if (!valid) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === column.name) {
      setName(column.name);
      return;
    }
    renameColumnInTable(table.key, column.name, trimmed);
  };

  const commitType = () => {
    if (!valid) return;
    const trimmed = type.trim();
    if (!trimmed || trimmed === column.type) {
      setType(column.type);
      return;
    }
    commitColumnType(table.key, column.name, trimmed);
  };

  const commitDefault = () => {
    if (!valid) return;
    if (defaultValue.trim() === (column.defaultValue ?? '').trim()) return;
    commitColumnDefault(table.key, column.name, defaultValue);
  };

  const commitNote = () => {
    if (!valid) return;
    if (note.trim() === (column.note ?? '').trim()) return;
    commitColumnNote(table.key, column.name, note);
  };

  const flags = [
    { key: 'pk' as const, label: 'PK', active: column.pk, title: '主键' },
    { key: 'unique' as const, label: 'UQ', active: column.unique, title: '唯一' },
    { key: 'not null' as const, label: 'NN', active: column.notNull, title: '非空' },
    { key: 'increment' as const, label: 'AUTO', active: column.increment, title: '自增' },
  ];

  return (
    <div className="column-editor">
      <div className="column-editor-head">
        <span className="column-editor-title">
          <KeyRound size={11} />
          字段属性
        </span>
        <div className="column-editor-actions">
          <button
            className="icon-btn"
            title="在 DBML 中定位"
            onClick={() => useAppStore.getState().selectColumn(table.key, column.name, true)}
          >
            <LocateFixed size={12} />
          </button>
          <button
            className="icon-btn"
            title="收起字段属性"
            onClick={() => selectTable(table.key)}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="field">
        <label>字段名</label>
        <input
          className="input"
          value={name}
          disabled={!valid}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setName(column.name);
              event.currentTarget.blur();
            }
          }}
        />
      </div>

      <div className="field">
        <label>类型</label>
        <input
          className="input mono-input"
          value={type}
          disabled={!valid}
          onChange={(event) => setType(event.target.value)}
          onBlur={commitType}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setType(column.type);
              event.currentTarget.blur();
            }
          }}
        />
      </div>

      <div className="field">
        <label>默认值</label>
        <input
          className="input mono-input"
          value={defaultValue}
          placeholder="例如 0、'draft' 或 `now()`"
          disabled={!valid}
          onChange={(event) => setDefaultValue(event.target.value)}
          onBlur={commitDefault}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setDefaultValue(column.defaultValue ?? '');
              event.currentTarget.blur();
            }
          }}
        />
      </div>

      <div className="field">
        <label>字段备注</label>
        <textarea
          className="textarea"
          value={note}
          placeholder="可选"
          disabled={!valid}
          onChange={(event) => setNote(event.target.value)}
          onBlur={commitNote}
        />
      </div>

      <div className="field">
        <label>约束</label>
        <div className="flag-chips">
          {flags.map((flag) => (
            <button
              key={flag.key}
              className={`flag-chip ${flag.active ? 'active' : ''}`}
              title={flag.title}
              disabled={!valid}
              onClick={() => commitColumnFlag(table.key, column.name, flag.key, !flag.active)}
            >
              {flag.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className="danger-text-btn"
        disabled={!valid}
        onClick={() => requestDeleteColumn(table.key, column.name)}
      >
        <Trash2 size={11} />
        删除此列
      </button>
    </div>
  );
}

function TableInspector({ tableKey }: { tableKey: string }) {
  const table = useAppStore((state) => state.view.tableMap.get(tableKey));
  const selectedColumn = useAppStore((state) =>
    state.selection?.type === 'table' && state.selection.key === tableKey
      ? state.selectedColumn
      : null,
  );
  const valid = useAppStore((state) => state.valid);
  const renameTable = useAppStore((state) => state.renameTable);
  const commitTableNote = useAppStore((state) => state.commitTableNote);
  const commitTableColor = useAppStore((state) => state.commitTableColor);
  const selectColumn = useAppStore((state) => state.selectColumn);
  const addColumnToTable = useAppStore((state) => state.addColumnToTable);
  const requestDeleteTable = useAppStore((state) => state.requestDeleteTable);
  const revealTableInEditor = useAppStore((state) => state.revealTableInEditor);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const [name, setName] = useState(table?.name ?? '');
  const [note, setNote] = useState(table?.note ?? '');

  useEffect(() => setName(table?.name ?? ''), [table?.name]);
  useEffect(() => setNote(table?.note ?? ''), [table?.note, table?.key]);

  if (!table) return null;

  const activeColumn = selectedColumn
    ? table.columns.find((column) => column.name === selectedColumn) ?? null
    : null;

  const commitName = () => {
    if (!valid) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === table.name) {
      setName(table.name);
      return;
    }
    renameTable(table.key, trimmed);
  };

  const commitNote = () => {
    if (!valid) return;
    if (note.trim() === (table.note ?? '').trim()) return;
    commitTableNote(table.key, note);
  };

  const colors = Array.from(new Set([table.color, ...TABLE_COLORS]));

  return (
    <InspectorShell
      title={
        <input
          className="inspector-name-input"
          value={name}
          disabled={!valid}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setName(table.name);
              event.currentTarget.blur();
            }
          }}
          aria-label="表名"
        />
      }
      eyebrow={
        <>
          TABLE
          {table.schemaName !== 'public' && <span className="schema-chip">{table.schemaName}</span>}
        </>
      }
      accent={table.color}
      onClose={clearSelection}
      footer={
        <>
          <button className="locate-btn" onClick={() => revealTableInEditor(table.key)}>
            <LocateFixed size={12} />
            在 DBML 中定位
          </button>
          <button
            className="danger-btn"
            title="删除表"
            aria-label="删除表"
            disabled={!valid}
            onClick={() => requestDeleteTable(table.key)}
          >
            <Trash2 size={13} />
          </button>
        </>
      }
    >
      {!valid && (
        <div className="inspector-warning">DBML 存在语法错误，结构编辑已暂停。</div>
      )}

      <div className="inspector-meta">
        <span>
          <Table2 size={10} />
          {table.schemaName}
        </span>
        <span>{table.columns.length} 字段</span>
        <span>Ln {table.line}</span>
      </div>

      <div className="field">
        <label>表备注</label>
        <textarea
          className="textarea"
          value={note}
          placeholder="可选，支持多行"
          disabled={!valid}
          onChange={(event) => setNote(event.target.value)}
          onBlur={commitNote}
        />
      </div>

      <div className="field">
        <label>表头颜色</label>
        <div className="color-palette">
          {colors.map((color) => (
            <button
              key={color}
              className={`swatch-btn ${table.color === color ? 'active' : ''}`}
              style={{ background: color }}
              title={color}
              aria-label={`表头颜色 ${color}`}
              disabled={!valid}
              onClick={() => commitTableColor(table.key, color)}
            />
          ))}
          <button
            className="color-reset"
            disabled={!valid}
            onClick={() => commitTableColor(table.key, null)}
          >
            默认
          </button>
        </div>
      </div>

      <div className="divider" />

      <div className="subhead">
        字段
        <span className="count">{table.columns.length}</span>
        <button
          className="sub-action"
          title="新增字段"
          aria-label="新增字段"
          disabled={!valid}
          onClick={() => addColumnToTable(table.key)}
        >
          <Plus size={12} />
        </button>
      </div>

      <div className="mini-columns">
        {table.columns.map((column) => (
          <button
            key={column.name}
            className={`mini-col ${activeColumn?.name === column.name ? 'active' : ''}`}
            onClick={() => selectColumn(table.key, column.name)}
            title={`${column.name} ${column.type}`}
          >
            <span
              className={`m-flag ${column.pk ? 'pk' : column.isForeignKey ? 'fk' : ''}`}
            >
              {column.pk ? (
                <KeyRound size={9} />
              ) : column.isForeignKey ? (
                <Link2 size={9} />
              ) : (
                <span className="column-dot" />
              )}
            </span>
            <span className="m-name">{column.name}</span>
            {column.unique && !column.pk && <span className="mini-badge uq">UQ</span>}
            <span className={`m-type ${column.isEnum ? 'enum' : ''}`}>{column.type}</span>
          </button>
        ))}
        {table.columns.length === 0 && <div className="mini-empty">还没有字段</div>}
      </div>

      {activeColumn ? (
        <ColumnEditor
          key={`${table.key}.${activeColumn.name}`}
          table={table}
          column={activeColumn}
        />
      ) : (
        table.columns.length > 0 && (
          <div className="inspector-hint">选择一个字段，查看并修改类型、默认值与约束</div>
        )
      )}

      {(table.indexes.length > 0 || table.checks.length > 0 || table.partials.length > 0) && (
        <>
          <div className="divider" />
          <div className="subhead">结构</div>
          <div className="detail-list">
            {table.indexes.map((index, position) => (
              <div className="detail-row" key={`index-${position}`}>
                <span className="detail-icon">
                  <Braces size={10} />
                </span>
                <div className="detail-main">
                  <span className="detail-name">
                    {index.name || index.columns.join(', ')}
                    {index.pk ? ' · PK' : index.unique ? ' · UNIQUE' : ''}
                  </span>
                  <span className="detail-sub">
                    {index.columns.join(', ')}
                    {index.type ? ` · ${index.type}` : ''}
                  </span>
                </div>
              </div>
            ))}
            {table.checks.map((check, position) => (
              <div className="detail-row" key={`check-${position}`}>
                <span className="detail-icon">
                  <FileText size={10} />
                </span>
                <div className="detail-main">
                  <span className="detail-name">CHECK {check.name ? `· ${check.name}` : ''}</span>
                  <span className="detail-sub mono-input">{check.expression}</span>
                </div>
              </div>
            ))}
            {table.partials.map((partial) => (
              <div className="detail-row" key={`partial-${partial}`}>
                <span className="detail-icon">
                  <ChevronDown size={10} />
                </span>
                <div className="detail-main">
                  <span className="detail-name">TablePartial</span>
                  <span className="detail-sub">{partial}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </InspectorShell>
  );
}

function RefInspector({ refId }: { refId: string }) {
  const ref = useAppStore((state) => state.view.refMap.get(refId));
  const valid = useAppStore((state) => state.valid);
  const commitRefRelation = useAppStore((state) => state.commitRefRelation);
  const commitRefSetting = useAppStore((state) => state.commitRefSetting);
  const requestDeleteRef = useAppStore((state) => state.requestDeleteRef);
  const revealRefInEditor = useAppStore((state) => state.revealRefInEditor);
  const selectTable = useAppStore((state) => state.selectTable);
  const clearSelection = useAppStore((state) => state.clearSelection);

  if (!ref) return null;

  const relationOptions = RELATION_OPTIONS.some((option) => option.value === ref.op)
    ? RELATION_OPTIONS
    : [{ value: ref.op, label: ref.op }, ...RELATION_OPTIONS];

  return (
    <InspectorShell
      title={
        <h2 className="inspector-rel-title">
          {ref.left.tableName}
          <ArrowRight size={12} />
          {ref.right.tableName}
        </h2>
      }
      eyebrow={ref.name ? `REF · ${ref.name}` : 'REF'}
      accent={ref.color || '#64748b'}
      onClose={clearSelection}
      footer={
        <>
          <button className="locate-btn" onClick={() => revealRefInEditor(ref.id)}>
            <LocateFixed size={12} />
            在 DBML 中定位
          </button>
          <button
            className="danger-btn"
            title="删除关系"
            aria-label="删除关系"
            disabled={!valid}
            onClick={() => requestDeleteRef(ref.id)}
          >
            <Trash2 size={13} />
          </button>
        </>
      }
    >
      {!valid && <div className="inspector-warning">DBML 存在语法错误，结构编辑已暂停。</div>}

      <div className="ref-endpoints">
        {[ref.left, ref.right].map((endpoint, index) => (
          <button
            key={`${endpoint.tableKey}-${index}`}
            className="ref-endpoint"
            onClick={() =>
              selectTable(endpoint.tableKey, {
                reveal: true,
                column: endpoint.fieldNames[0] ?? null,
              })
            }
          >
            <span className="ref-endpoint-table">
              {endpoint.schemaName && endpoint.schemaName !== 'public' && (
                <span className="schema-chip">{endpoint.schemaName}</span>
              )}
              {endpoint.tableName}
            </span>
            <code>{endpoint.fieldNames.join(', ')}</code>
            <span className="ref-relation">{endpoint.relation}</span>
          </button>
        ))}
      </div>

      <div className="field">
        <label>关系类型</label>
        <select
          className="input select-input"
          value={ref.op}
          disabled={!valid}
          onChange={(event) => commitRefRelation(ref.id, event.target.value)}
        >
          {relationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field-row-2">
        <div className="field">
          <label>ON DELETE</label>
          <select
            className="input select-input"
            value={ref.onDelete ?? ''}
            disabled={!valid || !ref.explicit}
            onChange={(event) =>
              commitRefSetting(ref.id, 'delete', event.target.value || null)
            }
          >
            <option value="">默认</option>
            <option value="cascade">CASCADE</option>
            <option value="set null">SET NULL</option>
            <option value="restrict">RESTRICT</option>
            <option value="no action">NO ACTION</option>
          </select>
        </div>
        <div className="field">
          <label>ON UPDATE</label>
          <select
            className="input select-input"
            value={ref.onUpdate ?? ''}
            disabled={!valid || !ref.explicit}
            onChange={(event) =>
              commitRefSetting(ref.id, 'update', event.target.value || null)
            }
          >
            <option value="">默认</option>
            <option value="cascade">CASCADE</option>
            <option value="set null">SET NULL</option>
            <option value="restrict">RESTRICT</option>
            <option value="no action">NO ACTION</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>关系颜色</label>
        <div className="color-palette">
          {REF_COLORS.map((color) => (
            <button
              key={color}
              className={`swatch-btn ${ref.color === color ? 'active' : ''}`}
              style={{ background: color }}
              title={color}
              aria-label={`关系颜色 ${color}`}
              disabled={!valid || !ref.explicit}
              onClick={() => commitRefSetting(ref.id, 'color', color)}
            />
          ))}
          <button
            className="color-reset"
            disabled={!valid || !ref.explicit}
            onClick={() => commitRefSetting(ref.id, 'color', null)}
          >
            默认
          </button>
        </div>
      </div>

      {!ref.explicit && (
        <div className="inspector-hint">
          内联 Ref 的删除动作与颜色需要在 DBML 中展开为长 Ref；关系类型可直接调整。
        </div>
      )}
      {ref.inactive && (
        <div className="inspector-hint warning">这条关系在 DBML 中标记为 inactive。</div>
      )}
    </InspectorShell>
  );
}

export function Inspector() {
  const selection = useAppStore((state) => state.selection);
  if (!selection) return null;
  if (selection.type === 'table') {
    return <TableInspector key={selection.key} tableKey={selection.key} />;
  }
  return <RefInspector key={selection.edgeId} refId={selection.edgeId} />;
}
