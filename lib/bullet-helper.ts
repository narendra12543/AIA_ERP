/**
 * Helper to handle natural, continuous bullet-point entry in textareas.
 * When Enter is pressed:
 * - Inserts a newline with a bullet "• "
 * - If user presses Enter on an empty bullet ("• "), clears that empty bullet line
 * - When Backspace is pressed immediately after "• ", removes both "• "
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

    // If current line is already an empty bullet "• " or "•"
    const trimmed = currentLine.trim();
    if (trimmed === "•" || trimmed === "-") {
      e.preventDefault();
      // Remove the bullet and don't insert a new one (exit bullet mode)
      const updated = textBefore.substring(0, lastNewline === -1 ? 0 : lastNewline + 1) + textAfter;
      onChange(updated);
      const newPos = lastNewline === -1 ? 0 : lastNewline + 1;
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = newPos;
      }, 0);
      return;
    }

    // Otherwise, create a new bullet on the next line
    e.preventDefault();
    const insertText = "\n• ";
    const updated = textBefore + insertText + textAfter;
    onChange(updated);
    setTimeout(() => {
      target.selectionStart = target.selectionEnd = start + insertText.length;
    }, 0);
    return;
  }

  // Handle Backspace directly after bullet
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
