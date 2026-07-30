# PHPStan Drupal Extension Playground

https://phpstan-drupal.mglaman.dev/

Three components, each deployed by its own GitHub Actions workflow on push
to `main`:

* `playground-runner` — Bref PHP Lambda that runs PHPStan with
  [phpstan-drupal](https://github.com/mglaman/phpstan-drupal) against
  submitted code.
* `playground-api` — Node.js Lambda API that fans out analysis to the runner
  per PHP version and stores shareable results in S3.
* `website` — Svelte frontend served from S3 behind CloudFront.

## Running tests

Tests run in CI on every pull request, and each deploy workflow runs its
component's tests before deploying.

### Runner (PHP 8.4, PHPUnit)

```sh
cd playground-runner
composer install
composer test
```

The suite invokes the real analyze closure, so it needs the full vendor
directory and takes a few seconds per test.

### API (Node.js 22, Vitest)

```sh
cd playground-api
npm ci
npm test
```

AWS clients are mocked; no credentials needed. `npm run check` runs the
type check and lint that CI also enforces.

### Website (Node.js 22, Vitest)

```sh
cd website
npm ci
npm test
```
