'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useUsers(): string[] {
  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ email: string }[]>('/auth/users').then((r) => r.data.map((u) => u.email)),
    staleTime: 60_000,
  });
  return data ?? [];
}
