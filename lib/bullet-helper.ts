/**
 * Helper to handle natural, continuous bullet-point entry in textareas.
 * - First line remains plain Item Name (no forced bullet).
 * - When Enter is pressed on a bullet line ("• " or "- "), continues with "\n• ".
 * - When Enter is pressed on an empty bullet ("• " or "-"), exits bullet mode.
 * - Shift + Enter inserts a normal line break.
 * - Non-bulleted lines insert a normal line break on Enter.
 */
export function handleBulletKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (newVal: string) => void
) {
  const target = e.currentTarget;
  const start = target.selectionStart;
  const end = target.selectionEnd;

  if (e.key === "Enter" && !e.shiftKey) {
    const textBefore = value.substring(0, start);
    const textAfter = value.substring(end);
    const lastNewline = textBefore.lastIndexOf("\n");
    const currentLine = textBefore.substring(lastNewline + 1);
    const trimmed = currentLine.trim();

    // Exit bullet mode if current line is an empty bullet
    if (trimmed === "•" || trimmed === "-") {
      e.preventDefault();
      const updated =
        textBefore.substring(0, lastNewline === -1 ? 0 : lastNewline + 1) + textAfter;
      onChange(updated);
      const newPos = lastNewline === -1 ? 0 : lastNewline + 1;
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = newPos;
      }, 0);
      return;
    }

    // Continue bullet list only if current line is already a bullet line
    if (/^\s*(•|-|\*)\s+/.test(currentLine)) {
      e.preventDefault();
      const insertText = "\n• ";
      const updated = textBefore + insertText + textAfter;
      onChange(updated);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + insertText.length;
      }, 0);
      return;
    }

    // Otherwise let normal Enter create a standard line break (preserving Item Name on line 1)
    return;
  }

  // Handle Backspace directly after "• "
  if (e.key === "Backspace" && start === end) {
    const textBefore = value.substring(0, start);
    if (textBefore.endsWith("• ")) {
      e.preventDefault();
      const updated = value.substring(0, start - 2) + value.substring(end);
      onChange(updated);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start - 2;
      }, 0);
      return;
    }
  }
}

/**
 * Inserts a bullet "• " cleanly at the cursor position (after line 1 if cursor is on Item Name)
 * and focuses the textarea for immediate typing.
 */
export function insertBulletAtCursor(
  textarea: HTMLTextAreaElement | null,
  value: string,
  onChange: (newVal: string) => void
) {
  if (!textarea) {
    const prefix = value.trim().length === 0 ? "\n• " : value.endsWith("\n") ? "• " : "\n• ";
    onChange(value + prefix);
    return;
  }

  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const firstNl = value.indexOf("\n");

  // Keep line 1 (Item Name) free of bullets: if cursor is on line 1, jump to end of line 1
  let insertPos = start;
  let endPos = end;
  if (firstNl === -1 || start <= firstNl) {
    insertPos = firstNl === -1 ? value.length : firstNl;
    endPos = insertPos;
  }

  const before = value.substring(0, insertPos);
  const after = value.substring(endPos);
  const lastNl = before.lastIndexOf("\n");
  const currentLine = before.substring(lastNl + 1);

  let snippet = "\n• ";
  if (before.length === 0) {
    snippet = "Item Name\n• ";
  } else if (before.endsWith("\n") && currentLine.length === 0) {
    snippet = "• ";
  } else if (/^\s*•\s*$/.test(currentLine)) {
    // Already on an empty bullet line; just focus
    textarea.focus();
    return;
  }

  const updated = before + snippet + after;
  onChange(updated);
  setTimeout(() => {
    textarea.focus();
    const pos = before.length + snippet.length;
    textarea.selectionStart = textarea.selectionEnd = pos;
  }, 0);
}
