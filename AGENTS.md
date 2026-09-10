# Agent Instructions & Skills

## Agent skills

### Issue tracker

Local markdown files in `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repository. See `docs/agents/domain.md`.

---

## Design System & UI Color Palette (MANDATORY FOR ALL UI CREATION)

Always build UIs matching the Sacralink Theme & Design System:

### Color Palette Tokens (Defined in `web/src/index.css`)
- **Primary (Faith Blue):** `#2563EB` (`var(--color-primary)` / `text-primary`, `bg-primary`, `border-primary`)
- **Secondary (Stone Gray):** `#64748B` (`var(--color-secondary)` / `bg-secondary-50`, `bg-secondary-100`, `text-secondary-700`)
- **Accent (Sacred Gold):** `#F59E0B` (`var(--color-accent)` / `bg-amber-50`, `text-amber-600`, `border-amber-300`)
- **Success (Emerald):** `#10B981` (`var(--color-success)`)
- **Destructive (Red):** `#EF4444` (`var(--color-destructive)`)
- **Background:** `#F8FAFC` (`var(--color-background)` / `bg-background`)
- **Foreground Text:** `#0F172A` (`var(--color-foreground)` / `text-foreground`)
- **Muted Text:** `#64748B` / `#94A3B8` (`var(--color-muted)` / `text-muted`)
- **Border:** `#E2E8F0` (`var(--color-border)` / `border-border`)

### Rules:
1. **Default to Clean Light Mode**: The platform default is clean, warm, accessible light mode ("Apple meets The Vatican").
2. **Never hardcode dark-only slate/black classes**: Do NOT write `bg-slate-900`, `bg-slate-950`, `bg-black`, `text-slate-100`, `border-slate-800` as the default style. Use `.card`, `bg-card`, `bg-white`, `text-foreground`, `text-muted`, `border-border`, and `bg-secondary-50`.
3. **Cards & Containers**: Always use the `.card` class or `bg-white border border-border rounded-2xl shadow-sm`.
4. **Interactive Accents**: Use Sacred Gold (`#F59E0B` / `amber-500`) for spiritual/liturgical highlights (e.g. candles, gold badges) and Faith Blue (`#2563EB`) for action buttons.

