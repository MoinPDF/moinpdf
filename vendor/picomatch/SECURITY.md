# Locally maintained Picomatch security fix

This private package vendors the MIT-licensed runtime from `picomatch@4.0.7`.
Its original author, repository and license are retained. It is not an upstream
release and must not be published to npm. `moinpdfPatchLevel: 1` identifies it.

Upstream advisory: https://github.com/advisories/GHSA-fc5q-39xc-vjpf

No fixed upstream release was available on 2026-11-18. `lib/parse.js` now treats
an unbounded wildcard inside a repeated extglob as risky even for a single
branch. Such patterns use the parser's existing literal fallback. Escaped and
quoted stars and character classes remain literals; existing safe reductions
of nested single-character repetitions are preserved. The documented trusted
caller option `maxExtglobRecursion: false` still disables the parser's safeguards.

This deliberately changes the matching semantics of risky repeated patterns
such as `+(*a)`. Ordinary path globs, braces and literal extglobs are unchanged.
MoinPDF does not accept user-supplied patterns for this build dependency.

`tests/picomatch-security-smoke.mjs` executes the public matcher in isolated
processes with a hard deadline, checks the advisory cases plus nested/alternate
variants, and covers ordinary build patterns and escaped literals. CI runs this
check alongside the unchanged registry audit. There are no ignored advisories.
The override covers all transitive copies. Replace it with a tested upstream
release when one fixes this advisory; keep the regression tests.
