import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import TestIdFinder from './TestIdFinder.jsx'
import NetworkInterceptor from './NetworkInterceptor.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NetworkInterceptor>
      <TestIdFinder>
        <App />
      </TestIdFinder>
    </NetworkInterceptor>
  </React.StrictMode>,
)