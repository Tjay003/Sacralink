# Moving Kalapati into SacraLink (keeping your own chat UI)

`kalapati-mascot.js` is the mascot only: the dove, drag and flight, feathers, shadow, "Need a hand?" bubble, minimize to the edge, and the perch on top of your chat panel. It has no chat UI, no dependencies, and no framework code. It works with your React 19 + Vite app as is.

## 1. Copy the file
Put it in the web app, for example `web/src/components/kalapati/kalapati-mascot.js`. If you use strict TypeScript, add a one-line `kalapati-mascot.d.ts` (below) or rename it to `.ts` and add `// @ts-nocheck` at the top.

```ts
// kalapati-mascot.d.ts
export interface KalapatiOptions {
  getPanelRect?: () => DOMRect | { left: number; top: number; width: number; height: number } | null;
  onStateChange?: (state: 'docked' | 'min' | 'chat', fromUser: boolean) => void;
  bottomInset?: number;       // px kept free at the bottom, for example a mobile bottom nav
  mobileBreakpoint?: number;  // default 700
  dockSize?: { desktop: number; mobile: number };   // default 150 / 116
  perchSize?: { desktop: number; mobile: number };  // size while on your chat, default 120 / 92
  tipEveryMs?: number;        // speech bubble interval, 0 turns it off, default 15000
  tipTitle?: string; tipText?: string; label?: string;
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
```

## 2. Connect it to your chat (React)
Replace your current floating chat button with this. `ParishChat` is your existing chat component.

```tsx
import { useEffect, useRef, useState } from 'react';
import { createKalapati, type KalapatiHandle } from './kalapati-mascot';

export function KalapatiLauncher() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const kal = useRef<KalapatiHandle | null>(null);

  useEffect(() => {
    kal.current = createKalapati({
      getPanelRect: () => panelRef.current?.getBoundingClientRect() ?? null,
      onStateChange: (s) => setOpen(s === 'chat'),
    });
    return () => kal.current?.destroy();
  }, []);

  // closing your chat (X button, Escape) must tell him to come back down
  const close = () => { setOpen(false); kal.current?.setState('docked'); };

  return open ? <div ref={panelRef} className="fixed bottom-5 right-5 ..."><ParishChat onClose={close} /></div> : null;
}
```

Mount `<KalapatiLauncher />` once, inside the parishioner layout only (not for Priest, Volunteer or admin roles), so he only shows for parishioners.

## 3. Drive his mood from your chat state
```ts
kal.current?.setPose('thinking'); // while waiting for the AI reply
kal.current?.setPose('talking');  // while the reply streams in
kal.current?.setPose('idle');     // when the reply finishes
kal.current?.setPose('happy');    // optional, for thanks or a confirmed booking
```

## 4. Things to check in your app
- **Mobile bottom nav:** pass `bottomInset: <nav height>` so he does not sit behind it.
- **Your chat panel moving or resizing** (keyboard, window resize): call `kal.current?.relayout()`.
- **Z-index:** he sits at `z-index: 2147483000` by default. Override with `--kal-z` on `:root` if you have a higher modal.
- **Dark mode:** the bubble and minimize button read `--kal-surface`, `--kal-ink`, `--kal-line` and `--kal-muted` CSS variables, with light fallbacks. Set them to your theme tokens.
- **Reduced motion:** flight and feathers switch off automatically.
- **Next.js or SSR:** only call `createKalapati` inside `useEffect` (as above).

## Assets
The mascot art is drawn inside `kalapati-mascot.js`, so the floating mascot needs no image files. `assets/` has standalone copies of the same art for other places, such as a chat header avatar, an empty state, a favicon or a social image. Each pose comes as an SVG and a 1024px transparent PNG: idle, waving, thinking, happy and talking. Put them in `web/public/kalapati/` and use them as normal images.
