import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { seedDemoData } from './db/schema'
import './index.css'

seedDemoData().catch(console.error)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)