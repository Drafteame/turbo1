import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { OneClickBetPillPreview } from './OneClickBetPillPreview';
import './index.css';

// Temporary isolated preview route — does not affect production behavior.
const isPillPreview = new URLSearchParams(window.location.search).get('pillPreview') === 'true';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPillPreview ? <OneClickBetPillPreview /> : <App />}
  </React.StrictMode>,
);
