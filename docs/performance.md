# Font delivery and API timing

## UI font

The UI uses self-hosted subsets of the original `public/fonts/PretendardVariable.woff2`.
The derivative's internal and CSS family is `SceneLog Sans` to respect the OFL
Reserved Font Name; character outlines, advance widths, line metrics and the
variable weight axis are preserved. The original OFL is in `public/fonts/OFL.txt`.

`src/app/ui-font.css` maps disjoint Unicode ranges to content-hashed files in
`public/fonts/ui/`. The core subset is 223,104 bytes rather than the original
2,057,688-byte file. Remaining ranges load only when required by displayed text.
All 14,336 original Unicode characters remain available. Actual transfer depends
on the text displayed, so 223KB is not a guarantee for every account or page.

Regenerate from the repository root or any directory:

```sh
python3 -m pip install 'fonttools[woff]==4.25.0'
python3 scripts/subset-ui-font.py
```

Commit the generated stylesheet, font files and manifest together. Python is not
required for application builds. Newly added UI characters still work through
the remaining subsets; regeneration moves them into the core file.

Canvas exports must call `loadUiFont(actualText)` or `loadJournalFonts(items)`
before drawing. `document.fonts.ready` alone cannot load ranges used only by
off-screen canvas text. Journal, print and video paths now supply actual titles
and text rather than only a fixed sample sentence.

## API timing

Archive GET and profile GET expose request-local durations in `Server-Timing`:

| Stage | Includes |
| --- | --- |
| `auth` | Supabase user verification |
| `db_connect` | Pool acquisition and connection establishment |
| `db_query` | SQL round trip, result transfer and driver decoding |
| `db_prepare` | Existing profile initialization query, when applicable |
| `validate` | Archive schema validation |
| `serialize` | JSON response construction |
| `archive` / `profile` | Entire repository operation, including nested DB stages |
| `total` | Handler duration |

Inspect these headers on authenticated requests after deployment. No identifiers,
tokens, SQL or record content are included. Authentication, response schemas and
private/no-store caching remain unchanged. Failed stages are measured too.

Do not add nested durations together. `db_query` includes transport overhead;
an `EXPLAIN ANALYZE` execution time measures the database's own SQL execution.
`total` excludes platform work before handler entry, network transfer to the
browser and client parsing. Compare cold/new connections with reused connections.
