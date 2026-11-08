import { useQuery } from '@tanstack/react-query';
import type { ManagerOptionsDto } from '@online-school/api-contracts';
import type { ApiErrorView } from '../api/error-view.js';
import { getManagerOptions } from '@online-school/api-contracts';
import { read } from '../api/client.js';
export function useOptions(studentId?: string) {
  return useQuery<ManagerOptionsDto, ApiErrorView>({
    queryKey: ['manager', 'options', studentId],
    queryFn: ({ signal }) =>
      read((o) => getManagerOptions(studentId ? { studentId } : {}, o), signal),
  });
}
