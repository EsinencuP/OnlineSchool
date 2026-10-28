import { create } from 'zustand';
export const useUI = create<{ sidebar: boolean; toggle(): void; close(): void }>((set) => ({
  sidebar: false,
  toggle: () => set((state) => ({ sidebar: !state.sidebar })),
  close: () => set({ sidebar: false }),
}));
