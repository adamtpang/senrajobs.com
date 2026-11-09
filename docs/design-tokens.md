# Design tokens

Fetched 2026-11-09. Colors, type, and spacing below are copied from the public CSS of each site. Licensed fonts are not loaded. Each mode uses a free substitute, named in the font row.

## David Senra mode

Sources:

- https://www.davidsenra.com/ HTML, fetched 2026-11-09. Body class `u-bg-white`. Display title class `display-1`.
- https://www.davidsenra.com/podcast same stylesheet, fetched 2026-11-09.
- https://cdn.prod.website-files.com/68a3314e7e1c857e33d93b10/css/david-senra-dev.webflow.shared.c4c25af02.min.css
- https://cdn.prod.website-files.com/68a3314e7e1c857e33d93b10/css/david-senra-dev.webflow.68d2d87e6e62d9b73909e181.d9813669f.opt.min.css

The stylesheet’s `:root` block is the source of the custom properties. Breakpoints in that file are 1920, 1440, 1280, 991, 767 and 479.

| Token | Source | Value |
| --- | --- | --- |
| Page background | `--_color---neutral--white`, `.u-bg-white` | `#ffffff` |
| Text | `--_color---primary--black` | `#000000` |
| Muted text | black at about 60%, `--_color---neutral--black-60` (`#0009`) on white | `#666666` |
| Hairline | existing senrajobs rule, close to `--_color---neutral--black-10` (`#0000001a`) | `#e3e3e3` |
| Surface | hover and empty photo wells on the Senra pages | `#f3f3f3` |
| Accent, decorative only | `--_color---primary--accent` | `#4cbb17` |
| Accent, darker source value | `--_color---primary--accent-dark` | `#118c4f` |
| Secondary, marked deleted in the file | `--_color---secondary--yellow`, `--_color---secondary--blue` | `#f8d47a`, `#0073e6` |
| Display face | `--_typography---fonts--primary-font` | `"Schmalfette Grotesk", Arial, sans-serif` |
| Body face | `--_typography---fonts--secondary-font` | `tt-commons-pro, sans-serif` |
| Also loaded, not the primary stack | `@font-face` | BDO Grotesk |
| Display scale, desktop | `--_responsive---font-size--d1/d2/d3` | `17.5rem` / `12.5rem` / `7.5rem` |
| Display leading and case | `--_typography---d1--line-height`, `.display-1` | `0.75`, uppercase, weight 400, tracking 0 |
| Display scale, ≤991 / ≤767 / ≤479 | body overrides of `--_responsive---font-size--d1` | `12rem` / `8rem` / `6rem` |
| Heading 1 | `--_responsive---font-size--h1`, line-height, weight, tracking | `3.5rem`, `1.1`, `500`, `-0.02em` |
| Body | `--_responsive---font-size--paragraph-body` | `1.063rem` / `1.5` / weight 400 / tracking `-0.01em` |
| Small text | `--_responsive---font-size--paragraph-sm` | `0.875rem` |
| Large text | `--_responsive---font-size--paragraph-xl` | `1.5rem` / `1.3` |
| Eyebrow | `--_typography---eyebrow--letter-spacing`, all-caps small | `0.16em`, `0.875rem` |
| Section padding | `--_responsive---padding--section` | `7.5rem`, then `5rem`, `4rem`, `3rem` |
| Card padding | `--_responsive---padding--card` | `1.5rem`, then `1rem` |
| Space steps | `--_size---*` | `0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`, `3rem` |
| Button type | `--_components---button--font-size/weight` | `1rem` / `400` |
| Nav | `.nav` | white bar, `1rem` vertical padding |

`#4cbb17` on white is 2.49:1. `#118c4f` on white is 4.30:1. Neither is used for text or for the focus ring. Senra mode uses `#4cbb17` only as a 4px decorative rule on the masthead. Text, the selected toggle, and focus use black on white (21:1). Focus is a 2px solid ring with a 3px offset.

The site name is longer than the two-word title those display sizes were set for, so the page title uses `clamp(3.25rem, 12vw, 8.5rem)` with line-height `0.8` instead of `17.5rem` / `0.75`. The uppercase grotesque, the tight leading, and the black-on-white page are the parts that carry the look.

Free faces, loaded from Google Fonts: **Anton** for Schmalfette Grotesk, **Source Sans 3** for TT Commons Pro. BDO Grotesk, TT Commons Pro, and Schmalfette Grotesk are not requested.

## Founders mode

Sources:

- https://www.founderspodcast.com/ HTML, fetched 2026-11-09. Stylesheet `/_next/static/immutable/chunks/26ws_m7sek-oj.css` (full URL `https://www.founderspodcast.com/_next/static/immutable/chunks/26ws_m7sek-oj.css`).
- https://www.founderspodcast.com/robots.txt allows access and sets `Content-Signal: ai-train=yes, search=yes, ai-input=yes`.

`:root` is the light scheme. A `prefers-color-scheme: dark` block swaps the same variables. This mode implements the light scheme, which is what `:root` sets before that query.

| Token | Source | Value |
| --- | --- | --- |
| Background | `--background` | `#ffffff` |
| Text | `--foreground` | `#171717` |
| Muted | `--muted` | `#595959` (7.0:1 on white) |
| Accent and focus | `--accent`, `--ring`, `.focus-ring:focus-visible` | `#006bff` (4.62:1 on white) |
| Surfaces | `--surface-1`, `--surface-2`, `--surface-3` | `#fafafa`, `#f2f2f2`, `#ebebeb` |
| Edge | `--edge` | `#0000001f` |
| Subtle | `--subtle` | `#00000015` |
| Dark scheme, not used for this mode | same names inside `prefers-color-scheme: dark` | background `#000`, foreground `#ededed`, muted `#a0a0a0`, accent `#47a8ff`, surfaces `#111` `#1a1a1a` `#292929` |
| Body face | `--font-sans`, `--font-inter` | Inter, system-ui |
| Wordmark face | `--font-display` on the nav wordmark, `--font-libre-baskerville` | Libre Baskerville italic, 28px, tracking `-0.04em` |
| Hero and episode titles | `.text-hero` inherits `--font-sans` | Inter, not the serif |
| Body size | `body`, `.text-body` | `17px` / `1.8` |
| Hero | `.text-hero` | `34px` / `1.15`, from `640px`: `48px` / `1.1`, weight 400, tracking `-0.015em` |
| Title | `.text-title` | `30px` / `1.2`, from `768px`: `38px`, weight 500, tracking `-0.015em` |
| Wordmark | nav anchor classes | italic, `28px`, leading 1, tracking `-0.04em` |
| Eyebrow | banner classes | uppercase, `11px`, tracking `0.14em`, weight 500 |
| Site width | `--site-width` | `1020px` |
| Reading width | `--content-width`, hero `max-w-[46rem]` | `760px`, hero `46rem` |
| Page inset | `px-5 sm:px-6` | `20px`, then `24px` |
| Radius | `--radius-sm/md/lg/xl` | `0.25rem`, `0.375rem`, `0.5rem`, `0.75rem` |
| Space unit | `--spacing` | `0.25rem` |
| Small sizes | `--text-xs`, `--text-sm`, `--text-base` | `0.75rem`, `0.875rem`, `1rem` |
| Shadow | `.shadow-player` | `0 0 0 1px var(--edge), 0 1px 1px #00000005, 0 4px 8px -4px #0000000a, 0 16px 24px -8px #0000000f` |
| Focus | `.focus-ring:focus-visible` | `2px solid var(--accent)`, offset `2px` |

Inter and Libre Baskerville are the faces the Founders stylesheet names, and both are free (SIL Open Font License). They load from Google Fonts. Libre Baskerville is only the wordmark. The hero and the episode titles stay in Inter, which is what `.text-hero` inherits. No Founders wordmark image, cover art, or photograph is copied.

`#47a8ff` on white is 2.53:1, so the dark-scheme accent is not used for text.

## What the switch changes

`html[data-theme="senra"]` and `html[data-theme="founders"]` in `assets/theme.css` hold the two sets. The default attribute is `senra`, because the site is senrajobs.com and that is the look it already had. A script in the document head reads `localStorage` key `senrajobs-theme` and sets the attribute before the body paints. The toggle is a button group labeled “Look and feel”. `assets/theme.js` writes the choice and updates `aria-pressed`.

Without JavaScript the page stays in Senra mode. With JavaScript, a saved Founders choice is applied on the next visit.

## Episode catalog

- Feed: https://feeds.megaphone.fm/DSLLC6297708582
- Sitemap: https://www.founderspodcast.com/sitemap.xml
- Show: https://www.founderspodcast.com/
- Snapshot: `data/founders-episodes.json`, with `fetchedOn`

An episode link is used only when its slug is already a `/episodes/` URL in that sitemap. Titles that do not match a sitemap URL link to the show, and the row says the sitemap has no episode page. Company and guest links are added only when the episode title names a person or company already on the jobs board. Matching uses the person’s full name, so a shared surname does not attach a different person. The phrase “Nikola Tesla” is not treated as the car company. Sponsor text under “Made possible by” is not matched.
