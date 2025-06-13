import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

const toastStyles = {
  position: 'fixed',
  top: 24,
  right: 24,
  zIndex: 2000,
  minWidth: 240,
  maxWidth: 400,
  background: '#181818',
  color: '#fff',
  borderRadius: 8,
  boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
  padding: '1rem 1.5rem',
  marginBottom: 12,
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const typeColors = {
  success: '#52c41a',
  error: '#ff4d4f',
  info: '#00bfff',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ type = 'info', message, duration = 3500 }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    if (type !== 'error') {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const closeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 2000 }}>
        {toasts.map(({ id, type, message }) => (
          <div key={id} style={{ ...toastStyles, borderLeft: `6px solid ${typeColors[type] || '#00bfff'}` }}>
            <span style={{ fontWeight: 700, color: typeColors[type] }}>{type === 'success' ? '✔' : type === 'error' ? '✖' : 'ℹ'}</span>
            <span style={{ flex: 1 }}>{message}</span>
            {type === 'error' && (
              <button 
                onClick={() => closeToast(id)} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#fff', 
                  fontSize: 18, 
                  cursor: 'pointer', 
                  marginLeft: 8,
                  padding: '0.25rem 0.5rem',
                  borderRadius: 4,
                  transition: 'background-color 0.2s',
                  ':hover': {
                    background: 'rgba(255,255,255,0.1)'
                  }
                }} 
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
} 