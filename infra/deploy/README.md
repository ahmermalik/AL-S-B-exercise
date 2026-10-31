# Production deployment

Production runs on the existing shared DigitalOcean droplet. GitHub Actions
builds the Linux image and pushes it to GHCR; the droplet only pulls and runs
the image. The app does not bind a host port. Shared Caddy reaches the web
container over the external `foresyte_default` Docker network.

## Runtime layout

- Public URL: `https://asset-living-close.167.172.151.243.sslip.io`
- Server directory: `/home/deploy/asset-living-close`
- Persistent state: `/home/deploy/asset-living-close/data`
- Web memory limit: 320 MiB
- Worker memory limit: 384 MiB

The whole data directory is shared by web and worker so SQLite WAL/SHM files,
source archives, and uploaded workbooks remain on one local filesystem. Never
copy only the live database file as a backup and never remove the data
directory during an update.

The first deployment creates the two configured accounts but has no workbook.
Sign in and upload the supplied workbook through **Prepare review**. AI drafting
stays unavailable while `OPENAI_API_KEY` is empty; deterministic findings and
manual review remain available.

## Server-only configuration

Create `/home/deploy/asset-living-close/.env.production` from the committed
`.env.example`. Keep it mode `600` and never commit it. Changing
`LOCAL_SEED_PASSWORD` does not reset already-created account passwords.

## Deployment

Pushes to `main` and manual workflow runs build and deploy the image. The
repository secret `DROPLET_SSH_KEY` contains the dedicated deploy key. The
droplet SSH host key is pinned in the workflow.

## Verification

```sh
curl -fsS https://asset-living-close.167.172.151.243.sslip.io/login
ssh foresyte-prod 'docker inspect asset-living-close-web --format "{{.State.Health.Status}}"'
ssh foresyte-prod 'docker inspect asset-living-close-worker --format "{{.State.Status}}"'
```

