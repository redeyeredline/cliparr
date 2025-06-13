import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Performance monitoring
const measureRenderPerformance = (Component) => {
  const WrappedComponent = (props) => {
    const startTime = performance.now();
    const result = Component(props);
    const endTime = performance.now();
    console.log(`Render time for ${Component.name}: ${endTime - startTime}ms`);
    return result;
  };
  return WrappedComponent;
};

// Wrap App with performance monitoring in development
const MonitoredApp = import.meta.env.DEV ? measureRenderPerformance(App) : App;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MonitoredApp />
  </StrictMode>,
)
