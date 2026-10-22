import type { ColumnModel, RefModel, TableModel, ViewModel } from './model';

export interface SourceEdit {
  start: number;
  end: number;
  text: string;
}

export interface EditOutcome {
  edits: SourceEdit[];
  tableKey?: string;
  columnName?: string;
  refId?: string;
  message?: string;
}

export interface SettingSegment {
  name: string;
  value: string | null;
  start: number;
  end: number;
  raw: string;
}

export interface SettingsRange {
  open: number;
  close: number;
}

const IDENTIFIER = /^[\p{L}_][\p{L}\p{N}_$]*$/u;

export function isValidIdentifier(value: string): boolean {
  return IDENTIFIER.test(value);
}

export function quoteIdentifier(value: string): string {
  return isValidIdentifier(value) ? value : `"${value.replace(/"/g, '""')}"`;
}

export function quoteString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
  return `'${escaped}'`;
}

export function formatDefaultValue(input: string): string {
  const value = input.trim();
  if (!value) return '';
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  if (/^(true|false|null)$/i.test(value)) return value.toLowerCase();
  if (value.startsWith('`') && value.endsWith('`')) return value;
  if (value.startsWith("'") && value.endsWith("'")) return value;
  if (value.startsWith('"') && value.endsWith('"')) return value;
  return quoteString(value);
}

export function lineStart(source: string, offset: number): number {
  const index = source.lastIndexOf('\n', Math.max(0, offset - 1));
  return index === -1 ? 0 : index + 1;
}

export function lineEnd(source: string, offset: number): number {
  const index = source.indexOf('\n', offset);
  return index === -1 ? source.length : index;
}

function blockRange(source: string, start: number, end: number): { start: number; end: number } {
  const startAt = lineStart(source, start);
  const endLine = lineEnd(source, end);
  const endAt = endLine < source.length ? endLine + 1 : source.length;
  return { start: startAt, end: endAt };
}

function skipQuoted(source: string, index: number, limit: number): number {
  const char = source[index];
  if (char === "'" || char === '"' || char === '`') {
    if (char === "'" && source.startsWith("'''", index)) {
      const close = source.indexOf("'''", index + 3);
      return close === -1 ? limit : close + 3;
    }
    let cursor = index + 1;
    while (cursor < limit) {
      if (source[cursor] === '\\') {
        cursor += 2;
        continue;
      }
      if (source[cursor] === char) return cursor + 1;
      cursor += 1;
    }
    return limit;
  }
  return index;
}

function findMatching(
  source: string,
  open: number,
  openChar: string,
  closeChar: string,
  limit: number,
): number {
  let depth = 0;
  let index = open;
  while (index < limit) {
    const char = source[index];
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuoted(source, index, limit);
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }
  return -1;
}

export function findSettingsRange(
  source: string,
  from: number,
  to: number,
): SettingsRange | null {
  const limit = Math.min(to, source.length);
  let index = Math.max(0, from);
  while (index < limit) {
    const char = source[index];
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuoted(source, index, limit);
      continue;
    }
    if (char === '[' && (index === from || /\s/.test(source[index - 1] ?? ''))) {
      const close = findMatching(source, index, '[', ']', limit);
      if (close !== -1) return { open: index, close };
    }
    index += 1;
  }
  return null;
}

function splitSegments(source: string, range: SettingsRange): SettingSegment[] {
  const segments: SettingSegment[] = [];
  const contentStart = range.open + 1;
  const contentEnd = range.close;
  let depth = 0;
  let start = contentStart;
  let index = contentStart;

  const push = (from: number, to: number) => {
    let segStart = from;
    let segEnd = to;
    while (segStart < segEnd && /\s/.test(source[segStart])) segStart += 1;
    while (segEnd > segStart && /\s/.test(source[segEnd - 1])) segEnd -= 1;
    if (segStart >= segEnd) return;
    const raw = source.slice(segStart, segEnd);
    let colon = -1;
    let localDepth = 0;
    let cursor = segStart;
    while (cursor < segEnd) {
      const char = source[cursor];
      if (char === "'" || char === '"' || char === '`') {
        cursor = skipQuoted(source, cursor, segEnd);
        continue;
      }
      if (char === '(' || char === '[') localDepth += 1;
      if (char === ')' || char === ']') localDepth -= 1;
      if (char === ':' && localDepth === 0) {
        colon = cursor;
        break;
      }
      cursor += 1;
    }
    const name = colon === -1 ? raw : source.slice(segStart, colon).trim();
    const value = colon === -1 ? null : source.slice(colon + 1, segEnd).trim();
    segments.push({
      name: name.toLowerCase().replace(/\s+/g, ' '),
      value,
      start: segStart,
      end: segEnd,
      raw,
    });
  };

  while (index < contentEnd) {
    const char = source[index];
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuoted(source, index, contentEnd);
      continue;
    }
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (char === ',' && depth === 0) {
      push(start, index);
      start = index + 1;
    }
    index += 1;
  }
  push(start, contentEnd);
  return segments;
}

function renderSetting(name: string, value: string | null | true): string {
  if (value === true) return name;
  if (value === null) return name;
  return `${name}: ${value}`;
}

interface SetSettingOptions {
  aliases?: string[];
  noSettingsInsert?: { offset: number; prefix?: string; suffix?: string };
}

function setSetting(
  source: string,
  from: number,
  to: number,
  name: string,
  value: string | null | true,
  options: SetSettingOptions = {},
): SourceEdit | null {
  const range = findSettingsRange(source, from, to);
  const aliases = new Set([name.toLowerCase(), ...(options.aliases ?? []).map((a) => a.toLowerCase())]);

  if (!range) {
    if (value === null) return null;
    const target = options.noSettingsInsert;
    if (!target) return null;
    const prefix = target.prefix ?? ' ';
    const suffix = target.suffix ?? '';
    return {
      start: target.offset,
      end: target.offset,
      text: `${prefix}[${renderSetting(name, value)}]${suffix}`,
    };
  }

  const segments = splitSegments(source, range);
  const matchIndex = segments.findIndex((segment) => aliases.has(segment.name));

  if (value === null) {
    if (matchIndex === -1) return null;
    const segment = segments[matchIndex];
    if (segments.length === 1) {
      const includeSpace =
        range.open > 0 && source[range.open - 1] === ' ' ? range.open - 1 : range.open;
      return { start: includeSpace, end: range.close + 1, text: '' };
    }
    if (matchIndex === 0) {
      const next = segments[1];
      return { start: segment.start, end: next.start, text: '' };
    }
    const previous = segments[matchIndex - 1];
    return { start: previous.end, end: segment.end, text: '' };
  }

  if (matchIndex !== -1) {
    const segment = segments[matchIndex];
    return { start: segment.start, end: segment.end, text: renderSetting(name, value) };
  }

  const content = source.slice(range.open + 1, range.close);
  const separator = content.trim().length === 0 ? '' : /,\s*$/.test(content) ? ' ' : ', ';
  return {
    start: range.close,
    end: range.close,
    text: `${separator}${renderSetting(name, value)}`,
  };
}

function generateUniqueName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function appendStatement(source: string, statement: string): SourceEdit {
  const prefix =
    source.length === 0
      ? ''
      : source.endsWith('\n\n')
        ? ''
        : source.endsWith('\n')
          ? '\n'
          : '\n\n';
  return {
    start: source.length,
    end: source.length,
    text: `${prefix}${statement}${statement.endsWith('\n') ? '' : '\n'}`,
  };
}

export function tableHeaderInfo(
  source: string,
  table: TableModel,
): { brace: number; settings: SettingsRange | null } {
  let brace = -1;
  let index = table.offset;
  while (index < table.tokenEnd) {
    const char = source[index];
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuoted(source, index, table.tokenEnd);
      continue;
    }
    if (char === '{') {
      brace = index;
      break;
    }
    index += 1;
  }
  const effectiveBrace = brace === -1 ? table.tokenEnd : brace;
  return {
    brace: effectiveBrace,
    settings: findSettingsRange(source, table.offset, effectiveBrace),
  };
}

export function createTable(
  source: string,
  view: ViewModel,
  requestedName?: string,
): EditOutcome {
  const existing = new Set(view.tables.map((table) => table.name));
  const name = generateUniqueName(requestedName?.trim() || 'new_table', existing);
  if (!isValidIdentifier(name)) {
    return { edits: [], message: '表名只能包含字母、数字、下划线，且不能以数字开头' };
  }
  const statement = `Table ${quoteIdentifier(name)} {\n  id integer [pk]\n}`;
  const edit = appendStatement(source, statement);
  return {
    edits: [edit],
    tableKey: `public.${name}`,
    message: `已新建表 ${name}`,
  };
}

export function addColumn(
  source: string,
  table: TableModel,
  requestedName?: string,
): EditOutcome {
  const existing = new Set(table.columns.map((column) => column.name));
  const name = generateUniqueName(requestedName?.trim() || 'column_1', existing);
  if (!isValidIdentifier(name)) {
    return { edits: [], message: '列名只能包含字母、数字、下划线，且不能以数字开头' };
  }
  const close = table.tokenEnd - 1;
  if (close <= table.offset) {
    return { edits: [], message: '无法定位表体' };
  }
  const before = source.slice(0, close);
  const line = `${name} integer`;
  const text = before.endsWith('\n') ? `  ${line}\n` : `\n  ${line}\n`;
  return {
    edits: [{ start: close, end: close, text }],
    columnName: name,
    message: `已新增列 ${name}`,
  };
}

function refIncludesColumn(ref: RefModel, tableKey: string, columnName: string): boolean {
  return [ref.left, ref.right].some(
    (endpoint) => endpoint.tableKey === tableKey && endpoint.fieldNames.includes(columnName),
  );
}

function findInlineRefOwner(
  view: ViewModel,
  offset: number,
): { table: TableModel; column: ColumnModel } | null {
  for (const table of view.tables) {
    for (const column of table.columns) {
      if (offset >= column.offset && offset <= column.tokenEnd) {
        return { table, column };
      }
    }
  }
  return null;
}

function removeInlineRefSetting(
  source: string,
  column: ColumnModel,
  refOffset: number,
): SourceEdit | null {
  const range = findSettingsRange(source, column.offset, column.tokenEnd);
  if (!range) return null;
  const segments = splitSegments(source, range);
  let index = segments.findIndex((segment) => refOffset >= segment.start && refOffset <= segment.end);
  if (index === -1) index = segments.findIndex((segment) => segment.name === 'ref');
  if (index === -1) return null;
  return removeSegmentEdit(source, range, segments, index);
}

function removeSegmentEdit(
  source: string,
  range: SettingsRange,
  segments: SettingSegment[],
  index: number,
): SourceEdit | null {
  const segment = segments[index];
  if (segments.length === 1) {
    const includeSpace =
      range.open > 0 && source[range.open - 1] === ' ' ? range.open - 1 : range.open;
    return { start: includeSpace, end: range.close + 1, text: '' };
  }
  if (index === 0) {
    return { start: segment.start, end: segments[1].start, text: '' };
  }
  return { start: segments[index - 1].end, end: segment.end, text: '' };
}

export function deleteTable(
  source: string,
  view: ViewModel,
  table: TableModel,
): EditOutcome {
  const edits: SourceEdit[] = [];
  const tableRange = blockRange(source, table.offset, table.tokenEnd);

  for (const ref of view.refs) {
    const involves =
      ref.left.tableKey === table.key || ref.right.tableKey === table.key;
    if (!involves) continue;

    if (ref.explicit) {
      const range = blockRange(source, ref.tokenStart, ref.tokenEnd);
      edits.push({ start: range.start, end: range.end, text: '' });
      continue;
    }

    const owner = findInlineRefOwner(view, ref.tokenStart);
    if (!owner) continue;
    if (owner.table.key === table.key) continue;
    const edit = removeInlineRefSetting(source, owner.column, ref.tokenStart);
    if (edit) edits.push(edit);
  }

  edits.push({ start: tableRange.start, end: tableRange.end, text: '' });
  return { edits: normalizeEdits(edits), message: `已删除表 ${table.name}` };
}

export function deleteColumn(
  source: string,
  view: ViewModel,
  table: TableModel,
  column: ColumnModel,
): EditOutcome {
  const edits: SourceEdit[] = [];
  const columnRange = blockRange(source, column.offset, column.tokenEnd);

  for (const ref of view.refs) {
    if (!refIncludesColumn(ref, table.key, column.name)) continue;
    if (ref.explicit) {
      const range = blockRange(source, ref.tokenStart, ref.tokenEnd);
      edits.push({ start: range.start, end: range.end, text: '' });
      continue;
    }
    const owner = findInlineRefOwner(view, ref.tokenStart);
    if (!owner || owner.table.key === table.key) continue;
    const edit = removeInlineRefSetting(source, owner.column, ref.tokenStart);
    if (edit) edits.push(edit);
  }

  edits.push({ start: columnRange.start, end: columnRange.end, text: '' });
  return { edits: normalizeEdits(edits), message: `已删除列 ${column.name}` };
}

export function addRef(
  source: string,
  fromTable: TableModel,
  fromColumn: string,
  toTable: TableModel,
  toColumn: string,
  op = '>',
): EditOutcome {
  const endpoint = (table: TableModel, column: string) =>
    `${table.schemaName === 'public' ? '' : `${quoteIdentifier(table.schemaName)}.`}${quoteIdentifier(table.name)}.${quoteIdentifier(column)}`;
  const left = endpoint(fromTable, fromColumn);
  const right = endpoint(toTable, toColumn);
  const statement = `Ref: ${left} ${op} ${right}`;
  const edit = appendStatement(source, statement);
  return {
    edits: [edit],
    message: '已创建关系',
  };
}

export function deleteRef(
  source: string,
  view: ViewModel,
  ref: RefModel,
): EditOutcome {
  if (ref.explicit) {
    const range = blockRange(source, ref.tokenStart, ref.tokenEnd);
    return {
      edits: [{ start: range.start, end: range.end, text: '' }],
      message: '已删除关系',
    };
  }
  const owner = findInlineRefOwner(view, ref.tokenStart);
  if (!owner) return { edits: [], message: '无法定位内联关系' };
  const edit = removeInlineRefSetting(source, owner.column, ref.tokenStart);
  if (!edit) return { edits: [], message: '无法移除内联关系' };
  return { edits: [edit], message: '已删除关系' };
}

export function setTableNote(
  source: string,
  table: TableModel,
  note: string | null,
): SourceEdit[] {
  const trimmed = note?.trim() ? note : null;
  const header = tableHeaderInfo(source, table);
  const noteInHeader =
    table.noteStart !== null &&
    header.settings !== null &&
    table.noteStart >= header.settings.open &&
    table.noteEnd !== null &&
    table.noteEnd <= header.settings.close;

  if (table.noteStart !== null && table.noteEnd !== null) {
    if (noteInHeader) {
      const edit = setSetting(source, table.offset, header.brace, 'note', trimmed ? quoteString(trimmed) : null);
      return edit ? [edit] : [];
    }
    if (!trimmed) {
      const range = blockRange(source, table.noteStart, table.noteEnd);
      return [{ start: range.start, end: range.end, text: '' }];
    }
    return [
      {
        start: table.noteStart,
        end: table.noteEnd,
        text: `Note: ${quoteString(trimmed)}`,
      },
    ];
  }

  if (!trimmed) return [];
  const edit = setSetting(source, table.offset, header.brace, 'note', quoteString(trimmed), {
    noSettingsInsert: { offset: header.brace, prefix: ' ' },
  });
  return edit ? [edit] : [];
}

export function setTableColor(
  source: string,
  table: TableModel,
  color: string | null,
): SourceEdit[] {
  const header = tableHeaderInfo(source, table);
  const edit = setSetting(source, table.offset, header.brace, 'headercolor', color, {
    noSettingsInsert: { offset: header.brace, prefix: ' ' },
  });
  return edit ? [edit] : [];
}

export function setColumnType(
  source: string,
  column: ColumnModel,
  typeName: string,
): SourceEdit[] {
  const trimmed = typeName.trim();
  if (!trimmed) return [];
  const settings = findSettingsRange(source, column.offset, column.tokenEnd);
  const nameEnd = column.offset + column.name.length;
  const end = settings ? settings.open : column.tokenEnd;
  const suffix = settings ? ' ' : '';
  return [{ start: nameEnd, end, text: ` ${trimmed}${suffix}` }];
}

export function setColumnSetting(
  source: string,
  column: ColumnModel,
  name: string,
  value: string | true | null,
): SourceEdit[] {
  const aliases: Record<string, string[]> = {
    'not null': ['null'],
    pk: ['primary key'],
    unique: ['unique'],
    increment: ['increment'],
    default: ['default'],
    note: ['note'],
  };
  const edit = setSetting(source, column.offset, column.tokenEnd, name, value, {
    aliases: aliases[name],
    noSettingsInsert: { offset: column.tokenEnd, prefix: ' ' },
  });
  return edit ? [edit] : [];
}

export function renameColumn(
  source: string,
  view: ViewModel,
  table: TableModel,
  column: ColumnModel,
  newName: string,
): EditOutcome {
  const trimmed = newName.trim();
  if (!isValidIdentifier(trimmed)) {
    return { edits: [], message: '列名只能包含字母、数字、下划线，且不能以数字开头' };
  }
  if (table.columns.some((item) => item.name === trimmed && item !== column)) {
    return { edits: [], message: '列名已存在' };
  }
  const referenced = view.refs.some((ref) =>
    refIncludesColumn(ref, table.key, column.name),
  );
  if (referenced) {
    return { edits: [], message: '该列已被关系引用，列改名暂未支持（P1）' };
  }
  if (table.indexes.some((index) => index.columns.includes(column.name))) {
    return { edits: [], message: '该列已被索引引用，列改名暂未支持（P1）' };
  }
  if (table.checks.length > 0) {
    return { edits: [], message: '该表包含 Check 约束，列改名暂未支持（P1）' };
  }
  return {
    edits: [
      {
        start: column.offset,
        end: column.offset + column.name.length,
        text: quoteIdentifier(trimmed),
      },
    ],
    columnName: trimmed,
    message: '已重命名列',
  };
}

export function setRefRelation(
  source: string,
  ref: RefModel,
  op: string,
): SourceEdit[] {
  if (ref.explicit) {
    return [
      {
        start: ref.left.tokenEnd,
        end: ref.right.tokenStart,
        text: ` ${op} `,
      },
    ];
  }
  const tokenText = source.slice(ref.tokenStart, ref.tokenEnd);
  const match = tokenText.match(/^\s*(\??(?:<>|[<>-])\??)/);
  if (!match) return [];
  const leading = tokenText.length - tokenText.trimStart().length;
  const start = ref.tokenStart + leading;
  return [{ start, end: start + match[1].length, text: op }];
}

export function setRefSetting(
  source: string,
  ref: RefModel,
  name: string,
  value: string | true | null,
): EditOutcome {
  if (!ref.explicit) {
    return { edits: [], message: '内联 Ref 暂不支持修改该属性，可改为长 Ref（P1）' };
  }
  const edit = setSetting(source, ref.tokenStart, ref.tokenEnd, name, value, {
    noSettingsInsert: { offset: ref.tokenEnd, prefix: ' ' },
  });
  return { edits: edit ? [edit] : [] };
}

function normalizeEdits(edits: SourceEdit[]): SourceEdit[] {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  const result: SourceEdit[] = [];
  for (const edit of sorted) {
    if (edit.start === edit.end && edit.text === '') continue;
    const previous = result[result.length - 1];
    if (previous && edit.start < previous.end) {
      if (edit.end <= previous.end) continue;
      result.push({ ...edit, start: previous.end });
      continue;
    }
    result.push(edit);
  }
  return result;
}
