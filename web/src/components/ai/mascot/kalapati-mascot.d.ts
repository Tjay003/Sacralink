export interface KalapatiOptions {
  getPanelRect?: () => DOMRect | { left: number; top: number; width: number; height: number } | null;
  onStateChange?: (state: 'docked' | 'min' | 'chat', fromUser: boolean) => void;
  bottomInset?: number; // px kept free at the bottom, for example a mobile bottom nav
  mobileBreakpoint?: number; // default 700
  dockSize?: { desktop: number; mobile: number }; // default 150 / 116
  perchSize?: { desktop: number; mobile: number }; // size while on your chat, default 120 / 92
  tipEveryMs?: number; // speech bubble interval, 0 turns it off, default 15000
  tipTitle?: string;
  tipText?: string;
  label?: string;
  container?: HTMLElement;
}

export interface KalapatiHandle {
  setState(s: 'docked' | 'min' | 'chat'): void;
  getState(): 'docked' | 'min' | 'chat';
  setPose(p: 'idle' | 'thinking' | 'talking' | 'happy' | 'waving'): void;
  relayout(): void;
  setVisible(v: boolean): void;
  destroy(): void;
}

export function createKalapati(opts?: KalapatiOptions): KalapatiHandle;
