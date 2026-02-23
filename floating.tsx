import React from 'react';
import { createRoot } from 'react-dom/client';
import FloatingApp from './FloatingApp';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <FloatingApp />
    </React.StrictMode>
  );
}
