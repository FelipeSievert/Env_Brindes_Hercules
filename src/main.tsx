import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AuthGate from './auth/AuthGate'
import AppErrorBoundary from './components/AppErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary><AuthGate><App /></AuthGate></AppErrorBoundary>
  </React.StrictMode>,
)
