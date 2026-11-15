import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/celestial.css';
import { CelestialThemeProvider } from '../lib/theme';
import { SmoothScrollProvider } from '../lib/smooth-scroll';
import { LandingApp } from '../pages/LandingApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CelestialThemeProvider>
      <SmoothScrollProvider enabled={true}>
        <LandingApp />
      </SmoothScrollProvider>
    </CelestialThemeProvider>
  </React.StrictMode>
);
