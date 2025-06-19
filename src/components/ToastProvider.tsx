import { useState, useCallback, ReactNode } from 'react';
import { ToastContext } from './ToastContext';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

const typeConfig: Record<ToastType, { icon: React.ComponentType<any>; colors: { bg: string; border: string; icon: string } }> = {
  success: {
    icon: CheckCircle,
    colors: {
      bg: 'from-green-500/10 to-emerald-500/10',
      border: 'border-green-500/30',
      icon: 'text-green-400',
    },
  },
  error: {
    icon: XCircle,
    colors: {
      bg: 'from-red-500/10 to-rose-500/10',
      border: 'border-red-500/30',
      icon: 'text-red-400',
    },
  },
  info: {
    icon: Info,
    colors: {
      bg: 'from-blue-500/10 to-cyan-500/10',
      border: 'border-blue-500/30',
      icon: 'text-blue-400',
    },
  },
};

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(({ type = 'info', message, duration = 3500 }: { type?: ToastType; message: string; duration?: number }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);

    if (type !== 'error') {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const closeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-[2000] space-y-3 pointer-events-none">
        {toasts.map(({ id, type, message }) => {
          const config = typeConfig[type];
          const IconComponent = config.icon;

          return (
            <div
              key={id}
              className={`
                pointer-events-auto transform transition-all duration-300 ease-out
                animate-in slide-in-from-right-full
                bg-gradient-to-r ${config.colors.bg}
                backdrop-blur-lg border ${config.colors.border}
                rounded-xl shadow-2xl shadow-black/20
                min-w-[320px] max-w-[420px] p-4
                flex items-start space-x-3
                group hover:scale-105 hover:shadow-2xl hover:shadow-black/30
              `}
              style={{
                animation: 'slideInRight 0.3s ease-out',
              }}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center">
                  <IconComponent className={`w-4 h-4 ${config.colors.icon}`} />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white capitalize mb-1">
                      {type}
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {message}
                    </p>
                  </div>

                  {/* Close button for error toasts */}
                  {type === 'error' && (
                    <button
                      onClick={() => closeToast(id)}
                      className="flex-shrink-0 ml-3 w-6 h-6 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 flex items-center justify-center transition-all duration-200 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      aria-label="Close notification"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar for auto-dismiss toasts */}
              {type !== 'error' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800/30 rounded-b-xl overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${config.colors.icon === 'text-green-400' ? 'from-green-500 to-emerald-500' : config.colors.icon === 'text-blue-400' ? 'from-blue-500 to-cyan-500' : 'from-gray-500 to-gray-400'} animate-pulse`}
                    style={{
                      animation: 'shrink 3.5s linear forwards',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        
        .animate-in {
          animation-fill-mode: both;
        }
        
        .slide-in-from-right-full {
          animation: slideInRight 0.3s ease-out;
        }
      `}</style>
    </ToastContext.Provider>
  );
}
