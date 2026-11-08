import { useLocale, translateStudent } from '@online-school/ui';
import type { MessageCall } from '@online-school/ui';
export function useStudentLocale() {
  const state = useLocale();
  return { ...state, t: (...args: MessageCall) => translateStudent(state.locale, ...args) };
}
