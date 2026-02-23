import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from '@design-studio/tokens';
import '@design-studio/tokens/tokens.css';
import '@design-studio/ui/styles.css';
import './styles.css';
import './styles/firefly.css';
import 'dialkit/styles.css';
import { DialRoot } from 'dialkit';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system">
      <App />
      <DialRoot />
    </ThemeProvider>
  </React.StrictMode>
);
