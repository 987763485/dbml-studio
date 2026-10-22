import { useAppStore } from '../../stores/appStore';
import { Sidebar } from '../sidebar/Sidebar';
import { DbmlEditor } from '../editor/DbmlEditor';
import { ProblemsPanel } from '../editor/ProblemsPanel';
import { DiagramCanvas } from '../diagram/DiagramCanvas';

export function Workspace() {
  const viewMode = useAppStore((state) => state.viewMode);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);

  return (
    <div
      className={[
        'main',
        `mode-${viewMode}`,
        sidebarCollapsed ? 'sidebar-hidden' : 'sidebar-visible',
      ].join(' ')}
    >
      {!sidebarCollapsed && <Sidebar />}
      {viewMode !== 'canvas' && (
        <section className="editor-pane" aria-label="DBML 编辑器">
          <DbmlEditor />
          <ProblemsPanel />
        </section>
      )}
      {viewMode !== 'editor' && (
        <section className="canvas-pane" aria-label="关系图画布">
          <DiagramCanvas />
        </section>
      )}
    </div>
  );
}
