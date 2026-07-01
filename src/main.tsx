import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { seedDemoData, db } from './db/schema'
import { useAppStore } from './hooks/useAppStore'
import './index.css'

async function initApp() {
  await seedDemoData()
  
  const queueCount = await db.syncQueue.count()
  if (queueCount > 0) {
    useAppStore.getState().setPendingSync(queueCount)
  }
  
  useAppStore.getState().setLastSyncAt(Date.now())
}

initApp().catch(console.error)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope)
      })
      .catch((error) => {
        console.log('SW registration failed:', error)
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)