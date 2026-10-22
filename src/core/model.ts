import type { Database } from '@dbml/parse';

export interface ColumnModel {
  name: string;
  type: string;
  pk: boolean;
  unique: boolean;
  notNull: boolean;
  increment: boolean;
  defaultValue: string | null;
  note: string | null;
  isEnum: boolean;
  isForeignKey: boolean;
  line: number;
  offset: number;
  tokenEnd: number;
  noteStart: number | null;
  noteEnd: number | null;
}

export interface IndexModel {
  name: string | null;
  columns: string[];
  unique: boolean;
  pk: boolean;
  type: string | null;
  note: string | null;
  line: number;
}

export interface CheckModel {
  name: string | null;
  expression: string;
  line: number;
}

export interface TableModel {
  key: string;
  name: string;
  schemaName: string;
  alias: string | null;
  color: string;
  note: string | null;
  columns: ColumnModel[];
  indexes: IndexModel[];
  checks: CheckModel[];
  partials: string[];
  line: number;
  endLine: number;
  offset: number;
  tokenEnd: number;
  noteStart: number | null;
  noteEnd: number | null;
}

export interface RefEndpointModel {
  tableKey: string;
  tableName: string;
  schemaName: string | null;
  fieldNames: string[];
  relation: string;
  tokenStart: number;
  tokenEnd: number;
}

export interface RefModel {
  id: string;
  explicit: boolean;
  name: string | null;
  left: RefEndpointModel;
  right: RefEndpointModel;
  op: string;
  color: string | null;
  onDelete: string | null;
  onUpdate: string | null;
  inactive: boolean;
  line: number;
  offset: number;
  tokenStart: number;
  tokenEnd: number;
}

export interface EnumModel {
  key: string;
  name: string;
  schemaName: string;
  values: string[];
  line: number;
  offset: number;
}

export interface TableGroupModel {
  key: string;
  name: string;
  schemaName: string;
  tableKeys: string[];
  color: string | null;
  note: string | null;
  line: number;
}

export interface StickyNoteModel {
  name: string;
  content: string;
  color: string | null;
  line: number;
}

export interface ViewModel {
  tables: TableModel[];
  tableMap: Map<string, TableModel>;
  refs: RefModel[];
  refMap: Map<string, RefModel>;
  enums: EnumModel[];
  enumMap: Map<string, EnumModel>;
  groups: TableGroupModel[];
  stickyNotes: StickyNoteModel[];
  schemas: string[];
  hasProject: boolean;
  databaseType: string | null;
}

const DEFAULT_COLORS = [
  '#4f8ff7',
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#8b5cf6',
  '#0ea5e9',
  '#f97316',
];

export function tableKey(schemaName: string | null | undefined, name: string): string {
  return `${schemaName || 'public'}.${name}`;
}

export function columnKey(table: string, column: string): string {
  return `${table}.${column}`;
}

function isMany(relation: string): boolean {
  return relation === '*' || relation.endsWith('*');
}

function formatDefault(value: { type: string; value: number | string } | undefined): string | null {
  if (!value) return null;
  if (value.type === 'string') return `'${String(value.value)}'`;
  if (value.type === 'expression') return `\`${String(value.value)}\``;
  return String(value.value);
}

export function buildViewModel(db: Database | null, source: string): ViewModel {
  if (!db) {
    return {
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
  }

  const enumKeys = new Set(
    db.enums.map((item) => `${item.schemaName || 'public'}.${item.name}`),
  );
  const enumNames = new Set(db.enums.map((item) => item.name));
  const inlineForeignKeys = new Set<string>();

  for (const table of db.tables) {
    const key = tableKey(table.schemaName, table.name);
    for (const field of table.fields) {
      if (field.inline_refs.length > 0) {
        inlineForeignKeys.add(`${key}.${field.name}`);
      }
    }
  }

  const refs: RefModel[] = [];
  for (const ref of db.refs) {
    const [endpointA, endpointB] = ref.endpoints;
    const tokenStart = ref.token.start.offset;
    const tokenEnd = ref.token.end.offset;
    const tokenText = source.slice(tokenStart, tokenEnd);
    const explicit = tokenText.trimStart().startsWith('Ref');
    let left = endpointA;
    let right = endpointB;
    if (!explicit && endpointB.token.start.offset < endpointA.token.start.offset) {
      left = endpointB;
      right = endpointA;
    }

    let op = '-';
    if (explicit) {
      op =
        source
          .slice(left.token.end.offset, right.token.start.offset)
          .replace(/\s+/g, '')
          .trim() || '-';
    } else {
      const match = tokenText.trimStart().match(/^\??(?:<>|[<>-])\??/);
      op = match?.[0] ?? '-';
    }

    const leftModel: RefEndpointModel = {
      tableKey: tableKey(left.schemaName, left.tableName),
      tableName: left.tableName,
      schemaName: left.schemaName,
      fieldNames: [...left.fieldNames],
      relation: left.relation,
      tokenStart: left.token.start.offset,
      tokenEnd: left.token.end.offset,
    };
    const rightModel: RefEndpointModel = {
      tableKey: tableKey(right.schemaName, right.tableName),
      tableName: right.tableName,
      schemaName: right.schemaName,
      fieldNames: [...right.fieldNames],
      relation: right.relation,
      tokenStart: right.token.start.offset,
      tokenEnd: right.token.end.offset,
    };
    const id = `ref:${leftModel.tableKey}.${leftModel.fieldNames.join('+')}->${rightModel.tableKey}.${rightModel.fieldNames.join('+')}`;

    refs.push({
      id,
      explicit,
      name: ref.name,
      left: leftModel,
      right: rightModel,
      op,
      color: ref.color && ref.color !== 'none' ? ref.color : null,
      onDelete: ref.onDelete ?? null,
      onUpdate: ref.onUpdate ?? null,
      inactive: Boolean(ref.inactive),
      line: ref.token.start.line,
      offset: tokenStart,
      tokenStart,
      tokenEnd,
    });
  }

  const foreignKeys = new Set(inlineForeignKeys);
  for (const ref of refs) {
    if (isMany(ref.left.relation)) {
      for (const field of ref.left.fieldNames) {
        foreignKeys.add(`${ref.left.tableKey}.${field}`);
      }
    }
    if (isMany(ref.right.relation)) {
      for (const field of ref.right.fieldNames) {
        foreignKeys.add(`${ref.right.tableKey}.${field}`);
      }
    }
  }

  const tables: TableModel[] = db.tables.map((table, tableIndex) => {
    const key = tableKey(table.schemaName, table.name);
    return {
      key,
      name: table.name,
      schemaName: table.schemaName || 'public',
      alias: table.alias,
      color: table.headerColor || DEFAULT_COLORS[tableIndex % DEFAULT_COLORS.length],
      note: table.note?.value ?? null,
      columns: table.fields.map((field) => {
        const typeName = field.type.type_name;
        const qualifiedType = field.type.schemaName
          ? `${field.type.schemaName}.${typeName}`
          : typeName;
        return {
          name: field.name,
          type: qualifiedType,
          pk: Boolean(field.pk),
          unique: Boolean(field.unique),
          notNull: Boolean(field.not_null),
          increment: Boolean(field.increment),
          defaultValue: formatDefault(field.dbdefault),
          note: field.note?.value ?? null,
          isEnum: Boolean(field.type.isEnum) || enumNames.has(typeName),
          isForeignKey:
            foreignKeys.has(`${key}.${field.name}`) || field.inline_refs.length > 0,
          line: field.token.start.line,
          offset: field.token.start.offset,
          tokenEnd: field.token.end.offset,
          noteStart: field.note?.token.start.offset ?? null,
          noteEnd: field.note?.token.end.offset ?? null,
        };
      }),
      indexes: table.indexes.map((index) => ({
        name: index.name ?? null,
        columns: index.columns.map((column) => column.value),
        unique: Boolean(index.unique),
        pk: Boolean(index.pk),
        type: index.type ?? null,
        note: index.note?.value ?? null,
        line: index.token.start.line,
      })),
      checks: table.checks.map((check) => ({
        name: check.name ?? null,
        expression: check.expression,
        line: check.token.start.line,
      })),
      partials: table.partials.map((partial) => partial.name),
      line: table.token.start.line,
      endLine: table.token.end.line,
      offset: table.token.start.offset,
      tokenEnd: table.token.end.offset,
      noteStart: table.note?.token.start.offset ?? null,
      noteEnd: table.note?.token.end.offset ?? null,
    };
  });
  const tableMap = new Map(tables.map((table) => [table.key, table]));
  const refMap = new Map(refs.map((ref) => [ref.id, ref]));

  const enums: EnumModel[] = db.enums.map((item) => {
    const schemaName = item.schemaName || 'public';
    return {
      key: `${schemaName}.${item.name}`,
      name: item.name,
      schemaName,
      values: item.values.map((value) => value.name),
      line: item.token.start.line,
      offset: item.token.start.offset,
    };
  });

  const groups: TableGroupModel[] = db.tableGroups.map((group, index) => ({
    key: `${group.schemaName || 'public'}.${group.name || `group_${index + 1}`}`,
    name: group.name || `group_${index + 1}`,
    schemaName: group.schemaName || 'public',
    tableKeys: group.tables.map((item) => tableKey(item.schemaName, item.name)),
    color: group.color ?? null,
    note: group.note?.value ?? null,
    line: group.token.start.line,
  }));

  const stickyNotes: StickyNoteModel[] = db.notes.map((note) => ({
    name: note.name,
    content: note.content,
    color: note.color ?? null,
    line: note.token.start.line,
  }));

  const schemas = Array.from(new Set(tables.map((table) => table.schemaName))).sort();
  const project = db.project as Record<string, unknown> | undefined;
  const databaseType =
    typeof project?.database_type === 'string' ? project.database_type : null;

  return {
    tables,
    tableMap,
    refs,
    refMap,
    enums,
    enumMap: new Map(enums.map((item) => [item.key, item])),
    groups,
    stickyNotes,
    schemas,
    hasProject: Boolean(db.project),
    databaseType,
  };
}

export function tableSize(table: TableModel): { width: number; height: number } {
  const footer = table.indexes.length > 0 || table.note ? 25 : 0;
  return {
    width: 236,
    height: 42 + Math.max(table.columns.length, 1) * 27 + 8 + footer,
  };
}

export function relationLabel(ref: RefModel): string {
  const format = (relation: string) => {
    if (relation === '*') return 'N';
    if (relation === '1') return '1';
    return relation.replace('..*', '..N');
  };
  return `${format(ref.left.relation)} → ${format(ref.right.relation)}`;
}

export function refEndpointText(endpoint: RefEndpointModel): string {
  const prefix =
    endpoint.schemaName && endpoint.schemaName !== 'public'
      ? `${endpoint.schemaName}.${endpoint.tableName}`
      : endpoint.tableName;
  return `${prefix}.${endpoint.fieldNames.join(', ')}`;
}
