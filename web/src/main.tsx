import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  // Temporarily disabled StrictMode to fix auth issues
  // <StrictMode>
  <App />
  // </StrictMode>,
)
