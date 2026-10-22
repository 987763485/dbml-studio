import type { ReactNode } from 'react';
import {
  Database,
  Monitor,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useAppStore } from '../../stores/appStore';
import type { ThemeMode } from '../../types';

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`switch ${checked ? 'on' : ''}`}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <span className="setting-title">{title}</span>
        <span className="setting-desc">{description}</span>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: '跟随系统', icon: Monitor },
  { id: 'light', label: '浅色', icon: Sun },
  { id: 'dark', label: '深色', icon: Moon },
];

export function SettingsDialog() {
  const open = useAppStore((state) => state.settingsOpen);
  const setOpen = useAppStore((state) => state.setSettingsOpen);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const fontSize = useAppStore((state) => state.fontSize);
  const setFontSize = useAppStore((state) => state.setFontSize);
  const edgeStyle = useAppStore((state) => state.edgeStyle);
  const setEdgeStyle = useAppStore((state) => state.setEdgeStyle);
  const layoutDirection = useAppStore((state) => state.layoutDirection);
  const setLayoutDirection = useAppStore((state) => state.setLayoutDirection);
  const showRelationLabels = useAppStore((state) => state.showRelationLabels);
  const setShowRelationLabels = useAppStore((state) => state.setShowRelationLabels);
  const showColumnTypes = useAppStore((state) => state.showColumnTypes);
  const setShowColumnTypes = useAppStore((state) => state.setShowColumnTypes);
  const backup = useAppStore((state) => state.backup);
  const setBackup = useAppStore((state) => state.setBackup);
  const autoSave = useAppStore((state) => state.autoSave);
  const setAutoSave = useAppStore((state) => state.setAutoSave);

  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <Modal
      size="lg"
      title="设置"
      subtitle="偏好只保存在本机，不会上传或同步。"
      icon={<SlidersHorizontal size={17} />}
      onClose={close}
      footer={
        <>
          <span className="settings-foot-note">
            <ShieldCheck size={12} />
            所有设置立即生效并自动保存
          </span>
          <button className="btn primary" onClick={close}>
            完成
          </button>
        </>
      }
    >
      <div className="settings">
        <section className="settings-section">
          <header className="settings-section-head">
            <Palette size={13} />
            <div>
              <h3>外观</h3>
              <p>界面、编辑器与画布共享同一套主题。</p>
            </div>
          </header>

          <div className="theme-options" role="group" aria-label="主题">
            {THEMES.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  className={`theme-option ${theme === option.id ? 'active' : ''}`}
                  aria-pressed={theme === option.id}
                  onClick={() => setTheme(option.id)}
                >
                  <span className={`theme-preview theme-preview-${option.id}`}>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="theme-label">
                    <Icon size={12} />
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>

          <SettingRow
            title="编辑器字号"
            description="Monaco 编辑器的字体大小，行高会随字号自动调整。"
          >
            <div className="range-control">
              <input
                type="range"
                min={11}
                max={17}
                step={1}
                value={fontSize}
                aria-label="编辑器字号"
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
              <span className="range-value">{fontSize}px</span>
            </div>
          </SettingRow>
        </section>

        <section className="settings-section">
          <header className="settings-section-head">
            <Database size={13} />
            <div>
              <h3>画布</h3>
              <p>调整关系线与表格信息的显示方式。</p>
            </div>
          </header>

          <SettingRow title="关系线样式" description="曲线更柔和，正交折线更接近工程图。">
            <div className="segmented settings-segmented" role="group" aria-label="关系线样式">
              <button
                className={edgeStyle === 'bezier' ? 'active' : ''}
                onClick={() => setEdgeStyle('bezier')}
              >
                曲线
              </button>
              <button
                className={edgeStyle === 'orthogonal' ? 'active' : ''}
                onClick={() => setEdgeStyle('orthogonal')}
              >
                正交
              </button>
            </div>
          </SettingRow>

          <SettingRow title="自动布局方向" description="重新整理布局时，关系图按横向或纵向展开。">
            <div className="segmented settings-segmented" role="group" aria-label="布局方向">
              <button
                className={layoutDirection === 'RIGHT' ? 'active' : ''}
                onClick={() => setLayoutDirection('RIGHT')}
              >
                向右
              </button>
              <button
                className={layoutDirection === 'DOWN' ? 'active' : ''}
                onClick={() => setLayoutDirection('DOWN')}
              >
                向下
              </button>
            </div>
          </SettingRow>

          <SettingRow title="显示字段类型" description="在每个字段右侧显示 DBML 中声明的类型。">
            <Toggle checked={showColumnTypes} onChange={setShowColumnTypes} />
          </SettingRow>

          <SettingRow title="始终显示关系标签" description="默认仅在选中表或关系时显示基数标签。">
            <Toggle checked={showRelationLabels} onChange={setShowRelationLabels} />
          </SettingRow>
        </section>

        <section className="settings-section">
          <header className="settings-section-head">
            <Save size={13} />
            <div>
              <h3>文件与数据安全</h3>
              <p>DBML 文本始终是唯一数据源，布局保存在同目录 sidecar。</p>
            </div>
          </header>

          <SettingRow
            title="覆盖前备份"
            description="保存已有文件前生成一份 .bak，只保留最近一次备份。"
          >
            <Toggle checked={backup} onChange={setBackup} />
          </SettingRow>

          <SettingRow
            title="自动保存源文件"
            description="停止编辑约 1.4 秒后写入磁盘，仅在语法正确且文件已有路径时生效。"
          >
            <Toggle checked={autoSave} onChange={setAutoSave} />
          </SettingRow>

          <div className="settings-note">
            <ShieldCheck size={13} />
            <div>
              <strong>完全离线</strong>
              <span>
                DBML Studio 不包含账号、云端同步或遥测。恢复快照保存在应用数据目录，
                每个文档最多 5 份、保留 7 天。
              </span>
            </div>
          </div>
        </section>

        <footer className="settings-about">
          <span>DBML Studio 0.1.0</span>
          <span>本地优先 · DBML 单一数据源</span>
          <span>Rust + Tauri 2</span>
        </footer>
      </div>
    </Modal>
  );
}
