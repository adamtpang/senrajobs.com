# DESIGN.md: senrajobs.com

The design contract for every agent and person editing this site. Read it before changing any
markup or CSS. Token values and their sources (davidsenra.com and founderspodcast.com public CSS)
are recorded in `docs/design-tokens.md`; this file says how to use them.

## What the site is

A directory: guest, then company, then roles. Portraits and role lists are the content. The
interface stays quiet so they carry the page. It is a fan project, so it borrows each show's look
without pretending to be the show.

## Two themes, one structure

`html[data-theme]` switches the look. Markup, spacing and behavior are identical in both.

| | `senra` (default) | `founders` |
| --- | --- | --- |
| Feel | Black, white, loud condensed display type | White, serif display, blue accent |
| Display face | Anton | Libre Baskerville |
| Body face | Source Sans 3 | Inter |
| Accent | Black. Green `--mark` is decoration only (one rule under the nav) | Blue `--accent` for links and focus |
| Corners | `--radius` 24px pills, `--radius-sm` 12px | `--radius` 6px, `--radius-sm` 4px |

Rules:
- All color comes from tokens in `assets/theme.css` (`--bg`, `--fg`, `--muted`, `--line`,
  `--surface`, `--surface-2`, `--accent`, `--mark`, `--focus`). No hex values in page CSS.
- Photos and role icons are grayscale. Company logos keep their own color: they are the only
  color on a Senra page besides the green rule.
- Never use `--mark` green for text, buttons or state.

## Type scale

Five text sizes plus the display size. Do not add a size; pick the nearest step.

| Token | Size | Use |
| --- | --- | --- |
| `--text-1` | 13px | Captions, counts, nav, notes, footer |
| `--text-2` | 15px | Secondary lines: location, pay, back links |
| `--text-3` | 17px | Body, wordmark |
| `--text-4` | 20px | Row titles: guest, company and role names |
| `--text-5` | 24px | Page titles on inner pages |
| `--display-size` | fluid | The home page headline only |

Weights: 400 for text, 500 for titles and names, 600 for emphasis inside a line. Nothing below
13px, including initials tiles.

## Layout

- One column, `--site-width` max, `--page-pad-x` gutters (16px on phones).
- Home shows the full masthead. Inner pages (company list, role list) hide the headline and the
  "last updated" line so content starts near the top; the nav wordmark names the site. The
  one-line independence notice stays on every page.
- Guest grid uses `--grid-columns` and `--grid-gap`. Lists are single rows separated by a
  `--line` hairline, never cards with shadows.
- No horizontal scroll at 320px. Long names wrap (`overflow-wrap:anywhere`).

## Components

- **Guest tile:** square grayscale portrait, name at `--text-4`, arrow, then company marks at
  32px. Hover or focus tints the tile `--surface`.
- **Company mark:** logo from `company-logos.json` (run `node scripts/fetch-logos.mjs` after adding
  companies). If there is none, an initials tile on `--surface-2` at `--text-1`, weight 600.
- **Company row:** 40px mark, name, role count, arrow. Rows with no indexed roles link straight to
  the employer's careers page.
- **Role row:** grayscale icon, title (links to the employer's posting, opens in a new tab),
  location and pay at `--text-2`. Show only what the posting states. If the pay period is not
  stated, show the amount alone and put the caveat in the `title` tooltip; never guess a period
  or a currency.
- **Find my role:** one floating pill, bottom right, opens a non-modal panel. It must never cover
  the nav or sit over the last row (the page has bottom padding for it).

## Interaction and accessibility

- Every link or button that stands alone is at least 44px tall. Links inside a sentence are exempt.
- Focus is always visible: 2px `--focus` outline.
- Motion is limited to the portrait hover zoom and press feedback, and both respect
  `prefers-reduced-motion`.
- Text contrast: `--fg` and `--muted` on `--bg` only. Do not put `--muted` text on `--surface-2`.

## Copy

- Plain and short. Say what the posting says; label unknowns as unknown.
- No em dashes anywhere.
- The site is independent. Keep the "not affiliated" notice visible on every page.

## Before you ship a design change

1. `node build.mjs && node check.mjs`
2. `node scripts/stage-public.mjs`, serve `public/`, and look at home, a company list and a role
   list in both themes at 375px and desktop.
3. Run the Lightmark and Shapeable audits on the preview if the change touches layout.
4. Land design work as one merge to `main`. Every merge is a paid production build.
