/**
 * Monaco Editor Theme definition for AI-Dost Editorial Workbench.
 * Muted, high-contrast, non-neon semantic syntax tokens matching Ink & Paper.
 */

export const AIDOST_DARK_THEME = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'f4f0e8', background: '11100f' },
    { token: 'comment', foreground: '78716c', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'd45b3f', fontStyle: 'bold' }, // Terracotta
    { token: 'keyword.control', foreground: 'd45b3f' },
    { token: 'string', foreground: '7fa988' }, // Muted Sage Green
    { token: 'string.escape', foreground: 'b78945' }, // Muted Amber
    { token: 'number', foreground: 'cca466' },
    { token: 'regexp', foreground: 'd9826c' },
    { token: 'type', foreground: 'e0c7a0' },
    { token: 'class', foreground: 'e0c7a0', fontStyle: 'bold' },
    { token: 'function', foreground: 'ded8cc' },
    { token: 'variable', foreground: 'f4f0e8' },
    { token: 'variable.predefined', foreground: 'd45b3f' },
    { token: 'constant', foreground: 'cca466' },
    { token: 'operator', foreground: 'b7afa2' },
    { token: 'delimiter', foreground: '8c8275' },
    { token: 'tag', foreground: 'd45b3f' },
    { token: 'attribute.name', foreground: 'cca466' },
    { token: 'attribute.value', foreground: '7fa988' },
  ],
  colors: {
    'editor.background': '#11100f', // --ink-950
    'editor.foreground': '#f4f0e8', // --paper-100
    'editor.lineHighlightBackground': '#171614', // --ink-900
    'editor.selectionBackground': '#262320', // --ink-800
    'editor.inactiveSelectionBackground': '#1e1c1a', // --ink-850
    'editorCursor.foreground': '#d45b3f', // --accent-primary
    'editorWhitespace.foreground': '#262320',
    'editorIndentGuide.background': '#1e1c1a',
    'editorIndentGuide.activeBackground': '#3a3632',
    'editorLineNumber.foreground': '#57534e',
    'editorLineNumber.activeForeground': '#ded8cc',
    'editorGutter.background': '#11100f',
    'editorBracketMatch.background': '#262320',
    'editorBracketMatch.border': '#d45b3f',
    'editorOverviewRuler.border': '#1e1c1a',
    'editorError.foreground': '#b9574e',
    'editorWarning.foreground': '#b78945',
    'editorInfo.foreground': '#5d7895',
  },
};

export const AIDOST_LIGHT_THEME = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: '', foreground: '1c1917', background: 'fbfaf7' },
    { token: 'comment', foreground: '8c8275', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'b8452f', fontStyle: 'bold' },
    { token: 'string', foreground: '436d4f' },
    { token: 'number', foreground: '966627' },
    { token: 'type', foreground: '785124' },
    { token: 'function', foreground: '292524' },
    { token: 'variable', foreground: '1c1917' },
    { token: 'delimiter', foreground: '78716c' },
  ],
  colors: {
    'editor.background': '#fbfaf7',
    'editor.foreground': '#1c1917',
    'editor.lineHighlightBackground': '#f4f0e8',
    'editor.selectionBackground': '#ded8cc',
    'editorCursor.foreground': '#b8452f',
    'editorLineNumber.foreground': '#a8a29e',
    'editorLineNumber.activeForeground': '#1c1917',
  },
};

export function configureMonacoThemes(monaco) {
  if (!monaco) return;
  monaco.editor.defineTheme('aidost-dark', AIDOST_DARK_THEME);
  monaco.editor.defineTheme('aidost-light', AIDOST_LIGHT_THEME);
}
