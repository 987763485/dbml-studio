import { AlertCircle, AlertTriangle, ChevronDown, Info, Sparkles } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { editorBridge } from '../../services/editorBridge';
import { offsetAt } from '../../utils';
import type { Problem } from '../../types';

function SeverityIcon({ severity }: { severity: Problem['severity'] }) {
  if (severity === 'error') return <AlertCircle size={12} className="problem-icon error" />;
  if (severity === 'warning') return <AlertTriangle size={12} className="problem-icon warning" />;
  return <Info size={12} className="problem-icon info" />;
}

export function ProblemsPanel() {
  const problems = useAppStore((state) => state.problems);
  const problemsOpen = useAppStore((state) => state.problemsOpen);
  const toggleProblems = useAppStore((state) => state.toggleProblems);
  const content = useAppStore((state) => state.content);
  const applyQuickFix = useAppStore((state) => state.applyQuickFix);

  const errors = problems.filter((problem) => problem.severity === 'error').length;
  const warnings = problems.filter((problem) => problem.severity === 'warning').length;
  const infos = problems.length - errors - warnings;
  const first = problems[0];

  const reveal = (problem: Problem) => {
    const start = offsetAt(content, problem.startLine, problem.startColumn);
    const end = offsetAt(content, problem.endLine, problem.endColumn);
    editorBridge.revealOffset(start, end);
  };

  return (
    <div className={`problems ${problemsOpen ? 'open' : ''}`}>
      <button className="problems-bar" onClick={toggleProblems} title="展开 / 收起问题面板">
        <span
          className={`status-dot ${errors > 0 ? 'error' : warnings > 0 ? 'warn' : 'ok'}`}
        />
        {problems.length === 0 ? (
          <span>没有发现问题</span>
        ) : (
          <>
            <strong>
              {errors > 0 ? `${errors} 个错误` : `${warnings} 个警告`}
              {infos > 0 ? ` · ${infos} 条提示` : ''}
            </strong>
            <span className="sep">·</span>
            <span className="problem-msg">
              Ln {first.startLine}: {first.message}
            </span>
          </>
        )}
        {first?.quickFixes?.length ? (
          <span className="quickfix-hint">
            <Sparkles size={9} />
            可自动修复
          </span>
        ) : null}
        <ChevronDown size={11} className={`problems-chev ${problemsOpen ? 'rotated' : ''}`} />
      </button>

      {problemsOpen && (
        <div className="problems-list">
          {problems.length === 0 ? (
            <div className="problems-empty">
              语法检查通过。编辑 DBML 时，错误与警告会实时显示在这里。
            </div>
          ) : (
            problems.map((problem, index) => (
              <div
                key={`${problem.severity}-${problem.startLine}-${problem.startColumn}-${index}`}
                className={`problem-row ${problem.severity}`}
                role="button"
                tabIndex={0}
                onClick={() => reveal(problem)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    reveal(problem);
                  }
                }}
              >
                <SeverityIcon severity={problem.severity} />
                <div className="problem-main">
                  <span className="problem-text">{problem.message}</span>
                  <span className="problem-location">
                    Ln {problem.startLine}, Col {problem.startColumn}
                    {problem.code !== undefined ? ` · ${problem.code}` : ''}
                  </span>
                </div>
                {problem.quickFixes?.length ? (
                  <div className="problem-actions">
                    {problem.quickFixes.slice(0, 2).map((fix) => (
                      <button
                        key={fix.title}
                        className="problem-fix"
                        title={fix.title}
                        onClick={(event) => {
                          event.stopPropagation();
                          applyQuickFix(fix);
                        }}
                      >
                        <Sparkles size={9} />
                        {fix.shortTitle || (fix.isPreferred ? '推荐修复' : '修复')}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
