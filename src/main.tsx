import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './themes/cartoon.css';
import './themes/casino.css';
import { applyTheme, lastTheme } from './themes/themes';

applyTheme(lastTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
