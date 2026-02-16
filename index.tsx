
// Polyfill for process.cwd which is needed by @lingo-reader/epub-parser in browser
if (typeof process === 'undefined') {
  (window as any).process = { env: {}, cwd: () => '' };
} else if (!process.cwd) {
  (process as any).cwd = () => '';
}

import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
