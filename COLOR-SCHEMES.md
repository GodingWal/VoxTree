# VoxTree Color Schemes

This document describes all color definitions used across VoxTree, from the core brand palette through semantic design tokens and component-level usage.

**Sources of truth:**
- `client/src/index.css` — CSS custom properties (design tokens)
- `tailwind.config.ts` — Tailwind color mappings

---

## 1. Brand Palette

Six fixed hex values that anchor the entire visual identity. These are referenced directly in `tailwind.config.ts` under the `brand` key and used in components via `brand-*` Tailwind utilities.

| Token | Hex | Description |
|---|---|---|
| `brand-green` | `#2D8B70` | Primary brand color. Teal-green used for buttons, links, focus rings, and the waveform gradient start. |
| `brand-gold` | `#F5A623` | Warm accent. Used for highlights, secondary CTAs, and the waveform gradient end. |
| `brand-cream` | `#FFF8F0` | Off-white. Background tint that gives the light theme its warm feel. |
| `brand-charcoal` | `#2A2A2A` | Near-black. Primary text color in the light theme. |
| `brand-coral` | `#E8735A` | Warm orange-red. Used for accent touches and status indicators. |
| `brand-sage` | `#A8D5BA` | Soft green. Used as the midpoint stop in the audio waveform gradient. |

---

## 2. Semantic Design Tokens (CSS Custom Properties)

All semantic colors live in `client/src/index.css` as CSS custom properties. Tailwind maps each property to a utility class of the same name (e.g. `bg-primary`, `text-muted-foreground`).

Dark mode is activated by adding the `.dark` class to the root element (`tailwind.config.ts`: `darkMode: ["class"]`).

### Core Surface & Text

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--background` | `hsl(32, 100%, 97.1%)` | `hsl(160, 15%, 6%)` | Page background |
| `--foreground` | `hsl(0, 0%, 16.5%)` | `hsl(32, 30%, 92%)` | Default text |
| `--card` | `hsl(0, 0%, 100%)` | `hsl(160, 10%, 10%)` | Card/panel backgrounds |
| `--card-foreground` | `hsl(0, 0%, 16.5%)` | `hsl(32, 20%, 88%)` | Text inside cards |
| `--popover` | `hsl(0, 0%, 100%)` | `hsl(160, 12%, 8%)` | Dropdown/popover backgrounds |
| `--popover-foreground` | `hsl(0, 0%, 16.5%)` | `hsl(32, 30%, 92%)` | Text inside popovers |

### Interactive Colors

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--primary` | `hsl(162.8, 51.1%, 36.1%)` | `hsl(162.8, 51.1%, 42%)` | Primary actions, links, focus rings |
| `--primary-foreground` | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` | Text on primary backgrounds |
| `--secondary` | `hsl(144, 30%, 92%)` | `hsl(160, 15%, 15%)` | Secondary buttons, tags |
| `--secondary-foreground` | `hsl(0, 0%, 16.5%)` | `hsl(32, 30%, 92%)` | Text on secondary backgrounds |
| `--accent` | `hsl(37.4, 91.3%, 54.9%)` | `hsl(37.4, 91.3%, 54.9%)` | Accent highlights (gold — same in both themes) |
| `--accent-foreground` | `hsl(0, 0%, 16.5%)` | `hsl(0, 0%, 8%)` | Text on accent backgrounds |
| `--destructive` | `hsl(10.6, 75.5%, 63.1%)` | `hsl(10.6, 75.5%, 55%)` | Danger/delete actions |
| `--destructive-foreground` | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` | Text on destructive backgrounds |

### Subdued & Structural

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--muted` | `hsl(144, 20%, 95%)` | `hsl(160, 10%, 12%)` | Subdued backgrounds (e.g. empty states) |
| `--muted-foreground` | `hsl(0, 0%, 45%)` | `hsl(0, 0%, 55%)` | Placeholder and helper text |
| `--border` | `hsl(32, 30%, 90%)` | `hsl(160, 10%, 18%)` | Dividers and borders |
| `--input` | `hsl(32, 30%, 90%)` | `hsl(160, 10%, 18%)` | Input field borders |
| `--ring` | `hsl(162.8, 51.1%, 36.1%)` | `hsl(162.8, 51.1%, 42%)` | Focus rings (keyboard navigation) |

### Chart / Data-Vis Colors

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--chart-1` | `hsl(162.8, 51.1%, 36.1%)` | `hsl(162.8, 51.1%, 42%)` | Primary series (brand green) |
| `--chart-2` | `hsl(37.4, 91.3%, 54.9%)` | `hsl(37.4, 91.3%, 54.9%)` | Secondary series (brand gold) |
| `--chart-3` | `hsl(10.6, 75.5%, 63.1%)` | `hsl(10.6, 75.5%, 63.1%)` | Tertiary series (coral-red) |
| `--chart-4` | `hsl(144, 34.9%, 74.7%)` | `hsl(144, 34.9%, 74.7%)` | Quaternary series (sage) |
| `--chart-5` | `hsl(0, 0%, 16.5%)` | `hsl(32, 30%, 80%)` | Quinary series (text-toned) |

### Sidebar Colors

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--sidebar` | `hsl(162, 30%, 97%)` | `hsl(160, 10%, 10%)` | Sidebar background |
| `--sidebar-foreground` | `hsl(0, 0%, 16.5%)` | `hsl(32, 20%, 88%)` | Sidebar text |
| `--sidebar-primary` | `hsl(162.8, 51.1%, 36.1%)` | `hsl(162.8, 51.1%, 42%)` | Active/selected sidebar items |
| `--sidebar-primary-foreground` | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` | Text on active sidebar items |
| `--sidebar-accent` | `hsl(144, 30%, 92%)` | `hsl(160, 15%, 15%)` | Sidebar hover state |
| `--sidebar-accent-foreground` | `hsl(162.8, 51.1%, 36.1%)` | `hsl(162.8, 51.1%, 42%)` | Text on sidebar hover state |
| `--sidebar-border` | `hsl(144, 20%, 88%)` | `hsl(160, 10%, 22%)` | Sidebar dividers |
| `--sidebar-ring` | `hsl(162.8, 51.1%, 36.1%)` | `hsl(162.8, 51.1%, 42%)` | Sidebar focus rings |

---

## 3. Component-Level Color Usage

### Audio Waveform (`AudioWaveform.tsx`)

Rendered on a canvas element as a three-stop gradient:

```
#2D8B70  →  #A8D5BA  →  #F5A623
brand-green   brand-sage   brand-gold
```

### Status / State Colors

Used throughout voice cloning components (`JobStatusMonitor`, `AudioQualityMeter`, `MicTroubleshooter`, `VoiceLibrary`, `VoiceRecordingWizard`) with Tailwind utility classes from the default palette:

| State | Background | Text/Icon | Usage |
|---|---|---|---|
| Success / Completed | `bg-green-50` / `bg-green-500` | `text-green-600` | Job done, quality score ≥ 80, completed wizard step |
| Error / Failed | `bg-red-50` / `bg-red-500` | `text-red-600` | Job failed, quality score < 80, clipping detected |
| In-Progress / Loading | — | `text-blue-500` (spinner) | Active job monitoring, mic troubleshooter running |
| Warning | `bg-amber-50` | `text-amber-*` | Threshold warnings |

### Admin Dashboard (`AdminDashboard.tsx`)

Metric cards use Tailwind gradient utilities for visual differentiation:

| Card | Gradient |
|---|---|
| Primary metric | `from-emerald-500 via-emerald-300/60` |
| Secondary metric | `from-sky-500 via-sky-400/60` |
| Tertiary metric | `from-amber-500 via-amber-300/60` |

Status badges in data tables:

| Status | Classes |
|---|---|
| `completed` | `bg-green-100 text-green-800` |
| `failed` | `bg-red-100 text-red-800` |
| `processing` | `bg-yellow-100 text-yellow-800` |
| generic/unknown | `bg-gray-100 text-gray-800` |

### Ad Banner (`AdBanner.tsx`)

Uses brand colors with transparency via Tailwind opacity modifiers:

```
bg-gradient-to-br from-brand-green/10 to-brand-gold/10
border border-brand-green/20
```

---

## 4. Special CSS Effects

Defined in `client/src/index.css`:

**`.glass-effect`** — frosted-glass overlay using brand green at low opacity:
```css
background: rgba(45, 139, 112, 0.1);   /* brand-green */
border: 1px solid rgba(45, 139, 112, 0.2);
backdrop-filter: blur(10px);
```

**`.gradient-text`** — primary-to-accent text gradient (green → gold):
```css
background: linear-gradient(135deg, var(--primary), var(--accent));
```

**Scrollbar thumb** — uses `--border` at rest, `--primary` (green) on hover.

---

## 5. Theme Architecture Summary

```
brand.*  (6 fixed hex values in tailwind.config.ts)
    ↓
--custom-properties  (semantic tokens in index.css, two sets: :root / .dark)
    ↓
Tailwind utilities  (bg-primary, text-muted-foreground, border-border, …)
    ↓
Component classes  (JSX className strings referencing the utilities above)
```

Dark mode is toggled by adding the `.dark` class to the `<html>` element. Every semantic token automatically resolves to its dark-mode value — no component-level dark-mode overrides are needed for colors defined in the token layer.
