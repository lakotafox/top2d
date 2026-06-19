// escape.mjs — the un-escape / re-escape pair for game JS that lives inside the
// builder's `const loaderHTML = \`...\`` template literal.
//
// Findings from world-builder.original.html (fragment 03):
//   * NO escaped backslashes (\\) exist in the template body.
//   * The author escaped `$` ONLY when it precedes `{`  (i.e. `\${` ) to kill ${} interpolation.
//   * Literal `$` not followed by `{` (regex end-anchors, the '$' gold glyph) is LEFT RAW.
//   * Backticks are escaped as \`  (only the nested `Player Settings:...` template uses them).
//   * Closing script tags are written <\/script>.
//   * The outer template-literal delimiters (line 1 `=> ` ` <= and the closing ` `; `) are NOT
//     part of the game-JS body we extract; they belong to the scaffolding template file.
//
// These functions operate on the GAME JS BODY ONLY (between <script> and <\/script>),
// never on the scaffolding.

// template-escaped body -> clean readable JS
export function unescapeGameJs(s) {
  return s
    .replace(/<\\\/script>/g, '</script>')
    .replace(/\\\$\{/g, '${')   // \${  -> ${
    .replace(/\\`/g, '`');      // \`   -> `
}

// clean readable JS -> template-escaped body (inverse; must be EXACT)
export function reEscapeGameJs(s) {
  return s
    .replace(/`/g, '\\`')          // `    -> \`
    .replace(/\$\{/g, '\\${')      // ${   -> \${   (literal lone $ untouched)
    .replace(/<\/script>/g, '<\\/script>'); // </script> -> <\/script>
}
