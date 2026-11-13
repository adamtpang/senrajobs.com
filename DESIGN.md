# DESIGN.md: senrajobs.com

The design contract for every agent and person editing this site. Read it before changing any
markup or CSS.

## What the site is

A directory: guest, then company, then roles. Portraits and role lists are the content. The
interface stays quiet so they carry the page. It is a fan project, so it borrows the look of
davidsenra.com without pretending to be the show.

## One look

Decided 2026-11-13 by Adam: the pre-theme look, with no theme switch. The David Senra / Founders
theme modes from PR #6 were removed (PR #7). Do not reintroduce a theme toggle, `assets/theme.css`
or a second font set without Adam asking for it.

| | Value |
| --- | --- |
| Feel | Black on white, one loud condensed headline, everything else plain |
| Display face | Schmalfette Grotesk (Adobe Fonts), fallback Impact. Headline only |
| Text face | TT Commons Pro (`tt-commons-pro`, Adobe Fonts), fallback Arial |
| Colors | `#000` text, `#fff` page, `--muted` `#666`, `--line` `#e3e3e3`, surfaces `#f3f3f3` and `#eee`, dark controls `#111` |
| Corners | Pills for inputs and the chat button, 4px for small tiles |

Rules:
- No accent color. Company logos are the only color on the page.
- Photos and role icons are grayscale.
- No navigation bar. The page starts at the site name; the footer carries About, Privacy,
  Episodes and feedback links.

## Type scale

Five text sizes plus the headline. They are tokens on `:root` in `template.html`. Do not add a
size; pick the nearest step.

| Token | Size | Use |
| --- | --- | --- |
| `--text-1` | 13px | Captions, counts, notes, footer, initials tiles |
| `--text-2` | 15px | Secondary lines: location, pay, back links, "last updated" |
| `--text-3` | 18px | Body |
| `--text-4` | 20px | Row titles: guest, company and role names |
| `--text-5` | 24px | Page titles on inner pages |
| headline | fluid `clamp()` on home, 36px on inner pages | The site name only |

Weights: 400 for text, 500 for titles and names, 600 for emphasis inside a line. Nothing below
13px.

## Layout

- One column with 16px gutters on phones.
- Home shows the full masthead: headline, one-line intro, "last updated" line, and the one-line
  independence notice.
- Inner pages (company list, role list) shrink the site name to 36px and hide the intro and
  "last updated" line, so content starts near the top. The independence notice stays on every page.
- Lists are single rows separated by a `--line` hairline, never cards with shadows.
- No horizontal scroll at 320px. Long names wrap (`overflow-wrap:anywhere`).

## Components

- **Guest tile:** square grayscale portrait, name at `--text-4`, arrow, then company marks at
  32px. Hover or focus tints the tile.
- **Company mark:** logo from `company-logos.json` (run `node scripts/fetch-logos.mjs` after adding
  companies, then `node build.mjs`). If there is none, an initials tile at `--text-1`, weight 600.
- **Company row:** 40px mark, name, role count, arrow. Rows with no indexed roles link straight to
  the employer's careers page.
- **Role row:** grayscale icon, title (links to the employer's posting, opens in a new tab),
  location and pay at `--text-2`. Show only what the posting states. If the pay period is not
  stated, show the amount alone and put the caveat in the `title` tooltip; never guess a period
  or a currency.
- **Find my role:** one floating pill, bottom right, opens a non-modal panel. The page keeps
  bottom padding so it never covers the last row.

## Interaction and accessibility

- Every link or button that stands alone is at least 44px tall. Links inside a sentence are exempt.
- Focus is always visible.
- Motion is limited to the portrait hover zoom and press feedback, and both respect
  `prefers-reduced-motion`.
- `--muted` text goes on the white page only, not on grey surfaces.

## Copy

- Plain and short. Say what the posting says; label unknowns as unknown.
- No em dashes anywhere.
- The site is independent of David Senra and Founders. The notice under the headline and the About
  section both say so; keep both.

## Before you ship a design change

1. `node build.mjs && node check.mjs`
2. `node scripts/stage-public.mjs`, serve `public/`, and look at home, a company list and a role
   list at 375px and desktop.
3. Land design work as one merge to `main`. Every merge is a paid production build.
