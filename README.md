# Web Gallery

A clean home for Samuel Hertzberg's interactive web projects.

Live on Cloud Run: <https://app-kavszpgcpq-ew.a.run.app>

## Architecture

The current application is intentionally static:

- React and TypeScript, built with Vite
- Nginx serving the compiled assets
- A single Cloud Run service that scales to zero
- Images stored in Artifact Registry
- Keyless deployment from GitHub Actions through Workload Identity Federation

There is no backend or database. If the gallery needs application data later,
add a separate Cloud Run API and grant only that service access to the chosen
database.

## Development

Requires Node.js 24 and pnpm 10.28.1.

```sh
pnpm install
pnpm dev
```

Run all local checks with:

```sh
pnpm check
```

## Deployment

Pushes to `master` deploy through `.github/workflows/deploy-gcp.yml`. The GCP
project, region, service accounts, and workload identity provider are explicit
non-secret workflow configuration, so the repository requires no deployment
secrets or Actions variables.

The runtime service account deliberately has no project roles today.

The container exposes `/health` for external checks and future Cloud Run probe
configuration.

The one-time GCP bootstrap is kept in `infra/setup-gcp.sh`. It creates only the
Artifact Registry, service accounts, IAM bindings, and GitHub workload identity
resources required by the deployment workflow. It does not enable or create a
database.

## Legacy application

The previous gallery is preserved under `legacy/`. It is excluded from the
root dependency graph, TypeScript configuration, Docker build context, and
deployment workflow.
