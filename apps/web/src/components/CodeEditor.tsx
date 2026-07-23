import { useEffect, useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import type { CodingLanguage } from '@mentra/shared';

/**
 * VS Code (Monaco) editor, bundled locally (no CDN) so it works on the self-hosted,
 * offline-served build. Configured once at module load; the worker imports are Vite's
 * `?worker` bundles. `theme` follows the app between light/dark.
 */

// Bundle Monaco + its language workers with the app (instead of the default CDN loader).
(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};
loader.config({ monaco });

/** Our language keys → Monaco's built-in language ids. JavaScript-only for now. */
const MONACO_LANGUAGE: Record<CodingLanguage, string> = {
  javascript: 'javascript',
};

function prefersDark(): boolean {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr === 'dark';
  }
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = '100%',
}: {
  value: string;
  onChange?: (next: string) => void;
  language: CodingLanguage;
  readOnly?: boolean;
  height?: string | number;
}) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Re-layout when the container resizes (split-pane drags, window resize).
  useEffect(() => {
    const onResize = () => editorRef.current?.layout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <Editor
      height={height}
      language={MONACO_LANGUAGE[language]}
      theme={prefersDark() ? 'vs-dark' : 'light'}
      value={value}
      onChange={(v) => onChange?.(v ?? '')}
      onMount={(editor) => {
        editorRef.current = editor;
      }}
      loading={<div className="grid h-full place-items-center text-sm text-ink-faint">Loading editor…</div>}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        fontLigatures: true,
        fontFamily:
          "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        padding: { top: 14, bottom: 14 },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        renderLineHighlight: 'line',
        roundedSelection: true,
      }}
    />
  );
}
