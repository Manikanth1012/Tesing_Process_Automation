import { useEffect, useRef, useCallback } from 'react';

/**
 * useSSE — subscribes to a server-sent events endpoint.
 * @param {string|null} url — full SSE URL; null = disabled
 * @param {function} onMessage — called with { type, content }
 * @param {object} options
 */
export function useSSE(url, onMessage, { enabled = true } = {}) {
  const esRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const close = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!url || !enabled) return;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessageRef.current(data);
      } catch (_) {
        onMessageRef.current({ type: 'output', content: e.data });
      }
    });

    es.onerror = () => {
      // SSE auto-reconnects; close on repeated errors
      es.close();
    };

    return close;
  }, [url, enabled, close]);

  return { close };
}
