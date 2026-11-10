import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Popup } from './Popup.js'

const container = document.getElementById('root')

if (!container) {
  throw new Error('#root 엘리먼트가 없습니다')
}

createRoot(container).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
