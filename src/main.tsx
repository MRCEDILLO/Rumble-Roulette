import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './themes/cartoon.css';
import { applyTheme, DEFAULT_THEME } from './themes/themes';

applyTheme(DEFAULT_THEME);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
