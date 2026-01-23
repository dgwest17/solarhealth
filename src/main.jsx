import React from 'react';
import ReactDOM from 'react-dom/client';
import SolarCalculator from './SolarCalculator';
import './index.css';

// Error Boundary that displays errors on screen (perfect for iPad!)
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          color: 'white',
          background: '#1e293b',
          minHeight: '100vh',
          fontFamily: 'monospace'
        }}>
          <div style={{
            background: '#ef4444',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>
              ⚠️ Error Detected
            </h1>
            <p style={{ margin: 0, fontSize: '14px' }}>
              The app crashed. Error details below:
            </p>
          </div>

          <div style={{
            background: '#334155',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h2 style={{ color: '#fbbf24', fontSize: '18px', marginTop: 0 }}>
              Error Message:
            </h2>
            <pre style={{
              color: '#fca5a5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '14px'
            }}>
              {this.state.error?.toString()}
            </pre>
          </div>

          <div style={{
            background: '#334155',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h2 style={{ color: '#fbbf24', fontSize: '18px', marginTop: 0 }}>
              Stack Trace:
            </h2>
            <pre style={{
              color: '#d1d5db',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '12px',
              maxHeight: '300px',
              overflow: 'auto'
            }}>
              {this.state.error?.stack}
            </pre>
          </div>

          {this.state.errorInfo && (
            <div style={{
              background: '#334155',
              padding: '20px',
              borderRadius: '8px'
            }}>
              <h2 style={{ color: '#fbbf24', fontSize: '18px', marginTop: 0 }}>
                Component Stack:
              </h2>
              <pre style={{
                color: '#d1d5db',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '12px',
                maxHeight: '300px',
                overflow: 'auto'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '15px 30px',
              fontSize: '16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            🔄 Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Catch and display global errors too
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  
  // Create error display
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #ef4444;
    color: white;
    padding: 20px;
    z-index: 9999;
    font-family: monospace;
    max-height: 50vh;
    overflow: auto;
  `;
  errorDiv.innerHTML = `
    <h2 style="margin: 0 0 10px 0;">⚠️ JavaScript Error</h2>
    <p style="margin: 0 0 10px 0;"><strong>Message:</strong> ${event.error?.message || event.message}</p>
    <p style="margin: 0;"><strong>File:</strong> ${event.filename}:${event.lineno}:${event.colno}</p>
    <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 8px 16px; cursor: pointer;">
      Close
    </button>
  `;
  document.body.appendChild(errorDiv);
});

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #f59e0b;
    color: white;
    padding: 20px;
    z-index: 9999;
    font-family: monospace;
    max-height: 50vh;
    overflow: auto;
  `;
  errorDiv.innerHTML = `
    <h2 style="margin: 0 0 10px 0;">⚠️ Promise Rejection</h2>
    <p style="margin: 0;"><strong>Reason:</strong> ${event.reason}</p>
    <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 8px 16px; cursor: pointer;">
      Close
    </button>
  `;
  document.body.appendChild(errorDiv);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SolarCalculator />
    </ErrorBoundary>
  </React.StrictMode>,
);
