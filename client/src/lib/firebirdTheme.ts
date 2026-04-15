import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

// Matches the SqlHighlight tokenizer colors exactly
// CodeMirror SQL parser tags → same Darcula/IntelliJ palette

// ── Dark theme ──────────────────────────────────────────────────

const darkEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-code-bg)',
    color: '#a9b7c6',
    fontSize: '13px',
  },
  '.cm-content': {
    caretColor: '#f8f8f0',
    padding: '8px 0',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-cursor': { borderLeftColor: '#f8f8f0' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(33, 66, 131, 0.45) !important',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-bg-secondary)',
    color: '#606366',
    borderRight: '1px solid var(--color-border)',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#a4a3a3',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(99, 146, 37, 0.25)',
    outline: '1px solid rgba(99, 146, 37, 0.5)',
    color: '#ffef28 !important',
  },
  '.cm-selectionMatch': { backgroundColor: 'rgba(114, 152, 49, 0.15)' },
}, { dark: true });

const darkHighlightStyle = HighlightStyle.define([
  // Keyword → orange (same as SqlHighlight 'keyword')
  { tag: tags.keyword, color: '#cc7832', fontWeight: '500' },

  // Type → purple (same as SqlHighlight 'type')
  { tag: tags.typeName, color: '#b389d9' },
  { tag: tags.standard(tags.typeName), color: '#b389d9' },

  // Builtin (functions) → yellow (same as SqlHighlight 'function')
  { tag: tags.standard(tags.name), color: '#ffc66d' },

  // Number → steel blue (same as SqlHighlight 'number')
  { tag: tags.number, color: '#6897bb' },
  { tag: tags.integer, color: '#6897bb' },
  { tag: tags.float, color: '#6897bb' },

  // String → green (same as SqlHighlight 'string')
  { tag: tags.string, color: '#6a8759' },
  { tag: tags.character, color: '#6a8759' },

  // Bool, Null → orange bold (same as SqlHighlight 'constant')
  { tag: tags.bool, color: '#cc7832', fontWeight: '700' },
  { tag: tags.null, color: '#cc7832', fontWeight: '700' },

  // Comments → gray italic (same as SqlHighlight 'comment')
  { tag: tags.lineComment, color: '#808080', fontStyle: 'italic' },
  { tag: tags.blockComment, color: '#629755', fontStyle: 'italic' },
  { tag: tags.comment, color: '#808080', fontStyle: 'italic' },

  // Identifier → light text (same as SqlHighlight 'identifier')
  { tag: tags.name, color: '#a9b7c6' },
  { tag: tags.variableName, color: '#a9b7c6' },

  // QuotedIdentifier → gold (same as SqlHighlight 'quoted-identifier')
  { tag: tags.special(tags.string), color: '#e8bf6a' },

  // SpecialVar (:param) → mauve (same as SqlHighlight 'parameter')
  { tag: tags.special(tags.name), color: '#9876aa' },

  // Operator → light gray (same as SqlHighlight 'operator')
  { tag: tags.operator, color: '#a9b7c6' },
  { tag: tags.compareOperator, color: '#a9b7c6' },

  // Punctuation → neutral (same as SqlHighlight 'punctuation')
  { tag: tags.punctuation, color: '#a9b7c6' },
  { tag: tags.separator, color: '#cc7832' },
  { tag: tags.paren, color: '#a9b7c6' },
  { tag: tags.brace, color: '#a9b7c6' },
  { tag: tags.squareBracket, color: '#a9b7c6' },

  // Definitions
  { tag: tags.definition(tags.variableName), color: '#ffc66d' },
  { tag: tags.definition(tags.name), color: '#ffc66d' },
  { tag: tags.propertyName, color: '#9876aa' },
  { tag: tags.labelName, color: '#e8bf6a' },
  { tag: tags.escape, color: '#cc7832' },
]);

// ── Light theme ─────────────────────────────────────────────────

const lightEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-code-bg)',
    color: '#2b2b2b',
    fontSize: '13px',
  },
  '.cm-content': {
    caretColor: '#2b2b2b',
    padding: '8px 0',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-cursor': { borderLeftColor: '#2b2b2b' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.15) !important',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.03)' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-bg-secondary)',
    color: '#b0b0b0',
    borderRight: '1px solid var(--color-border)',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    color: '#787878',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    outline: '1px solid rgba(59, 130, 246, 0.4)',
  },
  '.cm-selectionMatch': { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
}, { dark: false });

const lightHighlightStyle = HighlightStyle.define([
  // Keyword → dark blue (same as SqlHighlight light 'keyword')
  { tag: tags.keyword, color: '#0033b3', fontWeight: '600' },

  // Type → purple (same as SqlHighlight light 'type')
  { tag: tags.typeName, color: '#7a3e9d' },
  { tag: tags.standard(tags.typeName), color: '#7a3e9d' },

  // Builtin → teal (same as SqlHighlight light 'function')
  { tag: tags.standard(tags.name), color: '#00627a' },

  // Number → blue (same as SqlHighlight light 'number')
  { tag: tags.number, color: '#1750eb' },
  { tag: tags.integer, color: '#1750eb' },
  { tag: tags.float, color: '#1750eb' },

  // String → dark green (same as SqlHighlight light 'string')
  { tag: tags.string, color: '#067d17' },
  { tag: tags.character, color: '#067d17' },

  // Bool, Null → dark blue bold (same as SqlHighlight light 'constant')
  { tag: tags.bool, color: '#0033b3', fontWeight: '700' },
  { tag: tags.null, color: '#0033b3', fontWeight: '700' },

  // Comments → gray italic
  { tag: tags.lineComment, color: '#8c8c8c', fontStyle: 'italic' },
  { tag: tags.blockComment, color: '#5f826b', fontStyle: 'italic' },
  { tag: tags.comment, color: '#8c8c8c', fontStyle: 'italic' },

  // Identifier → dark text
  { tag: tags.name, color: '#2b2b2b' },
  { tag: tags.variableName, color: '#2b2b2b' },

  // QuotedIdentifier → dark yellow (same as SqlHighlight light 'quoted-identifier')
  { tag: tags.special(tags.string), color: '#9e880d' },

  // SpecialVar → purple (same as SqlHighlight light 'parameter')
  { tag: tags.special(tags.name), color: '#660e7a' },

  // Operator
  { tag: tags.operator, color: '#2b2b2b' },
  { tag: tags.compareOperator, color: '#2b2b2b' },

  // Punctuation
  { tag: tags.punctuation, color: '#2b2b2b' },
  { tag: tags.separator, color: '#0033b3' },
  { tag: tags.paren, color: '#2b2b2b' },
  { tag: tags.brace, color: '#2b2b2b' },
  { tag: tags.squareBracket, color: '#2b2b2b' },

  // Definitions
  { tag: tags.definition(tags.variableName), color: '#00627a', fontWeight: '500' },
  { tag: tags.definition(tags.name), color: '#00627a', fontWeight: '500' },
  { tag: tags.propertyName, color: '#660e7a' },
  { tag: tags.labelName, color: '#9e880d' },
  { tag: tags.escape, color: '#0033b3' },
]);

// ── Exports ─────────────────────────────────────────────────────

export const firebirdDarkTheme: Extension = [
  darkEditorTheme,
  syntaxHighlighting(darkHighlightStyle),
];

export const firebirdLightTheme: Extension = [
  lightEditorTheme,
  syntaxHighlighting(lightHighlightStyle),
];
