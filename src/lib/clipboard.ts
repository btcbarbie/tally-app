// navigator.clipboard.writeText() can silently reject (permissions, lack of
// focus, non-secure context on some mobile browsers) without throwing in a way
// callers notice unless they await it. Callers must only show a "Copied!"
// state when this actually resolves true — otherwise stale clipboard content
// (e.g. a link copied weeks earlier) gets pasted with no indication anything
// went wrong.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the execCommand fallback
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
