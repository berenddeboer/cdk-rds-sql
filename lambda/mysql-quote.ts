/**
 * MySQL literal and identifier quoting for SQL this library generates.
 *
 * Identifiers are backtick-quoted. Backticks stay identifier quotes when
 * ANSI_QUOTES is enabled, so identifier quoting does not depend on SQL mode.
 *
 * String literals are single-quoted. Apostrophes are doubled, which is valid
 * whether or not backslash escapes are enabled. Backslash and the other
 * MySQL string escapes are emitted only when NO_BACKSLASH_ESCAPES is off;
 * with that mode on, a backslash is an ordinary character.
 */

const NO_BACKSLASH_ESCAPES = "NO_BACKSLASH_ESCAPES"

export function quoteMysqlIdentifier(identifier: string): string {
  return `\`${identifier.replaceAll("`", "``")}\``
}

export function quoteMysqlString(value: string, sqlMode: string): string {
  const noBackslashEscapes = sqlMode.split(",").some((mode) => mode.trim() === NO_BACKSLASH_ESCAPES)
  let quoted = ""
  for (const char of value) {
    if (char === "'") {
      quoted += "''"
      continue
    }
    if (!noBackslashEscapes) {
      const escaped = backslashEscape(char)
      if (escaped !== undefined) {
        quoted += escaped
        continue
      }
    }
    quoted += char
  }
  return `'${quoted}'`
}

/**
 * Escape one character for a MySQL string literal when backslash escapes
 * are enabled. Undefined means the character is not special in that context.
 * % and _ are left alone; they are only special in LIKE patterns.
 */
function backslashEscape(char: string): string | undefined {
  switch (char) {
    case "\\":
      return "\\\\"
    case "\0":
      return "\\0"
    case "\b":
      return "\\b"
    case "\n":
      return "\\n"
    case "\r":
      return "\\r"
    case "\t":
      return "\\t"
    case "\u001a":
      return "\\Z"
    default:
      return undefined
  }
}
