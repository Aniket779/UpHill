# UpHill Design System

A visual-only redesign of the UpHill frontend: no routing, business logic, API calls, or backend behavior changed. Every page, component, and interaction was preserved exactly — only presentation changed.

## 1. Design Philosophy

**"An AI Operating System for ambitious people."**

The previous design was a dense, dark "glass" aesthetic — heavy gradients, glow shadows, backdrop blur on nearly every surface. It read as a hackathon dashboard, not a product someone would trust with their daily planning. The redesign is built around four commitments:

1. **Calm over loud.** Hierarchy comes from type weight, size, and spacing — not color intensity or motion. Nothing pulses, glows, or gradients unless it is genuinely load-bearing information (a live timer's progress ring, a risk indicator).
2. **One accent, spent deliberately.** Indigo (`accent`) is the only color used for primary actions and active states. It appears rarely enough that when it appears, it means something.
3. **AI is a place, not a color splash.** Every AI-generated surface (Coach, Chat, the Today page's Agentic Insight panel, Insights' Weekly Report) shares one unmistakable signature — a violet accent plus a thin gradient ring — so a user always knows when they're looking at something the model produced versus something they entered themselves.
4. **Real data only.** No new stat, feature, or number was invented. Where the Today page now shows a "Progress" percentage, it's `done / total` computed from data the page already loads — not a new endpoint, not a fake metric.

Inspiration was drawn from Linear's restraint (borders over shadows, one accent), Notion's typographic calm (generous whitespace, clear label hierarchy), Sunsama's softness (rounded but not bubbly, muted semantic color), and Motion's confidence in large, high-contrast headlines — without copying any of their specific visual signatures.

## 2. Color Palette

A single light theme (no dark mode toggle — this was a deliberate switch, not an addition, per the brief). All neutrals carry a very slight cool bias rather than pure gray, and every color is a named token in `tailwind.config.js`, never a raw hex value in a component.

| Token | Value | Use |
|---|---|---|
| `bg` | `#FAFAFA` | Page background |
| `surface` | `#FFFFFF` | Cards, sidebar, header, modals |
| `surface-secondary` | `#F4F4F5` | Recessed panels, hover states, input backgrounds |
| `surface-tertiary` | `#ECECEE` | Progress-bar tracks, disabled fills |
| `border` / `border-strong` | `#E4E4E7` / `#D4D4D8` | Hairline borders (the primary depth cue — see §5) |
| `ink` / `ink-secondary` / `ink-tertiary` | `#18181B` / `#52525B` / `#A1A1AA` | Primary / secondary / muted text |
| `accent` / `accent-hover` / `accent-soft` | `#4F46E5` / `#4338CA` / `#EEF2FF` | Primary actions, active nav, focus rings |
| `ai` / `ai-hover` / `ai-soft` | `#7C3AED` / `#6D28D9` / `#F5F3FF` | Exclusively AI-generated surfaces |
| `success` / `warning` / `danger` | `#16A34A` / `#D97706` / `#DC2626` | Semantic states — deliberately separate from `accent` so brand color and status color never compete |
| `priority-high` / `-medium` / `-low` | `#E11D48` / `#D97706` / `#71717A` | Task priority, independent of the semantic triad above |

**Why indigo, not violet, for the primary accent:** violet is reserved entirely for AI. If both the "Add task" button and the Coach panel were violet, the AI signal would be diluted the first time a user saw violet on an ordinary form. Two accent families, each meaning exactly one thing, is worth more than one "cohesive" accent used everywhere.

## 3. Typography

**Inter Variable** for all UI text, self-hosted via `@fontsource-variable/inter` (no external font CDN — reliable offline, no third-party request, no flash-of-invisible-text risk). This is the same face Linear ships in production; it was chosen because it's the correct professional-SaaS choice, not a default — at small sizes and tight tracking it holds up better than nearly any alternative, which matters on a data-dense page like Today.

**JetBrains Mono** for anything tabular or literal: XP counters, timestamps, the Pomodoro clock, the week-id in Weekly Goals. Numbers in a monospaced face align vertically when they change, which matters when XP or a timer is updating in place.

Scale (all defined once, reused everywhere — no ad hoc font sizes):

| Role | Size / weight | Where |
|---|---|---|
| Display (page H1) | 28px / 600, −0.02em tracking | One per page — "Today," "Habits," "Insights," etc. |
| Section heading | 14–15px / 600 | Card titles ("Add task," "Weekly report (AI)") |
| Body | 14px / 400, `ink-secondary` | Descriptions, paragraph copy |
| Label / eyebrow | 11–12px / 600, uppercase, tracked +0.14em, `ink-tertiary` | "TODAY PLANNER," section labels |
| Data | 12–14px, `font-mono`, tabular-nums | XP, timers, dates, IDs |

## 4. Spacing System

A single 4px base unit (Tailwind's default scale), applied consistently rather than ad hoc:

- **Page padding:** 32px desktop / 16px mobile (unchanged from the original — already correct)
- **Card padding:** 24px default (`p-6`), 16–20px for denser cards (list rows, Kanban cards)
- **Gap between list items:** 8–12px
- **Gap between sections:** 32–40px
- **Border radius:** 12px for cards (`rounded-card`), 8px for buttons/inputs (`rounded-control`), 6px for chips/badges (`rounded-chip`) — three values, used everywhere, never a one-off `rounded-3xl` or `rounded-full` unless the element is genuinely circular (avatars, icon buttons).

## 5. Component System

New shared primitives in `src/components/ui/`, used by every page instead of duplicated Tailwind class strings:

- **`Button`** — 5 variants (`primary`, `secondary`, `ghost`, `danger`, `ai`), 3 sizes. The `ai` variant is the only place violet appears as a fill.
- **`Card`** — the base surface: white, hairline border, 12px radius, a near-invisible `shadow-card` (`0 1px 2px rgba(0,0,0,0.04)`) for the faintest lift off the page background. No card anywhere uses a heavier shadow than a popover/modal.
- **`AISurface`** — `Card`'s sibling for AI content: a soft violet wash plus `.ai-ring`, a 1px gradient border built with a `mask-composite: exclude` technique (no extra DOM nodes, no glow, no animation — just a border that reads as "different" at a glance).
- **`Badge`** — priority and status pills, one shared component instead of six different inline pill implementations across pages.
- **`Input` / `Select`** — consistent border, focus ring, and disabled states everywhere a form field appears.
- **`IconButton`**, **`EmptyState`**, **`Spinner`** — the small, repeated patterns (icon-only buttons, "nothing here yet" states, loading spinners) that were previously copy-pasted with slightly different markup on every page now render identically everywhere.

**Depth comes from borders, not shadows.** The original design used `shadow-2xl`, `backdrop-blur-3xl`, and gradient overlays on nearly every panel. The redesign uses a hairline border (`#E4E4E7`) as the primary separator between a card and the page, reserving shadow for genuinely floating elements — dropdowns, the command palette, modals — where it does real work (indicating "this is above the page," not just "this is a box").

**Iconography.** Every emoji used as UI chrome (🔥 for streaks, 🎯/🔍/⚡/💡 for AI Coach sections, 🎉 for empty states) was replaced with a matching stroke icon from the existing icon set's visual language (2px stroke, round caps). Emoji remain fine as user-generated content; they don't belong in interface chrome for a product that wants to read as "professional enough to belong to a funded startup."

## 6. Key decisions and why

- **Today page as centerpiece:** the stat row gained a fourth tile ("Progress," a derived completion percentage) using data already on the page — real signal, zero new API surface. Task rows switched from full gradient-fill backgrounds to a white card with a 3px priority-colored left border, which scales better as a list gets long (the old treatment got visually loud with more than 3–4 high-priority tasks on screen at once).
- **AI surfaces get one shared, consistent signature** (violet + gradient ring) across the Today page's Agentic Insight, Coach, Chat, and the Insights Weekly Report — a user who's seen one recognizes all the others immediately.
- **Recharts re-themed, not replaced:** grid lines, axis text, and tooltip backgrounds now use the light-theme tokens; the two chart lines use `accent` and `warning` respectively so they stay distinguishable without adding a third arbitrary hue.
- **Kanban and Focus kept their exact drag/timer logic** — only the visual language of columns, cards, and the timer ring changed (solid `accent` ring instead of a fuchsia-to-violet gradient stroke, consistent with "avoid flashy gradients" applied literally, not just to buttons).
- **Nothing dark remains**, including Focus's fullscreen "Zen Mode," which previously hardcoded a dark background independent of theme. It now uses the same light `bg` token as the rest of the app — consistency was prioritized over a "focus mode should be dark" assumption that was never explicitly requested.

## What to verify yourself

Everything above was checked in a live browser against the real backend (not just read as code): registered a session, created/completed a task (confirmed XP awarded and reflected in the sidebar), logged a habit (streak incremented), adjusted a goal's progress, dragged a Kanban card via a direct status-change call (confirmed real-time socket sync moved it visually), ran the Focus timer, and made real Gemini API calls through the redesigned Coach, Chat, and Insights weekly-report — all returned real, data-grounded responses with zero console errors. All test data was deleted afterward; nothing was left in the database.
