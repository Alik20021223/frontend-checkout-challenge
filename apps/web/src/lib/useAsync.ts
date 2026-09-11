import { useCallback, useEffect, useRef, useState } from 'react';
import { type ApiError, isAbort, toApiError } from '@/api/http';

export type AsyncState<T> = { pending: boolean; error: ApiError | null; data: T | null };

const idle: AsyncState<never> = { pending: false, error: null, data: null };

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

// Действие по запросу: ошибка попадает в состояние, а не наружу, поэтому
// у вызывающего кода нет своих try/catch. Устаревший ответ отбрасывается.
export function useAsync<A extends unknown[], T>(task: (...args: A) => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>(idle);
  const taskRef = useLatest(task);
  const version = useRef(0);

  useEffect(
    () => () => {
      version.current += 1;
    },
    [],
  );

  const run = useCallback(
    async (...args: A) => {
      const current = ++version.current;
      setState((prev) => ({ ...prev, pending: true, error: null }));
      try {
        const data = await taskRef.current(...args);
        if (current === version.current) setState({ pending: false, error: null, data });
        return data;
      } catch (error) {
        if (current === version.current && !isAbort(error))
          setState((prev) => ({ ...prev, pending: false, error: toApiError(error) }));
        return undefined;
      }
    },
    [taskRef],
  );

  const reset = useCallback(() => {
    version.current += 1;
    setState(idle);
  }, []);

  return { ...state, run, reset };
}
