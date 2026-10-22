import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function Toasts() {
  const toasts = useAppStore((state) => state.toasts);
  const dismissToast = useAppStore((state) => state.dismissToast);
  if (toasts.length === 0) return null;

  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = icons[toast.kind];
        return (
          <div key={toast.id} className={`toast ${toast.kind}`} role="status">
            <Icon size={14} className="toast-icon" />
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              title="关闭提示"
              aria-label="关闭提示"
              onClick={() => dismissToast(toast.id)}
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
