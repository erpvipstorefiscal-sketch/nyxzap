import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle2, Trash2, X, AlertCircle } from 'lucide-react';

export interface DialogOptions {
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
}

interface DialogState extends DialogOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

let openDialogFn: ((options: DialogOptions) => Promise<boolean>) | null = null;

export const confirmDialog = (options: DialogOptions | string): Promise<boolean> => {
  const opts: DialogOptions = typeof options === 'string'
    ? { title: 'Confirmação', message: options, variant: 'danger', confirmText: 'Confirmar', cancelText: 'Cancelar' }
    : {
        title: options.title || 'Confirmação',
        message: options.message,
        variant: options.variant || 'danger',
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        isAlert: false
      };

  if (openDialogFn) {
    return openDialogFn(opts);
  }
  return Promise.resolve(window.confirm(opts.message));
};

export const alertDialog = (options: DialogOptions | string): Promise<boolean> => {
  const opts: DialogOptions = typeof options === 'string'
    ? { title: 'Aviso do Sistema', message: options, variant: 'info', confirmText: 'Entendido', isAlert: true }
    : {
        title: options.title || 'Aviso do Sistema',
        message: options.message,
        variant: options.variant || 'info',
        confirmText: options.confirmText || 'Entendido',
        isAlert: true
      };

  if (openDialogFn) {
    return openDialogFn(opts);
  }
  window.alert(opts.message);
  return Promise.resolve(true);
};

export const ModalConfirmHost: React.FC = () => {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    isAlert: false
  });

  useEffect(() => {
    openDialogFn = (options: DialogOptions) => {
      return new Promise<boolean>((resolve) => {
        setDialog({
          ...options,
          isOpen: true,
          resolve
        });
      });
    };

    return () => {
      openDialogFn = null;
    };
  }, []);

  // Keyboard shortcut: ESC to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialog.isOpen) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog.isOpen]);

  const handleConfirm = () => {
    if (dialog.resolve) {
      dialog.resolve(true);
    }
    setDialog(prev => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    if (dialog.resolve) {
      dialog.resolve(false);
    }
    setDialog(prev => ({ ...prev, isOpen: false }));
  };

  if (!dialog.isOpen) return null;

  const getVariantStyles = () => {
    switch (dialog.variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6 text-rose-400" />,
          iconBg: 'bg-rose-500/15 border border-rose-500/30 text-rose-400',
          btnBg: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-900/30 border border-rose-500/40',
          glow: 'shadow-[0_0_50px_rgba(244,63,94,0.18)]'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
          iconBg: 'bg-amber-500/15 border border-amber-500/30 text-amber-400',
          btnBg: 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white shadow-lg shadow-amber-900/30 border border-amber-500/40',
          glow: 'shadow-[0_0_50px_rgba(245,158,11,0.18)]'
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
          iconBg: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400',
          btnBg: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/30 border border-emerald-500/40',
          glow: 'shadow-[0_0_50px_rgba(16,185,129,0.18)]'
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-6 h-6 text-purple-400" />,
          iconBg: 'bg-purple-500/15 border border-purple-500/30 text-purple-400',
          btnBg: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30 border border-purple-500/40',
          glow: 'shadow-[0_0_50px_rgba(168,85,247,0.18)]'
        };
    }
  };

  const style = getVariantStyles();

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={handleCancel}
    >
      <div 
        className={`relative w-full max-w-md bg-[#11131f] border border-slate-800 rounded-3xl p-6 shadow-2xl transition-all animate-scaleIn ${style.glow}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close X */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 text-slate-500 hover:text-white p-1 rounded-xl hover:bg-slate-800/60 transition-colors"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${style.iconBg}`}>
            {style.icon}
          </div>

          <div className="flex-1 pt-0.5 space-y-1.5">
            <h3 className="text-base font-bold text-white tracking-wide">
              {dialog.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {dialog.message}
            </p>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-800/80">
          {!dialog.isAlert && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-transparent hover:border-slate-700"
            >
              {dialog.cancelText || 'Cancelar'}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            autoFocus
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${style.btnBg}`}
          >
            {dialog.confirmText || (dialog.isAlert ? 'Entendido' : 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  );
};
