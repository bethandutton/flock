/* ---------------------------- Colour helpers ---------------------------- */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}
const lighten = (hex, t) => mix(hex, '#ffffff', t);
const darken = (hex, t) => mix(hex, '#000000', t);
function alpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function readableText(hex) {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#10233a' : '#ffffff';
}

/* -------------------------------- Themes -------------------------------- */

const ANSI_DARK = {
  black: '#2b2b2b', red: '#ff6b6b', green: '#7bd88f', yellow: '#f4d03f',
  blue: '#6ab0f3', magenta: '#c792ea', cyan: '#5ad4e6', white: '#e6e6e6',
  brightBlack: '#5c5c5c', brightRed: '#ff8787', brightGreen: '#95e6a8', brightYellow: '#f7dd6b',
  brightBlue: '#8cc4f7', brightMagenta: '#d6adf0', brightCyan: '#82e0ee', brightWhite: '#ffffff',
};

const THEMES = {
  // Drawn from the app icon: dusk lavender, fleece mint, arrow coral
  fleece: {
    label: 'Fleece',
    swatch: ['#242332', '#2d2b40', '#8fe6c6'],
    ui: {
      '--bg': '#242332', '--bar-bg': '#2d2b40', '--pen-header': '#2d2b40', '--pen-header-active': '#363450',
      '--text': '#d9d6ec', '--text-muted': '#8f8ba8', '--border': '#17161f', '--hover': '#3d3a58',
      '--accent': '#8fe6c6', '--accent-hover': '#a5efd4', '--accent-active': '#79d1b2', '--accent-text': '#10241c',
      '--secondary-bg': '#3d3a58', '--secondary-hover': '#494566', '--secondary-active': '#322f4a',
      '--attention': '#f5a08c', '--scrollbar': '#494566', '--panel-bg': '#2d2b40', '--panel-border': '#413e5c', '--input-bg': '#1f1e2b',
    },
    term: {
      background: '#242332', foreground: '#d9d6ec', cursor: '#8fe6c6', cursorAccent: '#242332', selectionBackground: '#3d3a58',
      black: '#2d2b40', red: '#f59a8c', green: '#8fe6c6', yellow: '#ecd6a1', blue: '#9db4ee', magenta: '#c9aded', cyan: '#8fd8e6', white: '#d9d6ec',
      brightBlack: '#6f6b8a', brightRed: '#f8b3a8', brightGreen: '#aeeed6', brightYellow: '#f2e2b8', brightBlue: '#b6c8f3', brightMagenta: '#dac4f2', brightCyan: '#abe4ee', brightWhite: '#f2f0fa',
    },
  },
  meadow: {
    label: 'Meadow',
    swatch: ['#1d2725', '#26302d', '#b5bd68'],
    ui: {
      '--bg': '#1d2725', '--bar-bg': '#26302d', '--pen-header': '#26302d', '--pen-header-active': '#2f3a37',
      '--text': '#c6ccc9', '--text-muted': '#7c857f', '--border': '#131b19', '--hover': '#38423f',
      '--accent': '#b5bd68', '--accent-hover': '#c6cd82', '--accent-active': '#9aa257', '--accent-text': '#12201d',
      '--secondary-bg': '#38423f', '--secondary-hover': '#434e4a', '--secondary-active': '#2c3633',
      '--attention': '#8abeb7', '--scrollbar': '#434e4a', '--panel-bg': '#26302d', '--panel-border': '#3a4441', '--input-bg': '#1d2725',
    },
    term: {
      background: '#1d2725', foreground: '#c6ccc9', cursor: '#c6ccc9', cursorAccent: '#1d2725', selectionBackground: '#37413e',
      black: '#1d2725', red: '#cc6666', green: '#b5bd68', yellow: '#f0c674', blue: '#81a2be', magenta: '#b294bb', cyan: '#8abeb7', white: '#c6ccc9',
      brightBlack: '#666666', brightRed: '#d54e53', brightGreen: '#b9ca4a', brightYellow: '#e7c547', brightBlue: '#7aa6da', brightMagenta: '#c397d8', brightCyan: '#70c0b1', brightWhite: '#eaeaea',
    },
  },
  dark: {
    label: 'Dark',
    swatch: ['#1e1e1e', '#262626', '#2f8f4f'],
    ui: {
      '--bg': '#1e1e1e', '--bar-bg': '#262626', '--pen-header': '#262626', '--pen-header-active': '#303030',
      '--text': '#e6e6e6', '--text-muted': '#8a8a8a', '--border': '#000000', '--hover': '#3a3a3a',
      '--accent': '#2f8f4f', '--accent-hover': '#38a95d', '--accent-active': '#26743f', '--accent-text': '#ffffff',
      '--secondary-bg': '#3a3a3a', '--secondary-hover': '#474747', '--secondary-active': '#2f2f2f',
      '--attention': '#5ad4e6', '--scrollbar': '#444444', '--panel-bg': '#2f2f2f', '--panel-border': '#555555', '--input-bg': '#1e1e1e',
    },
    term: { background: '#1e1e1e', foreground: '#e6e6e6', cursor: '#ffffff', cursorAccent: '#1e1e1e', selectionBackground: '#2f6b40', ...ANSI_DARK },
  },
  light: {
    label: 'Light',
    swatch: ['#ffffff', '#ececec', '#2f9e57'],
    ui: {
      '--bg': '#ffffff', '--bar-bg': '#ececec', '--pen-header': '#ececec', '--pen-header-active': '#e0e0e0',
      '--text': '#1e1e1e', '--text-muted': '#767676', '--border': '#d0d0d0', '--hover': '#dcdcdc',
      '--accent': '#2f9e57', '--accent-hover': '#39b365', '--accent-active': '#268a49', '--accent-text': '#ffffff',
      '--secondary-bg': '#dedede', '--secondary-hover': '#d2d2d2', '--secondary-active': '#c8c8c8',
      '--attention': '#0e8faf', '--scrollbar': '#c4c4c4', '--panel-bg': '#f6f6f6', '--panel-border': '#cfcfcf', '--input-bg': '#ffffff',
    },
    term: {
      background: '#ffffff', foreground: '#1e1e1e', cursor: '#1e1e1e', cursorAccent: '#ffffff', selectionBackground: '#b8d4f5',
      black: '#3b3b3b', red: '#c0392b', green: '#1e8a4c', yellow: '#b8860b', blue: '#2f7fe0', magenta: '#8e44ad', cyan: '#0e8faf', white: '#3b3b3b',
      brightBlack: '#767676', brightRed: '#e74c3c', brightGreen: '#27ae60', brightYellow: '#d4a017', brightBlue: '#4a92e8', brightMagenta: '#a569bd', brightCyan: '#17a2b8', brightWhite: '#1e1e1e',
    },
  },
  grass: {
    label: 'Grass',
    swatch: ['#0a1a0d', '#0f2a15', '#4fe07a'],
    ui: {
      '--bg': '#0a1a0d', '--bar-bg': '#0f2a15', '--pen-header': '#0f2a15', '--pen-header-active': '#163a1f',
      '--text': '#b7f5c4', '--text-muted': '#5f9c6d', '--border': '#04120a', '--hover': '#1c4527',
      '--accent': '#4fe07a', '--accent-hover': '#6cea92', '--accent-active': '#3fc766', '--accent-text': '#062910',
      '--secondary-bg': '#1c4527', '--secondary-hover': '#245c33', '--secondary-active': '#163a1f',
      '--attention': '#4fe0b0', '--scrollbar': '#2a5c38', '--panel-bg': '#0f2a15', '--panel-border': '#245c33', '--input-bg': '#0a1a0d',
    },
    term: {
      background: '#0a1a0d', foreground: '#b7f5c4', cursor: '#4fe07a', cursorAccent: '#0a1a0d', selectionBackground: '#1c6b32',
      black: '#0f2a15', red: '#ff7b6b', green: '#4fe07a', yellow: '#c8e04f', blue: '#4fd0e0', magenta: '#9be04f', cyan: '#4fe0b0', white: '#b7f5c4',
      brightBlack: '#5f9c6d', brightRed: '#ff9b8b', brightGreen: '#7cea9a', brightYellow: '#d8ea7c', brightBlue: '#7ce0ea', brightMagenta: '#b7ea7c', brightCyan: '#7ceac8', brightWhite: '#e6ffe9',
    },
  },
  'high-contrast': {
    label: 'High Contrast',
    swatch: ['#000000', '#000000', '#ffff00'],
    ui: {
      '--bg': '#000000', '--bar-bg': '#000000', '--pen-header': '#000000', '--pen-header-active': '#1a1a1a',
      '--text': '#ffffff', '--text-muted': '#cccccc', '--border': '#ffffff', '--hover': '#333333',
      '--accent': '#ffff00', '--accent-hover': '#ffff66', '--accent-active': '#e6e600', '--accent-text': '#000000',
      '--secondary-bg': '#1a1a1a', '--secondary-hover': '#333333', '--secondary-active': '#000000',
      '--attention': '#55ffff', '--scrollbar': '#ffffff', '--panel-bg': '#000000', '--panel-border': '#ffffff', '--input-bg': '#000000',
    },
    term: {
      background: '#000000', foreground: '#ffffff', cursor: '#ffff00', cursorAccent: '#000000', selectionBackground: '#5555ff',
      black: '#000000', red: '#ff5555', green: '#55ff55', yellow: '#ffff55', blue: '#5555ff', magenta: '#ff55ff', cyan: '#55ffff', white: '#ffffff',
      brightBlack: '#888888', brightRed: '#ff8888', brightGreen: '#88ff88', brightYellow: '#ffff88', brightBlue: '#8888ff', brightMagenta: '#ff88ff', brightCyan: '#88ffff', brightWhite: '#ffffff',
    },
  },
};

function customTheme(c) {
  const bg = c.bg, header = c.header, text = c.text, accent = c.accent;
  return {
    label: 'Custom',
    ui: {
      '--bg': bg, '--bar-bg': header, '--pen-header': header, '--pen-header-active': lighten(header, 0.08),
      '--text': text, '--text-muted': alpha(text, 0.55), '--border': darken(header, 0.4), '--hover': lighten(header, 0.14),
      '--accent': accent, '--accent-hover': lighten(accent, 0.12), '--accent-active': darken(accent, 0.1), '--accent-text': readableText(accent),
      '--secondary-bg': lighten(header, 0.1), '--secondary-hover': lighten(header, 0.16), '--secondary-active': header,
      '--attention': '#5ad4e6',
      '--scrollbar': lighten(header, 0.2), '--panel-bg': lighten(bg, 0.06), '--panel-border': lighten(header, 0.2), '--input-bg': darken(bg, 0.06),
    },
    term: { background: bg, foreground: text, cursor: accent, cursorAccent: bg, selectionBackground: alpha(accent, 0.4), ...ANSI_DARK },
  };
}
