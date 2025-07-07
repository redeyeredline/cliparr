// React application entry point that renders the main App component.
// Sets up the root DOM element and enables React StrictMode for development.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handler to suppress expected 404s from cleanup job status polling
window.addEventListener('error', (event) => {
  // Suppress 404 errors from cleanup job status polling
  if (event.message && event.message.includes('404') && 
      (event.filename && event.filename.includes('cleanup-job-status') || 
       event.message.includes('cleanup-job-status'))) {
    event.preventDefault();
    return false;
  }
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  // Suppress 404 errors from cleanup job status polling
  if (event.reason && event.reason.response && event.reason.response.status === 404 &&
      (event.reason.config && event.reason.config.url && event.reason.config.url.includes('cleanup-job-status') ||
       event.reason.message && event.reason.message.includes('cleanup-job-status'))) {
    event.preventDefault();
    return false;
  }
});

// Override console.error to suppress 404 errors from cleanup job status
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  if (message.includes('404') && message.includes('cleanup-job-status')) {
    return; // Suppress 404 errors from cleanup job status
  }
  originalConsoleError.apply(console, args);
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
