# Architecture Specification: Dynamic Source Generation and Safe Cleanup (Point 37)

## 1. Overview & Principles

ForgeStudio Blueprint Point 37 governs dynamic source generation, deterministic symbol planning, ownership-aware regeneration, and safe stale file cleanup. It guarantees:
- Symbols and file names are planned deterministically without breaking on duplicate titles, Unicode characters, leading digits, reserved keywords, or Windows filesystem limitations.
- Files are assigned explicit, persisted ownership classes (`GENERATED`, `USER_OWNED`, `MIXED/PATCHED`, `DERIVED_BUILD`, `PROTECTED_SOURCE`) based on cryptographic byte hashes, never heuristic filename matching.
- Stale file retirement is calculated strictly by manifest subtraction (previous manifest minus planned manifest), never broad directory globbing.
- Cleanup operations create recoverable checkpoints, revalidate hashes at apply time, and strictly bar deletion of user-owned files, migrations, database tables, CMS sources, or binary originals.

## 2. Deterministic Symbol and File Planning

### 2.1 Symbol Sanitization Rules
- **Reserved Keywords:** JS/TS keywords (`default`, `class`, `import`, `export`, etc.) are transformed by prepending safe prefixes (e.g. `CompDefault`, `CompClass`).
- **Leading Digits:** Identifiers starting with a number (e.g. `123Product`) are prefixed with `_` (e.g. `_123Product`).
- **Unicode & Diacritics:** Transliterated via `NFKD` decomposition, diacritics stripped, and non-alphanumeric characters converted into PascalCase word boundaries.
- **Duplicate Display Titles:** Disambiguated deterministically using sequential numeric suffixes (`Title`, `Title_2`, `Title_3`).

### 2.2 Path and Toolchain Validation
- **Path Traversal Protection:** Relative POSIX path normalization rejecting `..` or absolute paths.
- **Windows MAX_PATH Guard:** Checks path lengths against the 260-character limit.
- **Case Collision Defense:** Prevents Windows case-insensitive filesystem collisions where `About.tsx` and `about.tsx` would collide.

### 2.3 Module and Import Resolution
- Imports are resolved by grouping symbols by module path.
- Emits proper default vs named `{ Foo }` syntax and qualified aliases (`{ Button as PrimaryBtn }`).

## 3. Ownership-Aware Regeneration Matrix

| Ownership Class | Description | Regeneration Policy |
| :--- | :--- | :--- |
| **GENERATED** | Managed entirely by ForgeStudio generator. | Regenerated **only** when current file hash matches recorded baseline hash. If user edited the file, overwrite is rejected and conflict is raised. |
| **USER_OWNED** | Hand-crafted by developer or user. | **Never** overwritten automatically. Always preserved. |
| **MIXED/PATCHED** | Shared files with protected regions or custom hooks. | Reconciled using region markers (`[forge-protect-start]`) or three-way AST merge. |
| **DERIVED_BUILD** | Rebuildable artifacts (e.g. `dist/`, `.next/`). | Safe to regenerate or clean up under build lifecycle. |
| **PROTECTED_SOURCE** | Critical entries, retained revisions, or legacy imports. | Protected from automated deletion or destructive updates. |

## 4. Safe Cleanup Decision Contract

### 4.1 Stale Candidate Calculation
- Stale files are computed as: `Previous Manifest Files - Newly Planned Manifest Paths`.
- Broad directory globs (e.g. `rmdir src/pages`) are strictly prohibited.

### 4.2 Pre-Retirement Invariants
Before a file is marked for retirement:
1. **Ownership Check:** Must be `GENERATED` or `DERIVED_BUILD`. `USER_OWNED` and `PROTECTED_SOURCE` files are immediately blocked.
2. **Special Category Protection:** Migrations (`migrations/*.sql`), Prisma schemas, and CMS uploads (`public/uploads/`) are permanently immune from automated garbage collection.
3. **Hash Freshness:** Current content hash must match recorded baseline. If diverged, cleanup is aborted to prevent user data loss.
4. **Dependency Reachability:** If any active planned file still imports the candidate, deletion is blocked.

### 4.3 Removal Manifest & Atomic Apply
- A `RemovalManifest` is issued containing candidate IDs, reasons, affected routes, and a 1-hour expiration.
- At apply time, hashes are re-verified. Any file modified concurrently is skipped from deletion.
- Atomic mirror projections retain the previous valid checkpoint if generation encounters mid-flight failure, and preserve historical release assets within a 7-day compatibility window.
