#!/usr/bin/env bash
set -euo pipefail

GCP_PROJECT_ID="${GCP_PROJECT_ID:-web-gallery-505811}"
GCP_REGION_ID="${GCP_REGION_ID:-europe-west1}"
GITHUB_REPOSITORY_SLUG="${GITHUB_REPOSITORY_SLUG:-Samuelhertzberg/Playground}"
ARTIFACT_REPOSITORY="app"
RUNTIME_SERVICE_ACCOUNT_ID="app-runner"
DEPLOYER_SERVICE_ACCOUNT_ID="deployer"
WORKLOAD_POOL_ID="github-actions"
WORKLOAD_PROVIDER_ID="github-provider"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_SERVICE_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT_ID}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
DEPLOYER_SERVICE_ACCOUNT="${DEPLOYER_SERVICE_ACCOUNT_ID}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects describe "${GCP_PROJECT_ID}" --format='value(projectId)' >/dev/null

gcloud services enable \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  run.googleapis.com \
  sts.googleapis.com \
  --project "${GCP_PROJECT_ID}"

if ! gcloud artifacts repositories describe "${ARTIFACT_REPOSITORY}" \
  --project "${GCP_PROJECT_ID}" \
  --location "${GCP_REGION_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${ARTIFACT_REPOSITORY}" \
    --project "${GCP_PROJECT_ID}" \
    --location "${GCP_REGION_ID}" \
    --repository-format docker \
    --description "Web Gallery container images"
fi

gcloud artifacts repositories set-cleanup-policies "${ARTIFACT_REPOSITORY}" \
  --project "${GCP_PROJECT_ID}" \
  --location "${GCP_REGION_ID}" \
  --policy "${SCRIPT_DIR}/artifact-cleanup-policy.json"

if ! gcloud iam service-accounts describe "${RUNTIME_SERVICE_ACCOUNT}" \
  --project "${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_SERVICE_ACCOUNT_ID}" \
    --project "${GCP_PROJECT_ID}" \
    --display-name "Cloud Run runtime"
fi

if ! gcloud iam service-accounts describe "${DEPLOYER_SERVICE_ACCOUNT}" \
  --project "${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${DEPLOYER_SERVICE_ACCOUNT_ID}" \
    --project "${GCP_PROJECT_ID}" \
    --display-name "GitHub Actions deployer"
fi

gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SERVICE_ACCOUNT}" \
  --role roles/artifactregistry.writer \
  --condition None \
  --quiet

gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SERVICE_ACCOUNT}" \
  --role roles/run.admin \
  --condition None \
  --quiet

gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SERVICE_ACCOUNT}" \
  --project "${GCP_PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SERVICE_ACCOUNT}" \
  --role roles/iam.serviceAccountUser \
  --condition None \
  --quiet

if ! gcloud iam workload-identity-pools describe "${WORKLOAD_POOL_ID}" \
  --project "${GCP_PROJECT_ID}" \
  --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "${WORKLOAD_POOL_ID}" \
    --project "${GCP_PROJECT_ID}" \
    --location global \
    --display-name "GitHub Actions"
fi

if ! gcloud iam workload-identity-pools providers describe "${WORKLOAD_PROVIDER_ID}" \
  --project "${GCP_PROJECT_ID}" \
  --location global \
  --workload-identity-pool "${WORKLOAD_POOL_ID}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "${WORKLOAD_PROVIDER_ID}" \
    --project "${GCP_PROJECT_ID}" \
    --location global \
    --workload-identity-pool "${WORKLOAD_POOL_ID}" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '${GITHUB_REPOSITORY_SLUG}' && assertion.ref == 'refs/heads/master'"
fi

PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT_ID}" --format='value(projectNumber)')"
WORKLOAD_PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WORKLOAD_POOL_ID}/attribute.repository/${GITHUB_REPOSITORY_SLUG}"

gcloud iam service-accounts add-iam-policy-binding "${DEPLOYER_SERVICE_ACCOUNT}" \
  --project "${GCP_PROJECT_ID}" \
  --member "${WORKLOAD_PRINCIPAL}" \
  --role roles/iam.workloadIdentityUser \
  --condition None \
  --quiet

printf 'GCP_PROJECT=%s\n' "${GCP_PROJECT_ID}"
printf 'GCP_REGION=%s\n' "${GCP_REGION_ID}"
printf 'RUNTIME_SA=%s\n' "${RUNTIME_SERVICE_ACCOUNT}"
printf 'DEPLOYER_SA=%s\n' "${DEPLOYER_SERVICE_ACCOUNT}"
printf 'WIF_PROVIDER=projects/%s/locations/global/workloadIdentityPools/%s/providers/%s\n' \
  "${PROJECT_NUMBER}" "${WORKLOAD_POOL_ID}" "${WORKLOAD_PROVIDER_ID}"
