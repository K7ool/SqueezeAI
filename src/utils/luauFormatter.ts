/**
 * High-precision Luau Code Formatter & Sanitizer
 * Ensures all generated scripts have clean multi-line structure,
 * proper indentation, valid type headers, and unescaped newlines.
 */

export function formatAndSanitizeLuau(rawCode: string): string {
  if (!rawCode) return "";

  let code = rawCode.trim();

  // 1. Strip markdown fences
  code = code.replace(/^```(?:lua|luau)?\r?\n?/i, '').replace(/\r?\n?```$/i, '').trim();

  // 2. Unescape double-escaped newlines/tabs if string was JSON-escaped literally
  if (code.includes('\\n') && !code.includes('\n')) {
    code = code.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }

  // 3. Normalize CRLF to LF
  code = code.replace(/\r\n/g, '\n');

  // 4. Handle --!strict or --!nonstrict stuck to next statement on line 1
  if (/^--!(?:strict|nonstrict|nocheck)\s+[^\n]+/i.test(code)) {
    code = code.replace(/^(--!(?:strict|nonstrict|nocheck))\s+([^\n]+)/i, '$1\n$2');
  }

  // 5. If code is squashed into 1 or 2 single long lines, intelligently reconstruct multi-line Luau
  const initialLines = code.split('\n');
  if (initialLines.length <= 3 && code.length > 80) {
    code = reconstructSquashedLuau(code);
  }

  // 6. Ensure --!strict is at the top if missing
  if (!code.startsWith('--!strict') && !code.startsWith('--!nonstrict')) {
    code = `--!strict\n${code}`;
  }

  // 7. Clean up trailing spaces on lines
  return code
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Reconstructs proper newlines for Luau code that was collapsed or minified
 */
function reconstructSquashedLuau(code: string): string {
  let result = code;

  // Split --!strict if attached
  result = result.replace(/^(--!(?:strict|nonstrict|nocheck))\s*/i, '$1\n');

  // Split comments that precede code on the same line
  // e.g. "-- Configuration local CONFIG = ..." -> "-- Configuration\nlocal CONFIG = ..."
  result = result.replace(/(--[^\n\r]*?)\s+(local\s+|function\s+|export\s+|type\s+|Players\.|game:)/g, '$1\n$2');

  // Common boundary splits in Luau statements
  // Split after 'end', 'end)', 'end,', 'end;'
  result = result.replace(/\b(end\)?)\s+(local\s+|function\s+|if\s+|for\s+|while\s+|return\s+|task\.|game:|Players\.|table\.|script\.)/g, '$1\n\n$2');

  // Split before top-level 'local' keywords
  result = result.replace(/([;})\]])\s*(local\s+)/g, '$1\n$2');
  result = result.replace(/(["'])\s+(local\s+[a-zA-Z_])/g, '$1\n$2');

  // Split after 'then' or 'do'
  result = result.replace(/\b(then|do)\s+(local\s+|if\s+|for\s+|while\s+|return\s+|task\.|print|warn|error|player|character|humanoid)/g, '$1\n\t$2');

  // Split before 'elseif' and 'else' and 'end'
  result = result.replace(/([;}\)\]\w"'])\s+(elseif\s+)/g, '$1\n$2');
  result = result.replace(/([;}\)\]\w"'])\s+(else)\s+/g, '$1\n$2\n\t');
  result = result.replace(/([;}\)\]\w"'])\s+(end\b)/g, '$1\n$2');

  // Split after semicolons
  result = result.replace(/;\s*(local\s+|function\s+|return\s+|task\.)/g, ';\n$1');

  // Clean empty lines
  return result;
}
