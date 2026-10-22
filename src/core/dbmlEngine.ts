import {
  Compiler,
  Filepath,
  MemoryProjectLayout,
  dbmlLanguageConfig,
  dbmlMonarchTokensProvider,
} from '@dbml/parse';
import type { Database } from '@dbml/parse';
import type { Problem, QuickFix } from '../types';

export const DBML_FILE_URI = 'file:///project/main.dbml';
const DBML_FILEPATH = Filepath.from('/project/main.dbml');

const layout = new MemoryProjectLayout();
layout.setSource(DBML_FILEPATH, '');

const compiler = new Compiler(layout);
const services = compiler.initMonacoServices({
  autocompletion: { triggerCharacters: ['.', '[', ':', ' '] },
});

let currentSource = '';
let lastValidDb: Database | null = null;
let lastResult: ParseResult | null = null;

export interface ParseResult {
  db: Database | null;
  valid: boolean;
  problems: Problem[];
  markers: Problem[];
}

function toProblem(diagnostic: {
  type: 'error' | 'warning' | 'info';
  text: string;
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
  code?: string | number;
  quickFixes?: {
    title: string;
    shortTitle?: string;
    edits: { start: number; end: number; newText: string }[];
    isPreferred?: boolean;
  }[];
}): Problem {
  const quickFixes: QuickFix[] | undefined = diagnostic.quickFixes?.map((fix) => ({
    title: fix.title,
    shortTitle: fix.shortTitle,
    edits: fix.edits,
    isPreferred: fix.isPreferred,
  }));
  return {
    severity: diagnostic.type,
    message: diagnostic.text,
    startLine: diagnostic.startRow,
    startColumn: diagnostic.startColumn,
    endLine: diagnostic.endRow,
    endColumn: diagnostic.endColumn,
    code: diagnostic.code,
    quickFixes,
  };
}

export function parseDbml(source: string): ParseResult {
  if (source === currentSource && lastResult) {
    return lastResult;
  }
  currentSource = source;
  layout.setSource(DBML_FILEPATH, source);

  let diagnostics;
  try {
    diagnostics = services.diagnosticsProvider.provideDiagnostics(DBML_FILEPATH);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const problem: Problem = {
      severity: 'error',
      message,
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 1,
    };
    lastResult = { db: lastValidDb, valid: false, problems: [problem], markers: [problem] };
    return lastResult;
  }

  const markers = diagnostics.map(toProblem);
  const seen = new Set<string>();
  const problems = markers.filter((problem) => {
    const key = `${problem.severity}|${problem.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const hasErrors = diagnostics.some((diagnostic) => diagnostic.type === 'error');
  if (hasErrors) {
    lastResult = { db: lastValidDb, valid: false, problems, markers };
    return lastResult;
  }

  try {
    const report = compiler.interpretFile(DBML_FILEPATH);
    const db = report.getValue();
    if (db) lastValidDb = db;
    lastResult = {
      db: db ?? lastValidDb,
      valid: true,
      problems,
      markers,
    };
    return lastResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const problem: Problem = {
      severity: 'error',
      message,
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 1,
    };
    lastResult = {
      db: lastValidDb,
      valid: false,
      problems: [...problems, problem],
      markers: [...markers, problem],
    };
    return lastResult;
  }
}

export function renameTableInSource(
  source: string,
  schema: string | null,
  oldName: string,
  newName: string,
): { text: string } | { error: string } {
  try {
    if (source !== currentSource) {
      parseDbml(source);
    }
    const edits = compiler.renameTable(
      DBML_FILEPATH,
      { schema: schema ?? undefined, table: oldName },
      { schema: schema ?? undefined, table: newName },
    );
    const next = edits.get(DBML_FILEPATH.absolute) ?? edits.values().next().value;
    if (!next) return { error: '表改名失败：未生成文本修改' };
    return { text: next };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function resetEngine(source: string): void {
  currentSource = source;
  lastValidDb = null;
  lastResult = null;
  layout.setSource(DBML_FILEPATH, source);
}

export const dbmlLanguage = {
  id: 'dbml',
  monarch: dbmlMonarchTokensProvider,
  configuration: dbmlLanguageConfig,
};

export function getDbmlProviders() {
  return services;
}
