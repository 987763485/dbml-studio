import { ModelExporter, Parser } from '@dbml/core';

export type SqlDialect = 'postgres' | 'mysql' | 'mssql' | 'oracle';

export const sqlDialects: { id: SqlDialect; label: string; extension: string }[] = [
  { id: 'postgres', label: 'PostgreSQL', extension: 'sql' },
  { id: 'mysql', label: 'MySQL', extension: 'sql' },
  { id: 'mssql', label: 'SQL Server', extension: 'sql' },
  { id: 'oracle', label: 'Oracle', extension: 'sql' },
];

interface DbmlDiagnostic {
  message?: string;
  location?: { start?: { line?: number } };
}

function exportErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const diags = (error as { diags?: DbmlDiagnostic[] } | null)?.diags;
  if (Array.isArray(diags) && diags.length > 0) {
    return diags
      .slice(0, 3)
      .map((diag) => {
        const line = diag.location?.start?.line;
        return `${diag.message ?? 'SQL 生成失败'}${line ? `（第 ${line} 行）` : ''}`;
      })
      .join('；');
  }
  if (typeof error === 'string') return error;
  return 'SQL 生成失败，请检查 DBML 中的类型与关系';
}

export function exportSql(source: string, dialect: SqlDialect): string {
  try {
    const database = Parser.parse(source, 'dbmlv2');
    return ModelExporter.export(database, dialect);
  } catch (error) {
    throw new Error(exportErrorMessage(error));
  }
}
