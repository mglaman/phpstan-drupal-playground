# PHPStan Drupal Extension Playground

Live at https://phpstan-drupal.mglaman.dev/. Modeled after the upstream
PHPStan playground (`playground-api` and `playground-runner` in
https://github.com/phpstan/phpstan) — check upstream first when porting to
new PHPStan majors.

## Architecture

* `playground-runner/` — Bref PHP Lambda (`analyze.php` returns a closure).
  Boots a PHPStan DI container per request and analyses submitted code with
  phpstan-drupal against a real drupal/core install in vendor.
* `playground-api/` — Node.js Lambda API behind API Gateway `gkyhj54sul`
  (REST, prod stage). `handler.ts` is a thin entry; logic lives in `src/`.
  `analyseResult` fans out one runner invocation per PHP version and saves
  shareable results to S3 bucket `phpstan-drupal-playground`.
* `website/` — Svelte 5 + Vite 8 SPA, deployed to S3 `phpstan-drupal-web`
  behind CloudFront `EJLWUQZMNXH6E`. The API URL and default sample live in
  `src/sample.js`; the build captures the preloaded result from the live API
  (`scripts/capture-sample.mjs`).

## Deploys

Push to `main` deploys. Each component has its own path-filtered workflow in
`.github/workflows/`, and each runs that component's tests before deploying.
There is no staging environment — a green push goes straight to production.
The serverless CLI is `osls` (OSS Serverless v3 fork), not `serverless`;
Serverless v3 is EOL and v4 requires a license.

## AWS

Production is account 994345088675 — use `--profile phpstan-drupal` with the
AWS CLI. The default local profile is a different account (933104089917)
containing stale duplicates of these functions; querying it makes deploys
look like they didn't happen.

## Tests

* Runner: `cd playground-runner && composer test` (PHPUnit, invokes the real
  analyze closure; needs `composer install` first).
* API: `cd playground-api && npm test` (Vitest, AWS mocked via
  aws-sdk-client-mock). `npm run check` = tsc + eslint, also enforced in CI.
* Website: `cd website && npm test` (Vitest).

Write a failing test before fixing a bug — the suites exist so behavior
changes are caught before an unreviewed production deploy.

## Gotchas

* PHPStan keys its compiled DI container class on the config file *path*.
  The runner embeds a content hash in the generated config filename so warm
  Lambdas rebuild the container when the config changes. Do not "simplify"
  it back to a constant filename — that silently breaks the strictRules,
  bleedingEdge, and phpVersion options on warm invocations.
* `playground-api/tests/` is excluded from `tsconfig.json` on purpose:
  aws-sdk-client-mock's types clash with current @smithy versions, and the
  exclusion also keeps tests out of the deploy artifact. Vitest compiles
  tests itself.
* `website/vitest.config.js` needs `resolve.conditions: ['browser']` —
  without it tests load Svelte's server build and `mount()` throws.
  Component tests run in jsdom via a per-file `@vitest-environment jsdom`
  comment and must `cleanup()` between tests.
* The website deploy sets `no-cache` on index.html and immutable caching on
  hashed assets. Keep that split when touching the deploy workflow, or
  browsers hold stale bundles until a hard refresh.
* The S3 results bucket has two generations of saved results: current
  `api/results/<uuid>.json` and the legacy sharded
  `data/results/<2-char-prefix>/<id>/input.json` + `output.json` pair served
  by `/legacyResult` for old shared links. Both must keep working.
