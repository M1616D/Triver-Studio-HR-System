/* -----------------------------------------------------------------------------
   Tailwind build config for Triverse OS.
   The app used to load cdn.tailwindcss.com (which prints a "should not be used in
   production" warning and needs the internet). This compiles the exact same
   utility set into assets/css/tailwind.css, offline and warning-free.

     npm run css        (or)  npx tailwindcss@3.4.17 -c tailwind.config.js \
                                -i assets/css/tailwind.src.css -o assets/css/tailwind.css --minify
   -------------------------------------------------------------------------- */
'use strict';

module.exports = {
  darkMode: 'class',
  content: ['./index.html', './assets/js/**/*.js', './HOW-TO-USE.md'],
  /* classes built by string concatenation in the app, which the scanner cannot see */
  safelist: [
    { pattern: /^(text|bg|border)-(red|amber|sky|violet|lime|emerald)-(300|400|500)$/ },
    { pattern: /^(bg|text|border)-(red|amber|sky|violet)-(300|400|500)\/(10|20|30|40|50|60)$/ },
    'w-full', 'text-right', 'hidden', 'block', 'inline-flex', 'flex', 'grid'
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        /* the palette, straight from the reference dashboard */
        bgMain: 'rgb(var(--bg-main) / <alpha-value>)',
        bgSidebar: 'rgb(var(--bg-sidebar) / <alpha-value>)',
        bgPanel: 'rgb(var(--bg-panel) / <alpha-value>)',
        bgPanelLighter: 'rgb(var(--bg-panel-2) / <alpha-value>)',
        accentMint: 'rgb(var(--accent) / <alpha-value>)',
        accentMintDark: 'rgb(var(--accent-dark) / <alpha-value>)',
        accentMintTrans: 'var(--accent-trans)',
        textMain: 'rgb(var(--ink) / <alpha-value>)',
        textMuted: 'rgb(var(--muted) / <alpha-value>)',
        borderMain: 'rgb(var(--line) / <alpha-value>)',
        /* aliases the screens already use */
        limeAccent: 'rgb(var(--accent) / <alpha-value>)',
        limeHover: 'rgb(var(--accent-dark) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        ink2: 'rgb(var(--ink-2) / <alpha-value>)',
        ink3: 'rgb(var(--ink-3) / <alpha-value>)',
        shell: 'rgb(var(--bg-main) / <alpha-value>)',
        panel: 'rgb(var(--bg-panel) / <alpha-value>)',
        card: 'rgb(var(--bg-panel) / <alpha-value>)',
        cardsoft: 'rgb(var(--bg-panel-2) / <alpha-value>)',
        field: 'rgb(var(--bg-panel-2) / <alpha-value>)',
        hover: 'rgb(var(--hover) / <alpha-value>)',
        track: 'rgb(var(--track) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        linesoft: 'rgb(var(--line-soft) / <alpha-value>)',
        linestrong: 'rgb(var(--line-strong) / <alpha-value>)',
        cardBorder: 'rgb(var(--line) / <alpha-value>)',
        panelBg: 'rgb(var(--bg-panel) / <alpha-value>)',
        cardBg: 'rgb(var(--bg-panel) / <alpha-value>)',
        bgDark: 'rgb(var(--bg-main) / <alpha-value>)',
        /* legacy literals retuned so light mode stays legible */
        white: 'rgb(var(--ink) / <alpha-value>)',
        'gray-200': 'rgb(var(--ink-2) / <alpha-value>)',
        'gray-300': 'rgb(var(--ink-2) / <alpha-value>)',
        'gray-400': 'rgb(var(--muted) / <alpha-value>)',
        'gray-500': 'rgb(var(--muted) / <alpha-value>)'
      },
      borderRadius: { xl: '14px', '2xl': '16px', '3xl': '22px' },
      boxShadow: {
        glow: '0 0 0 1px rgba(145,200,185,.25), 0 12px 34px -16px rgba(145,200,185,.45)',
        panel: '0 16px 40px -28px rgba(0,0,0,.85)'
      }
    }
  },
  plugins: []
};
