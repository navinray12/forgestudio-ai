# Increment 11 — executable legacy probes and truthful evidence

The original Part B workflow failed before executing tests because it requested
an absent root lockfile. It now uses the existing backend lockfile and toolchain,
builds the server, explicitly prepares an ephemeral database, installs the actual
WordPress connector in a digest-pinned disposable container, and retains results.
It neither runs a development server nor modifies any external environment.

The legacy report previously inferred all 137 feature passes from suite-level
tags, hardcoded module percentages, and reported formula-based timings as measured
editor benchmarks. Those assertions are removed. Every unmapped feature is
NOT_VERIFIED. Only explicit commit-bound per-test evidence can mark it passed.
The performance check measures real bounded HTTP health probes, not UI or scale.
Authentication-rejected inputs are not proof of XSS or outage recovery.

These changes repair test execution, not replace product qualification. The
reference-load, browser, recovery and feature-level gates remain separate.
