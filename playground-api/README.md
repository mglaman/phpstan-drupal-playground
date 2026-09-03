# Notes

Base URL: https://gkyhj54sul.execute-api.us-east-1.amazonaws.com/prod

* `POST /analyse` — analyse code, optionally save it, and return the share
  `url` alongside the `id`.
* `GET /result?id=<uuid>` — a saved result plus a fresh re-analysis.
  Add `&format=markdown` for a text rendering meant for agents and issue
  comments.
* `GET /sample?id=<uuid>` — a saved result without re-analysis.
* `GET /legacyResult?id=<id>` — results from the pre-2023 playground.

Missing results answer 404 and malformed requests 400, both with a JSON
`{"error": "..."}` body. The public description of the API for agents lives
in `website/public/llms.txt`; keep it in sync when the request or response
shape changes.
