import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import App from './App';
import './styles.css';

interface MonacoWorkerScope {
  MonacoEnvironment?: {
    getWorker: () => Worker;
  };
}

(globalThis as unknown as MonacoWorkerScope).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

loader.config({ monaco });

createRoot(document.getElementById('root')!).render(<App />);
