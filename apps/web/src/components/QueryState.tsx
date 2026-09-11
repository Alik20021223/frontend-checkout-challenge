import type { ReactNode } from 'react';
import type { ApiError } from '@/api';
import { Loading } from './Loading';
import { Notice } from './Notice';

type Query<T> = { pending: boolean; error: ApiError | null; data: T | null; reload: () => void };

type Props<T> = { query: Query<T>; loading?: ReactNode; children: (data: T) => ReactNode };

export function QueryState<T>({ query, loading, children }: Props<T>) {
  if (query.data !== null) return <>{children(query.data)}</>;
  if (query.error)
    return (
      <Notice kind="error" action={{ label: 'Повторить', onClick: query.reload }}>
        {query.error.message}
      </Notice>
    );
  return <Loading>{loading}</Loading>;
}
