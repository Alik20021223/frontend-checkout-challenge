import { type DependencyList, useCallback, useEffect, useState } from 'react';
import { isAbort, toApiError } from '@/api/http';
import { type AsyncState, useLatest } from './useAsync';

const idle: AsyncState<never> = { pending: false, error: null, data: null };

type ResourceOptions<T> = {
  enabled?: boolean;
  pollWhile?: (data: T) => boolean;
  pollIntervalMs?: number;
};

// Загрузка по зависимостям с отменой предыдущего запроса и опциональным опросом,
// пока pollWhile возвращает true. Размонтирование останавливает и запрос, и опрос.
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  { enabled = true, pollWhile, pollIntervalMs = 1000 }: ResourceOptions<T> = {},
) {
  const [state, setState] = useState<AsyncState<T>>({ pending: enabled, error: null, data: null });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useLatest(load);
  const pollRef = useLatest(pollWhile);

  useEffect(() => {
    if (!enabled) {
      setState(idle);
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState({ pending: true, error: null, data: null });

    const tick = async () => {
      try {
        const data = await loadRef.current(controller.signal);
        if (controller.signal.aborted) return;
        setState({ pending: false, error: null, data });
        if (pollRef.current?.(data)) timer = setTimeout(tick, pollIntervalMs);
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return;
        setState((prev) => ({ ...prev, pending: false, error: toApiError(error) }));
      }
    };
    void tick();

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, attempt, pollIntervalMs, loadRef, pollRef, ...deps]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, reload };
}
