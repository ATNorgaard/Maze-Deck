import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../packages/ui/src/styles/index.css';
import './app.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('No #root in the document');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
