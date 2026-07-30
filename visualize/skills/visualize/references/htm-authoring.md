# htm Authoring: Escaping and Entities

## Avoiding Escaped Backticks in Output

The Write tool can corrupt JavaScript template literals, writing literal `\`` and `\${` instead of real backticks and interpolations. This breaks all htm tagged templates. To prevent it:

1. **Extract data into separate `const` variables** above the htm templates. Mermaid chart definition strings, config arrays, long text — declare them as plain constants first, then reference the variable inside `html\`...\``.
2. **Keep htm expressions simple.** Pass variables by reference (`${myVar}`, `${myArray.map(...)}`). Do not build complex multi-line strings or nested template literals inline within an `html\`...\`` block.
3. **Verify after writing.** Re-read the first 30 lines of the `<script type="module">` block in the written file and confirm there are no escaped sequences (`\`` or `\${`). If Chrome DevTools MCP is available, check the browser console for `SyntaxError` after opening the file.

## Avoiding Visible HTML Entity Text

Inside an `htm` tagged template, entity spellings such as `&gt;`, `&lt;`, and
`&amp;` are passed to Preact as ordinary text and escaped again. The rendered page
then shows the spelling itself, such as `-&gt;`, instead of the intended symbol.

- Write non-structural visible symbols directly in `html\`...\`` templates:
  `→`, `←`, `›`, `>`, `&`, and so on. A visible `<` is the exception because
  `htm` treats it as markup; render it through an expression such as `${'<'}`
  (or a named string variable) and let Preact escape it. Use the same expression
  approach for dynamic text.
- Use HTML entities only in browser-parsed markup outside `<script>` blocks.
  JavaScript source — including plain string constants and `htm` templates —
  does not decode them for you.
- Before delivery, inspect the rendered page text for visible entity spellings.
  If the browser console is available, run
  `document.body.innerText.match(/&(?:#\d+|#x[\da-f]+|[a-z][a-z0-9]+);/gi)`;
  any match must be intentional or replaced with safe text that renders the
  character the reader should see.
