import { create } from 'zustand';

import type { BootResult } from '@/services/bootstrap';

interface AppState {
  boot: BootResult | null;
  bootError: string | null;
  setBoot: (b: BootResult) => void;
  setBootError: (e: string) => void;
  dismissRecovered: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  boot: null,
  bootError: null,
  setBoot: (boot) => set({ boot, bootError: null }),
  setBootError: (bootError) => set({ bootError }),
  dismissRecovered: () => set((s) => (s.boot ? { boot: { ...s.boot, recovered: [] } } : {})),
}));
