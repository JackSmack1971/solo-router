import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import './index.css'
import App from './App.tsx'
import { CrashFallback } from './components/CrashFallback'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={CrashFallback}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
