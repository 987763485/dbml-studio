import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Database,
  Download,
  FileCode2,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useAppStore } from '../../stores/appStore';
import { exportSql, sqlDialects, type SqlDialect } from '../../core/exporters';
import { applyEol } from '../../core/text';
import { canvasBridge } from '../../services/canvasBridge';
import * as platform from '../../services/platform';
import { base64EncodeUtf8, copyText } from '../../utils';
import { BrandMark } from '../../components/BrandMark';

type ExportFormat = 'sql' | 'dbml' | 'png';

const FORMATS: { id: ExportFormat; label: string; hint: string; icon: typeof Database }[] = [
  { id: 'sql', label: 'SQL', hint: '多方言建表语句', icon: Database },
  { id: 'dbml', label: 'DBML', hint: '源文本，可直接复用', icon: FileCode2 },
  { id: 'png', label: 'PNG', hint: '高清关系图图片', icon: ImageIcon },
];

const PREVIEW_LIMIT = 18_000;

function fileStem(name: string): string {
  return name.replace(/\.dbml$/i, '').trim() || 'diagram';
}

function withExtension(path: string, extension: string): string {
  const suffix = `.${extension.toLowerCase()}`;
  return path.toLowerCase().endsWith(suffix) ? path : `${path}${suffix}`;
}

export function ExportDialog() {
  const open = useAppStore((state) => state.exportOpen);
  const setOpen = useAppStore((state) => state.setExportOpen);
  const content = useAppStore((state) => state.content);
  const eol = useAppStore((state) => state.eol);
  const valid = useAppStore((state) => state.valid);
  const problems = useAppStore((state) => state.problems);
  const view = useAppStore((state) => state.view);
  const docName = useAppStore((state) => state.docName);
  const viewMode = useAppStore((state) => state.viewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const showToast = useAppStore((state) => state.showToast);

  const [format, setFormat] = useState<ExportFormat>('sql');
  const [dialect, setDialect] = useState<SqlDialect>('postgres');
  const [scope, setScope] = useState<'full' | 'view'>('full');
  const [scale, setScale] = useState<1 | 2>(2);
  const [transparent, setTransparent] = useState(false);
  const [padding, setPadding] = useState(48);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<'sql' | 'dbml' | null>(null);
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const hasTables = view.tables.length > 0;
  const errors = problems.filter((problem) => problem.severity === 'error').length;

  const sqlResult = useMemo(() => {
    if (!valid || !hasTables) return { text: '', error: '' };
    try {
      return { text: exportSql(content, dialect), error: '' };
    } catch (error) {
      return {
        text: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [content, dialect, hasTables, valid]);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setLastPath(null);
      setCopied(null);
      setCanvasReady(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sync = () => setCanvasReady(viewMode !== 'editor' && canvasBridge.isReady());
    sync();
    const timer = window.setInterval(sync, 350);
    return () => window.clearInterval(timer);
  }, [open, viewMode]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!open) return null;

  const close = () => {
    if (!busy) setOpen(false);
  };

  const extension = format === 'sql' ? 'sql' : format === 'dbml' ? 'dbml' : 'png';
  const defaultName =
    format === 'sql'
      ? `${fileStem(docName)}.${dialect}.sql`
      : format === 'dbml'
        ? `${fileStem(docName)}.dbml`
        : `${fileStem(docName)}.png`;

  const canExport =
    format === 'sql'
      ? valid && hasTables && Boolean(sqlResult.text) && !sqlResult.error
      : format === 'dbml'
        ? content.trim().length > 0
        : valid && hasTables && canvasReady;

  const exportDisabledReason = (() => {
    if (format === 'sql') {
      if (!valid || errors > 0) return '修复 DBML 语法错误后才能导出 SQL';
      if (!hasTables) return '当前文档还没有可导出的表';
      if (sqlResult.error) return 'SQL 生成失败，请检查 DBML 中的类型与关系';
      return '';
    }
    if (format === 'dbml' && !content.trim()) return '文档内容为空';
    if (format === 'png') {
      if (!valid) return '修复语法错误后才能导出图片';
      if (!hasTables) return '当前文档还没有可导出的表';
      if (!canvasReady) return '当前为仅代码视图，请切换到分栏或画布视图';
      return '';
    }
    return '';
  })();

  const previewText = format === 'sql' ? sqlResult.text : content;
  const truncated = previewText.length > PREVIEW_LIMIT;

  const copyPreview = async () => {
    const text = format === 'sql' ? sqlResult.text : content;
    if (!text) return;
    const ok = await copyText(text);
    if (ok) {
      setCopied(format === 'sql' ? 'sql' : 'dbml');
      showToast('success', format === 'sql' ? 'SQL 已复制到剪贴板' : 'DBML 已复制到剪贴板');
    } else {
      showToast('error', '复制失败，请检查剪贴板权限');
    }
  };

  const runExport = async () => {
    if (!canExport || busy) return;
    setBusy(true);
    setLastPath(null);
    try {
      const path = await platform.pickExportPath(
        defaultName,
        extension,
        format === 'sql' ? `${sqlDialects.find((item) => item.id === dialect)?.label ?? 'SQL'} 文件` : format === 'dbml' ? 'DBML' : 'PNG 图片',
      );
      if (!path) return;
      const target = withExtension(path, extension);

      if (format === 'png') {
        const dataUrl = await canvasBridge.exportPng({
          scope,
          scale,
          transparent,
          padding,
        });
        await platform.exportBinaryFile(target, dataUrl);
      } else {
        const text =
          format === 'sql' ? sqlResult.text : applyEol(content, eol);
        await platform.exportBinaryFile(target, base64EncodeUtf8(text));
      }

      setLastPath(target);
      showToast('success', `已导出到 ${platform.baseName(target)}`);
    } catch (error) {
      showToast(
        'error',
        `导出失败：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      size="lg"
      title="导出"
      subtitle={`${view.tables.length} 张表 · ${view.refs.length} 条关系 · 完全在本地生成`}
      icon={<Download size={17} />}
      onClose={close}
      footer={
        <>
          {lastPath ? (
            <button
              className="btn ghost-reveal"
              title={lastPath}
              onClick={() => void platform.revealInFileManager(lastPath)}
            >
              <FolderOpen size={13} />
              在 Finder 中显示
            </button>
          ) : (
            <span className="export-safety">
              <ShieldCheck size={12} />
              {format === 'png'
                ? '图片在本地渲染，不会上传任何数据'
                : format === 'dbml'
                  ? '导出的源文本不包含画布布局'
                  : 'SQL 只生成文本，绝不会连接或执行数据库操作'}
            </span>
          )}
          <button className="btn" onClick={close} disabled={busy}>
            取消
          </button>
          <button className="btn primary" onClick={() => void runExport()} disabled={!canExport || busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
            {busy ? '正在导出…' : format === 'png' ? '导出 PNG' : format === 'sql' ? '导出 SQL' : '另存 DBML'}
          </button>
        </>
      }
    >
      <div className="export">
        <div className="export-tabs" role="tablist" aria-label="导出格式">
          {FORMATS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={format === item.id}
                className={`export-tab ${format === item.id ? 'active' : ''}`}
                onClick={() => setFormat(item.id)}
              >
                <span className="export-tab-icon">
                  <Icon size={15} />
                </span>
                <span className="export-tab-copy">
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            );
          })}
        </div>

        {format === 'sql' && (
          <div className="export-layout">
            <div className="export-options">
              <div className="field">
                <label>SQL 方言</label>
                <div className="dialect-list">
                  {sqlDialects.map((item) => (
                    <button
                      key={item.id}
                      className={`dialect-option ${dialect === item.id ? 'active' : ''}`}
                      onClick={() => setDialect(item.id)}
                    >
                      {item.label}
                      {dialect === item.id && <Check size={11} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="export-note">
                <Database size={13} />
                <div>
                  <strong>由 @dbml/core 生成</strong>
                  <span>
                    类型字符串会按方言转换；请先在目标数据库中验证再执行。本项目不会连接任何数据库。
                  </span>
                </div>
              </div>
              <button
                className="btn export-copy"
                onClick={() => void copyPreview()}
                disabled={!sqlResult.text || Boolean(sqlResult.error)}
              >
                {copied === 'sql' ? <Check size={13} /> : <ClipboardCopy size={13} />}
                {copied === 'sql' ? '已复制' : '复制全部 SQL'}
              </button>
            </div>
            <div className="export-preview">
              <div className="export-preview-head">
                <span className="export-preview-label">
                  <FileCode2 size={11} />
                  {sqlDialects.find((item) => item.id === dialect)?.label}
                </span>
                <span className="export-preview-count">
                  {sqlResult.text ? `${sqlResult.text.split('\n').length} 行` : '—'}
                </span>
              </div>
              {sqlResult.error ? (
                <div className="export-preview-state error">
                  <AlertTriangle size={18} />
                  <strong>SQL 生成失败</strong>
                  <span>{sqlResult.error}</span>
                </div>
              ) : !valid ? (
                <div className="export-preview-state">
                  <AlertTriangle size={18} />
                  <strong>DBML 存在语法错误</strong>
                  <span>修复后即可预览并导出 SQL。</span>
                </div>
              ) : !hasTables ? (
                <div className="export-preview-state">
                  <Database size={18} />
                  <strong>还没有表</strong>
                  <span>在 DBML 中声明至少一张表后再导出。</span>
                </div>
              ) : (
                <>
                  <pre className="export-code">{previewText.slice(0, PREVIEW_LIMIT)}</pre>
                  {truncated && (
                    <div className="export-code-note">
                      <AlertTriangle size={10} />
                      预览仅显示前 {Math.round(PREVIEW_LIMIT / 1000)}k 字符，导出文件包含完整内容。
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {format === 'dbml' && (
          <div className="export-layout">
            <div className="export-options">
              <div className="export-note">
                <FileCode2 size={13} />
                <div>
                  <strong>DBML 即源文本</strong>
                  <span>
                    导出的内容与编辑器中完全一致，不包含画布布局。布局保存在同目录的
                    .layout.json sidecar 中。
                  </span>
                </div>
              </div>
              <button
                className="btn export-copy"
                onClick={() => void copyPreview()}
                disabled={!content.trim()}
              >
                {copied === 'dbml' ? <Check size={13} /> : <ClipboardCopy size={13} />}
                {copied === 'dbml' ? '已复制' : '复制全部 DBML'}
              </button>
              <div className="export-file-hint">
                <span className="export-file-icon">
                  <BrandMark size={22} />
                </span>
                <div>
                  <strong>{defaultName}</strong>
                  <span>
                    {content.split('\n').length} 行 · {new Blob([content]).size} 字节
                  </span>
                </div>
              </div>
            </div>
            <div className="export-preview">
              <div className="export-preview-head">
                <span className="export-preview-label">main.dbml</span>
                <span className="export-preview-count">UTF-8</span>
              </div>
              <pre className="export-code">{previewText.slice(0, PREVIEW_LIMIT)}</pre>
              {truncated && (
                <div className="export-code-note">
                  <AlertTriangle size={10} />
                  预览仅显示前 {Math.round(PREVIEW_LIMIT / 1000)}k 字符，导出文件包含完整内容。
                </div>
              )}
            </div>
          </div>
        )}

        {format === 'png' && (
          <div className="export-layout">
            <div className="export-options">
              <div className="field">
                <label>导出范围</label>
                <div className="segmented settings-segmented export-segmented">
                  <button
                    className={scope === 'full' ? 'active' : ''}
                    onClick={() => setScope('full')}
                  >
                    全部表
                  </button>
                  <button
                    className={scope === 'view' ? 'active' : ''}
                    onClick={() => setScope('view')}
                  >
                    当前视图
                  </button>
                </div>
              </div>
              <div className="field">
                <label>清晰度</label>
                <div className="segmented settings-segmented export-segmented">
                  <button className={scale === 1 ? 'active' : ''} onClick={() => setScale(1)}>
                    1x
                  </button>
                  <button className={scale === 2 ? 'active' : ''} onClick={() => setScale(2)}>
                    2x 高清
                  </button>
                </div>
              </div>
              <div className="field">
                <label>留白</label>
                <div className="range-control">
                  <input
                    type="range"
                    min={16}
                    max={120}
                    step={8}
                    value={padding}
                    aria-label="图片留白"
                    onChange={(event) => setPadding(Number(event.target.value))}
                    disabled={scope === 'view'}
                  />
                  <span className="range-value">{scope === 'view' ? '视口' : `${padding}px`}</span>
                </div>
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={transparent}
                  onChange={(event) => setTransparent(event.target.checked)}
                />
                <span>
                  透明背景
                  <small>适合贴进文档或幻灯片</small>
                </span>
              </label>
              <div className="export-note">
                <ImageIcon size={13} />
                <div>
                  <strong>按当前主题渲染</strong>
                  <span>
                    图片包含表头颜色、关系基数与侧边栏之外的画布内容；导出全部表时会临时计算完整边界。
                  </span>
                </div>
              </div>
            </div>
            <div className="export-preview export-image-preview">
              <div className="export-preview-head">
                <span className="export-preview-label">
                  <ImageIcon size={11} />
                  {defaultName}
                </span>
                <span className="export-preview-count">{scale}x</span>
              </div>
              <div className={`image-mock ${transparent ? 'transparent' : ''}`}>
                <div className="image-mock-canvas">
                  <div className="image-mock-table t1">
                    <i />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="image-mock-table t2">
                    <i />
                    <span />
                    <span />
                  </div>
                  <div className="image-mock-table t3">
                    <i />
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="image-mock-edge e1" />
                  <span className="image-mock-edge e2" />
                </div>
              </div>
              <div className="image-meta">
                <span>{scope === 'full' ? '完整关系图' : '当前视口范围'}</span>
                <span>·</span>
                <span>{transparent ? '透明背景' : '画布背景'}</span>
                <span>·</span>
                <span>PNG {scale}x</span>
              </div>
            </div>
          </div>
        )}

        {exportDisabledReason && (
          <div className="export-blocked">
            <AlertTriangle size={12} />
            {exportDisabledReason}
            {format === 'png' && !canvasReady && (
              <button onClick={() => setViewMode('split')}>切换到分栏视图</button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
