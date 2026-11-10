export function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

export function isAbortError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';
}
