import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-5 right-5 z-[90] flex w-[calc(100%-2.5rem)] max-w-md flex-col gap-2">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
          info: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
        };

        const borderClasses = {
          success: 'border-emerald-200 bg-emerald-50/95',
          error: 'border-red-200 bg-red-50/95',
          warning: 'border-amber-200 bg-amber-50/95',
          info: 'border-blue-200 bg-blue-50/95',
        };

        const currentBorderClass = borderClasses[toast.type] || borderClasses.info;
        const currentIcon = icons[toast.type] || icons.info;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm transition-all animate-in slide-in-from-top-2 duration-200 ${currentBorderClass}`}
          >
            {currentIcon}
            <div className="flex-1 text-sm">
              <div className="font-semibold text-gray-900">{toast.title}</div>
              {toast.message && (
                <div className="mt-0.5 text-gray-600 leading-snug">{toast.message}</div>
              )}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
