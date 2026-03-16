import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import SharedReport from './screens/SharedReport.jsx'

const sharedReportMatch = window.location.pathname.match(/^\/report\/([^/]+)$/)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {sharedReportMatch
      ? <SharedReport token={sharedReportMatch[1]} />
      : <App />
    }
  </StrictMode>,
)
