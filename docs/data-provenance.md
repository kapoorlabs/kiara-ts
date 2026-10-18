# Demo and fixture data provenance policy

This repository uses a **synthetic/hand-curated data policy** for committed demo
and test fixtures:

1. Committed fixture/demo rows in [src/testing/fixtures/](../src/testing/fixtures)
   and [examples/demo-repo/](../examples/demo-repo/) are handcrafted compatibility
   inputs and are not a redistributed dump of third-party proprietary datasets.
2. Public demo claims must remain scoped to these committed synthetic fixtures
   unless a separately approved dataset with explicit redistribution rights is added.
3. If externally sourced data is introduced, the PR must include:
   - source URL/repository,
   - license terms,
   - redistribution approval note,
   - and any attribution requirements.

This policy closes the provenance gate for the current repository state by
constraining published demos to approved synthetic fixtures.
