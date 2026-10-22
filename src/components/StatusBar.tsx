import { AlertTriangle, CheckCircle2, Loader2, MapPin, MousePointer2, WifiOff } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { diagramBridge } from '../services/diagramBridge';
import { formatClock } from '../utils';

export function StatusBar() {
  const valid = useAppStore((state) => state.valid);
  const problems = useAppStore((state) => state.problems);
  const parsing = useAppStore((state) => state.parsing);
  const lastParseMs = useAppStore((state) => state.lastParseMs);
  const view = useAppStore((state) => state.view);
  const cursor = useAppStore((state) => state.cursor);
  const zoom = useAppStore((state) => state.zoom);
  const dirty = useAppStore((state) => state.dirty);
  const saveState = useAppStore((state) => state.saveState);
  const lastSavedAt = useAppStore((state) => state.lastSavedAt);
  const toggleProblems = useAppStore((state) => state.toggleProblems);

  const errors = problems.filter((problem) => problem.severity === 'error').length;
  const warnings = problems.filter((problem) => problem.severity === 'warning').length;

  return (
    <footer className="statusbar">
      <div className="status-left">
        {parsing ? (
          <span className="status-item parsing">
            <Loader2 size={10} className="spin" />
            解析中
          </span>
        ) : valid ? (
          <span className="status-item">
            <CheckCircle2 size={10} className="ok-icon" />
            {errors === 0 ? '语法正确' : '存在错误'}
          </span>
        ) : (
          <span className="status-item danger">
            <AlertTriangle size={10} />
            语法错误 · 画布为上次有效版本
          </span>
        )}
        <span className="status-sep" />
        <button className="status-link" onClick={toggleProblems} title="打开问题面板">
          {errors} 错误 · {warnings} 警告
        </button>
        <span className="status-sep" />
        <span className="status-item">{view.tables.length} 张表</span>
        <span className="status-item">{view.refs.length} 条关系</span>
        {view.enums.length > 0 && <span className="status-item">{view.enums.length} 个枚举</span>}
      </div>

      <div className="status-right">
        <span className={`status-item ${dirty ? 'unsaved-text' : ''}`}>
          {saveState === 'saving'
            ? '保存中…'
            : dirty
              ? '未保存'
              : lastSavedAt
                ? `已保存 ${formatClock(lastSavedAt)}`
                : '已保存'}
        </span>
        <span className="status-sep" />
        <span className="status-item">
          <MousePointer2 size={10} />
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span className="status-sep" />
        <span className="status-item">
          <MapPin size={10} />
          {lastParseMs > 0 ? `${lastParseMs}ms` : '—'}
        </span>
        <span className="status-sep" />
        <button className="status-link zoom-link" onClick={() => diagramBridge.zoomTo(1)} title="重置为 100%">
          {Math.round(zoom * 100)}%
        </button>
        <span className="status-sep" />
        <span className="status-item off-line" title="完全离线运行，不发送任何网络请求">
          <WifiOff size={10} />
          本地
        </span>
      </div>
    </footer>
  );
}
