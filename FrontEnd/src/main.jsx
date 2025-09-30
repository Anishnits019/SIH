import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { PatientProvider } from './store/PatientContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PatientProvider>
        <App />
      </PatientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
