import {
  ArrowRight,
  Clock3,
  CloudOff,
  FilePlus2,
  FolderOpen,
  GitBranch,
  History,
  Layers,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { BrandMark } from '../../components/BrandMark';
import { useAppStore } from '../../stores/appStore';
import { templates } from '../../core/templates';
import { formatRelative } from '../../utils';

export function WelcomeScreen() {
  const recent = useAppStore((state) => state.recent);
  const recoveries = useAppStore((state) => state.recoveries);
  const requestNew = useAppStore((state) => state.requestNew);
  const requestOpen = useAppStore((state) => state.requestOpen);
  const requestOpenPath = useAppStore((state) => state.requestOpenPath);
  const removeRecent = useAppStore((state) => state.removeRecent);
  const setRecoveryOpen = useAppStore((state) => state.setRecoveryOpen);

  return (
    <div className="welcome">
      <div className="welcome-glow" aria-hidden="true" />
      <main className="welcome-body">
        <section className="welcome-hero">
          <div className="welcome-brand">
            <BrandMark size={44} />
            <div>
              <span className="welcome-eyebrow">DBML Studio</span>
              <span className="welcome-local">
                <CloudOff size={10} />
                完全离线 · 本地文件
              </span>
            </div>
          </div>

          <h1>
            把 DBML 变成
            <br />
            <em>清晰的数据库关系图</em>
          </h1>
          <p className="welcome-lead">
            以 DBML 文本为唯一数据源，实时生成可交互的 ER 图。拖拽表、编辑字段、导出 SQL，
            所有数据只保存在你的电脑上。
          </p>

          <div className="welcome-cta">
            <button className="btn primary large" onClick={() => requestNew()}>
              <FilePlus2 size={15} />
              新建空白项目
            </button>
            <button className="btn large" onClick={requestOpen}>
              <FolderOpen size={15} />
              打开 DBML 文件
            </button>
          </div>

          <ul className="welcome-points">
            <li>
              <GitBranch size={13} />
              纯文本可纳入 Git 管理
            </li>
            <li>
              <CloudOff size={13} />
              无账号、无云端、无遥测
            </li>
            <li>
              <Layers size={13} />
              布局保存在同目录 sidecar
            </li>
          </ul>

          {recoveries.length > 0 && (
            <button className="recovery-banner" onClick={() => setRecoveryOpen(true)}>
              <span className="recovery-banner-icon">
                <History size={14} />
              </span>
              <span>
                <strong>发现 {recoveries.length} 个未保存的编辑快照</strong>
                <small>上次退出可能不是正常关闭，可随时恢复。</small>
              </span>
              <ArrowRight size={13} />
            </button>
          )}
        </section>

        <section className="welcome-side">
          <div className="welcome-panel">
            <div className="welcome-panel-head">
              <span>
                <Clock3 size={12} />
                最近打开
              </span>
              <span className="welcome-panel-count">{recent.length}</span>
            </div>
            {recent.length === 0 ? (
              <div className="recent-empty">
                <FolderOpen size={18} />
                <p>还没有最近打开的文件</p>
                <span>打开一个 .dbml 文件，它会出现在这里。</span>
              </div>
            ) : (
              <div className="recent-list">
                {recent.map((file) => {
                  const missing = file.exists === false;
                  return (
                    <div className={`recent-item ${missing ? 'missing' : ''}`} key={file.path}>
                      <button
                        className="recent-main"
                        disabled={missing}
                        title={missing ? '文件已不存在' : file.path}
                        onClick={() => requestOpenPath(file.path)}
                      >
                        <span className="recent-file-icon">
                          <span className="file-ext">DBML</span>
                        </span>
                        <span className="recent-copy">
                          <span className="recent-name">
                            {file.name}
                            {missing && <span className="missing-badge">文件缺失</span>}
                          </span>
                          <span className="recent-path">{file.path}</span>
                        </span>
                        <span className="recent-time">{formatRelative(file.lastOpened)}</span>
                      </button>
                      <button
                        className="icon-btn recent-remove"
                        title="从列表中移除"
                        aria-label="从最近文件移除"
                        onClick={() => void removeRecent(file.path)}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="welcome-panel">
            <div className="welcome-panel-head">
              <span>
                <Sparkles size={12} />
                从模板开始
              </span>
              <span className="welcome-panel-count">{templates.length}</span>
            </div>
            <div className="template-grid">
              {templates.map((template) => (
                <button
                  className="template-card"
                  key={template.id}
                  onClick={() => requestNew(template.id)}
                >
                  <span className="template-swatch" style={{ background: template.accent }} />
                  <span className="template-name">{template.name}</span>
                  <span className="template-desc">{template.description}</span>
                  <span className="template-go">
                    使用模板
                    <ArrowRight size={11} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="welcome-foot">
        <span>DBML Studio 0.1.0 · macOS arm64</span>
        <span className="welcome-foot-sep" />
        <span>文件保存在本地，不会发送到网络</span>
        <span className="welcome-foot-sep" />
        <span className="mono-input">本地优先 · DBML 单一数据源</span>
      </footer>
    </div>
  );
}
