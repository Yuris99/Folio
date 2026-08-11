import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { emptyWorkspace, normalizeWorkspace } from '../defaults';
import type { User, Workspace } from '../types';

export type Mutation = <T>(label: string, action: () => Promise<T>, refresh?: boolean) => Promise<T>;

export function useFolio() {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState('연결 중');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const data = await api.bootstrap();
    setWorkspace(normalizeWorkspace(data));
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api.session(), api.bootstrap()])
      .then(([session, data]) => {
        if (!active) return;
        setUser(session);
        setWorkspace(normalizeWorkspace(data));
        setSyncState('서버 연결됨');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (!(cause instanceof ApiError && cause.status === 401)) setError(cause instanceof Error ? cause.message : '서버에 연결하지 못했습니다.');
        setSyncState('로그인 필요');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const mutate: Mutation = useCallback(async <T,>(label: string, action: () => Promise<T>, shouldRefresh = true) => {
    setError('');
    setSyncState(`${label} 중...`);
    try {
      const result = await action();
      if (shouldRefresh) await refresh();
      setSyncState(`${label} 완료`);
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : `${label}에 실패했습니다.`;
      setError(message);
      setSyncState(`${label} 실패`);
      throw cause;
    }
  }, [refresh]);

  async function logout() {
    await api.logout();
    setUser(null);
    setWorkspace(emptyWorkspace);
  }

  async function deleteAccount() {
    await api.deleteAccount();
    setUser(null);
    setWorkspace(emptyWorkspace);
  }

  return { user, workspace, setWorkspace, loading, syncState, error, setError, refresh, mutate, logout, deleteAccount };
}
