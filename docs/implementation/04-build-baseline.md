# Increment 4: restore production build baseline

The initial build-validation run 36403310387 failed on four missing controller
`next` arguments, missing optional layout fields used by existing inspectors,
and a duplicate published-site state declaration. These are corrected without
removing assertions or disabling TypeScript checks.

The exact source replacements were hash-bound to their reviewed originals and
validated by GitHub Actions run 36404021200 at base
`65da0e00a69e5f3574086f5123e7c6d24bdd6480`. Both production builds and all 46
hardening source-unit tests passed before the replacement blobs were exported.
The exported hashes were also compared with the locally reviewed replacements.
No CI job updated a branch; these blobs are applied in a normal main commit.

This establishes compilation and the scoped source-unit checks only. The legacy
Part B integration workflow still requires its own setup/failure diagnosis.
Dependency-install output reported security findings; those are not waived by a
successful build. No application deployment, payment-provider integration,
real-database isolation, load or restore qualification is implied.
