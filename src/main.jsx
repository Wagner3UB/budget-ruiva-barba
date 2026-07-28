import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Splash from './components/Splash.jsx'
import ScrollTop from './components/ScrollTop.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Splash />
    <App />
    <ScrollTop />
  </React.StrictMode>,
)
