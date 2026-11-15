import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/celestial.css';
import { CelestialThemeProvider } from '../lib/theme';
import { SmoothScrollProvider } from '../lib/smooth-scroll';
import { ExplorerApp } from '../pages/ExplorerApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CelestialThemeProvider>
      <SmoothScrollProvider enabled={false}>
        <ExplorerApp />
      </SmoothScrollProvider>
    </CelestialThemeProvider>
  </React.StrictMode>
);
