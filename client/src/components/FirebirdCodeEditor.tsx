import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { indentUnit } from '@codemirror/language';
import { FirebirdSQL } from '../lib/firebirdDialect';
import { firebirdDarkTheme, firebirdLightTheme } from '../lib/firebirdTheme';
import { EditorView } from '@codemirror/view';
import { useSettings } from '../hooks/useSettings';

interface FirebirdCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string;
}

const isDark = () => document.documentElement.classList.contains('dark');

export function FirebirdCodeEditor({ value, onChange, readOnly = false, height = '200px' }: FirebirdCodeEditorProps) {
  const theme = isDark() ? firebirdDarkTheme : firebirdLightTheme;
  const settings = useSettings();

  const resolvedHeight = useMemo(() => {
    if (height !== 'auto') return height;
    const lineCount = (value || '').split('\n').length;
    return `${Math.max(80, Math.min(lineCount * 20 + 24, 600))}px`;
  }, [height, value]);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <CodeMirror
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        extensions={[
          sql({ dialect: FirebirdSQL }),
          settings.editorWordWrap ? EditorView.lineWrapping : [],
          indentUnit.of(' '.repeat(settings.editorTabSize)),
        ].flat()}
        theme={theme}
        height={resolvedHeight}
        style={{ fontSize: `${settings.editorFontSize}px` }}
        basicSetup={{
          lineNumbers: settings.editorLineNumbers,
          foldGutter: false,
          highlightActiveLine: !readOnly,
        }}
        editable={!readOnly}
      />
    </div>
  );
}
