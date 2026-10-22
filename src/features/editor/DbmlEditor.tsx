import { useEffect, useRef, useState } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import * as monacoEditor from 'monaco-editor';
import { AlertCircle, ChevronDown, Search } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { DBML_FILE_URI, dbmlLanguage, getDbmlProviders } from '../../core/dbmlEngine';
import {
  registerEditorBridge,
  type EditorBridge,
} from '../../services/editorBridge';
import type { Problem } from '../../types';
import { modKey } from '../../utils';

let languageConfigured = false;

function configureMonaco(monaco: Monaco): void {
  if (!languageConfigured) {
    languageConfigured = true;

    monaco.languages.register({ id: 'dbml' });
    monaco.languages.setMonarchTokensProvider(
      'dbml',
      dbmlLanguage.monarch as unknown as monacoEditor.languages.IMonarchLanguage,
    );
    monaco.languages.setLanguageConfiguration(
      'dbml',
      dbmlLanguage.configuration as unknown as monacoEditor.languages.LanguageConfiguration,
    );

    const providers = getDbmlProviders();
    monaco.languages.registerDefinitionProvider('dbml', {
      provideDefinition: (
        model: monacoEditor.editor.ITextModel,
        position: monacoEditor.Position,
      ) => providers.definitionProvider.provideDefinition(model as never, position) as never,
    });
    monaco.languages.registerReferenceProvider('dbml', {
      provideReferences: (
        model: monacoEditor.editor.ITextModel,
        position: monacoEditor.Position,
      ) => providers.referenceProvider.provideReferences(model as never, position) as never,
    });
    monaco.languages.registerCompletionItemProvider('dbml', {
      triggerCharacters: providers.autocompletionProvider.triggerCharacters,
      provideCompletionItems: (
        model: monacoEditor.editor.ITextModel,
        position: monacoEditor.Position,
      ) =>
        providers.autocompletionProvider.provideCompletionItems(
          model as never,
          position,
        ) as never,
    });
    monaco.languages.registerCodeActionProvider('dbml', {
      provideCodeActions: (
        model: monacoEditor.editor.ITextModel,
        range: monacoEditor.Range,
        context: monacoEditor.languages.CodeActionContext,
        token: monacoEditor.CancellationToken,
      ) =>
        providers.codeActionProvider.provideCodeActions(
          model as never,
          range as never,
          context as never,
          token as never,
        ) as never,
    });

    monaco.editor.defineTheme('dbml-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '4f46e5', fontStyle: 'bold' },
        { token: 'keyword.wildcard', foreground: 'b45309', fontStyle: 'bold' },
        { token: 'identifier', foreground: '2b3445' },
        { token: 'string', foreground: '2f855a' },
        { token: 'string.escape', foreground: 'b45309' },
        { token: 'number', foreground: '2563eb' },
        { token: 'number.hex', foreground: 'd97706' },
        { token: 'operators', foreground: '6b7280' },
        { token: 'delimiter', foreground: '7a8496' },
        { token: 'comment', foreground: '8a94a6', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#2b3445',
        'editor.lineHighlightBackground': '#f5f6fb',
        'editor.selectionBackground': '#dfe2ff',
        'editor.inactiveSelectionBackground': '#eef0ff',
        'editorLineNumber.foreground': '#a5adbb',
        'editorLineNumber.activeForeground': '#4f46e5',
        'editorCursor.foreground': '#4f46e5',
        'editorIndentGuide.background1': '#eef1f6',
        'editorIndentGuide.activeBackground1': '#d5dbe6',
        'editorWidget.background': '#ffffff',
        'editorWidget.border': '#e4e8f0',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#e4e8f0',
        'editorSuggestWidget.selectedBackground': '#eef0ff',
        'editorHoverWidget.background': '#ffffff',
        'editorHoverWidget.border': '#e4e8f0',
        'editorGutter.background': '#ffffff',
        'scrollbarSlider.background': '#cfd5e180',
        'scrollbarSlider.hoverBackground': '#b9c2d480',
        'scrollbarSlider.activeBackground': '#a5adbb80',
      },
    });
    monaco.editor.defineTheme('dbml-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'a5b4fc', fontStyle: 'bold' },
        { token: 'keyword.wildcard', foreground: 'fbbf24', fontStyle: 'bold' },
        { token: 'identifier', foreground: 'd7deea' },
        { token: 'string', foreground: '86efac' },
        { token: 'string.escape', foreground: 'fbbf24' },
        { token: 'number', foreground: '93c5fd' },
        { token: 'number.hex', foreground: 'fcd34d' },
        { token: 'operators', foreground: '94a3b8' },
        { token: 'delimiter', foreground: '8d98ac' },
        { token: 'comment', foreground: '6b7689', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#171c27',
        'editor.foreground': '#d7deea',
        'editor.lineHighlightBackground': '#1e2433',
        'editor.selectionBackground': '#2f3561',
        'editor.inactiveSelectionBackground': '#23264a',
        'editorLineNumber.foreground': '#5b6578',
        'editorLineNumber.activeForeground': '#a5b4fc',
        'editorCursor.foreground': '#8b8cf8',
        'editorIndentGuide.background1': '#222a3a',
        'editorIndentGuide.activeBackground1': '#364058',
        'editorWidget.background': '#1e2432',
        'editorWidget.border': '#293144',
        'editorSuggestWidget.background': '#1e2432',
        'editorSuggestWidget.border': '#293144',
        'editorSuggestWidget.selectedBackground': '#23264a',
        'editorHoverWidget.background': '#1e2432',
        'editorHoverWidget.border': '#293144',
        'editorGutter.background': '#171c27',
        'scrollbarSlider.background': '#37415880',
        'scrollbarSlider.hoverBackground': '#44506980',
        'scrollbarSlider.activeBackground': '#52608080',
      },
    });
  }
}

function severityMarker(problem: Problem): number {
  if (problem.severity === 'error') return monacoEditor.MarkerSeverity.Error;
  if (problem.severity === 'warning') return monacoEditor.MarkerSeverity.Warning;
  return monacoEditor.MarkerSeverity.Info;
}

export function DbmlEditor() {
  const content = useAppStore((state) => state.content);
  const fontSize = useAppStore((state) => state.fontSize);
  const resolvedTheme = useAppStore((state) => state.resolvedTheme);
  const editorEpoch = useAppStore((state) => state.editorEpoch);
  const view = useAppStore((state) => state.view);
  const problems = useAppStore((state) => state.problems);
  const markers = useAppStore((state) => state.markers);
  const problemsOpen = useAppStore((state) => state.problemsOpen);
  const toggleProblems = useAppStore((state) => state.toggleProblems);
  const parsing = useAppStore((state) => state.parsing);
  const lastParseMs = useAppStore((state) => state.lastParseMs);

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [mounted, setMounted] = useState(0);
  const errors = problems.filter((problem) => problem.severity === 'error').length;
  const warnings = problems.filter((problem) => problem.severity === 'warning').length;

  const onMount: OnMount = (editor) => {
    cleanupRef.current?.();
    editorRef.current = editor;
    const bridge: EditorBridge = {
      applyEdits(edits) {
        const model = editor.getModel();
        if (!model || edits.length === 0) return;
        const ordered = [...edits].sort((a, b) => b.start - a.start);
        editor.pushUndoStop();
        editor.executeEdits(
          'dbml-studio',
          ordered.map((edit) => {
            const start = model.getPositionAt(edit.start);
            const end = model.getPositionAt(edit.end);
            return {
              range: {
                startLineNumber: start.lineNumber,
                startColumn: start.column,
                endLineNumber: end.lineNumber,
                endColumn: end.column,
              },
              text: edit.text,
              forceMoveMarkers: true,
            };
          }),
        );
        editor.pushUndoStop();
      },
      applyQuickFix(fix) {
        bridge.applyEdits(
          fix.edits.map((edit) => ({
            start: edit.start,
            end: edit.end,
            text: edit.newText,
          })),
        );
      },
      applyFullText(text) {
        const model = editor.getModel();
        if (!model || model.getValue() === text) return;
        editor.pushUndoStop();
        editor.executeEdits('dbml-studio', [
          { range: model.getFullModelRange(), text, forceMoveMarkers: true },
        ]);
        editor.pushUndoStop();
      },
      revealOffset(offset, endOffset) {
        const model = editor.getModel();
        if (!model) return;
        const position = model.getPositionAt(Math.max(0, offset));
        const end = model.getPositionAt(
          Math.max(model.getOffsetAt(position), endOffset ?? offset),
        );
        const range = new monacoEditor.Range(
          position.lineNumber,
          position.column,
          end.lineNumber,
          end.column,
        );
        editor.setPosition(position);
        editor.revealRangeInCenterIfOutsideViewport(range);
      },
      focus() {
        editor.focus();
      },
      undo() {
        editor.trigger('toolbar', 'undo', null);
      },
      redo() {
        editor.trigger('toolbar', 'redo', null);
      },
      find() {
        void editor.getAction('actions.find')?.run();
      },
      getContent() {
        return editor.getModel()?.getValue() ?? '';
      },
    };
    registerEditorBridge(bridge);
    const cursorSubscription = editor.onDidChangeCursorPosition((event) => {
      useAppStore.getState().setCursor({
        line: event.position.lineNumber,
        column: event.position.column,
      });
    });
    cleanupRef.current = () => {
      cursorSubscription.dispose();
      registerEditorBridge(null);
      if (editorRef.current === editor) editorRef.current = null;
    };
    setMounted((value) => value + 1);
  };

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    useAppStore.getState().setCursor({
      line: editor.getPosition()?.lineNumber ?? 1,
      column: editor.getPosition()?.column ?? 1,
    });
  }, [editorEpoch]);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    monacoEditor.editor.setModelMarkers(
      model,
      'dbml',
      markers.map((problem) => ({
        severity: severityMarker(problem),
        message: problem.message,
        startLineNumber: Math.max(1, problem.startLine),
        startColumn: Math.max(1, problem.startColumn),
        endLineNumber: Math.max(problem.startLine, problem.endLine),
        endColumn: Math.max(problem.startColumn + 1, problem.endColumn),
        code: problem.code === undefined ? undefined : String(problem.code),
        source: 'DBML',
      })),
    );
  }, [markers, mounted, resolvedTheme]);

  return (
    <div className="editor-shell">
      <div className="editor-head">
        <span className="lang-badge">DBML</span>
        <span className="editor-meta">
          {parsing
            ? '正在解析…'
            : `${view.tables.length} 表 · ${view.refs.length} 关系${lastParseMs ? ` · ${lastParseMs}ms` : ''}`}
        </span>
        <div className="editor-head-actions">
          <button className="mini-action" title={`查找（${modKey}F）`} onClick={() => editorRef.current?.getAction('actions.find')?.run()}>
            <Search size={11} />
            查找
          </button>
          <button
            className={`mini-action problems-toggle ${problemsOpen ? 'open' : ''}`}
            title="切换问题面板"
            onClick={toggleProblems}
          >
            <AlertCircle size={11} />
            {errors > 0 ? `${errors} 错误` : warnings > 0 ? `${warnings} 警告` : '无问题'}
            <ChevronDown size={10} className={problemsOpen ? 'rotated' : ''} />
          </button>
        </div>
      </div>
      <div className="editor-host">
        <Editor
          key={`editor-${editorEpoch}`}
          path={DBML_FILE_URI}
          language="dbml"
          value={content}
          beforeMount={configureMonaco}
          onMount={onMount}
          onChange={(value) => useAppStore.getState().updateContent(value ?? '')}
          theme={resolvedTheme === 'dark' ? 'dbml-dark' : 'dbml-light'}
          loading={<div className="editor-loading">正在加载 DBML 编辑器…</div>}
          options={{
            fontSize,
            lineHeight: Math.round(fontSize * 1.68),
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontLigatures: false,
            minimap: { enabled: false },
            automaticLayout: true,
            fixedOverflowWidgets: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'all',
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'off',
            padding: { top: 10, bottom: 18 },
            quickSuggestions: { other: true, comments: false, strings: false },
            wordBasedSuggestions: 'off',
            tabCompletion: 'on',
            suggestOnTriggerCharacters: true,
            bracketPairColorization: {
              enabled: true,
              independentColorPoolPerBracketType: true,
            },
            guides: { indentation: true, bracketPairs: false },
            stickyScroll: { enabled: false },
            scrollbar: {
              verticalScrollbarSize: 9,
              horizontalScrollbarSize: 9,
              useShadows: false,
            },
            contextmenu: true,
            accessibilitySupport: 'auto',
          }}
        />
      </div>
    </div>
  );
}
