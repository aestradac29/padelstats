import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Check, X, AlertCircle, Info, Copy } from './Icons';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setVisible(true), 10);
    // Trigger leave animation
    const leaveTimer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration ?? 3500);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(leaveTimer);
    };
  }, []);

  const config: Record<ToastType, { icon: React.ReactNode; bg: string; border: string; iconBg: string; text: string }> = {
    success: {
      icon: <Check size={14} strokeWidth={3} />,
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-lime-400',
      iconBg: 'bg-lime-400 text-blue-950',
      text: 'text-slate-800 dark:text-white',
    },
    error: {
      icon: <X size={14} strokeWidth={3} />,
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-red-400',
      iconBg: 'bg-red-400 text-white',
      text: 'text-slate-800 dark:text-white',
    },
    info: {
      icon: <Info size={14} />,
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-blue-400',
      iconBg: 'bg-blue-400 text-white',
      text: 'text-slate-800 dark:text-white',
    },
    warning: {
      icon: <AlertCircle size={14} />,
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-amber-400',
      iconBg: 'bg-amber-400 text-blue-950',
      text: 'text-slate-800 dark:text-white',
    },
  };

  const c = config[toast.type as ToastType];

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border-l-4 ${c.bg} ${c.border}
        min-w-[260px] max-w-[360px] pointer-events-auto
        transition-all duration-300 ease-out
        ${visible && !leaving ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-8 scale-95'}
      `}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-black ${c.iconBg}`}>
        {c.icon}
      </div>
      <p className={`text-sm font-semibold flex-1 leading-tight ${c.text}`}>{toast.message}</p>
      <button
        onClick={() => { setLeaving(true); setTimeout(() => onRemove(toast.id), 300); }}
        className="text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 transition-colors flex-shrink-0 ml-1"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration }]); // max 5 toasts
  }, []);

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast]);
  const error = useCallback((msg: string) => toast(msg, 'error'), [toast]);
  const info = useCallback((msg: string) => toast(msg, 'info'), [toast]);
  const warning = useCallback((msg: string) => toast(msg, 'warning'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-24 md:bottom-6 right-4 z-[200] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};