# Libraries and Templates gallery

The dashboard Libraries & Templates section recreates the supplied screenshot's hero, promotional card, search, category navigation, filter sidebar, template grid, and favorite controls. It follows the existing Billing/Integrations shell and font assets.

GET /api/v1/templates/catalog returns eight built-in editable starter layouts plus the signed-in user's saved templates. Counts reflect the available results. Category/style/feature/industry filtering and sorting run over this response. Feature tags describe starter-layout use cases; they do not provision stores, booking providers, or membership services.

PUT /api/v1/templates/catalog/:id/favorite persists the explicit boolean state. Built-in favorites are private CATALOG_FAVORITE records in the existing templates table. A transaction-scoped advisory lock prevents duplicate preference records under concurrent requests. These internal records are hidden from the existing editor's saved-template list. Saved-template favorites require ownership.

POST /api/v1/templates/catalog/:id/use accepts a bounded site name, resolves the template server-side, clones element identifiers, and creates a separate draft through createPersonalWebsite. Subscription limits, account status, workspace authorization, and creation audit remain enforced by that service. Existing sites are not overwritten. Private templates cannot be used by another account. Protection/error/loading states are surfaced in the UI.

No new database migration is required; the existing templates table is reused. Provider connections and feature-specific setup belong to the created site's normal editing/publishing flow.

Validation: focused gallery tests and previous billing/integration regressions; desktop/mobile browser checks with API test responses; real database favorite save/reload, concurrent preference creation, cross-user access denial, and editable draft creation using temporary fixtures.
