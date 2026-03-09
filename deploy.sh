#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VidToReels — Terraform deploy via Docker (works on Windows + Mac + Linux)
# Usage:
#   bash deploy.sh plan
#   bash deploy.sh apply
#   bash deploy.sh destroy
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CMD="${1:-plan}"
TF_IMAGE="hashicorp/terraform:1.7.5"

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
TF_DIR="$REPO_ROOT/terraform"
LAMBDA_DIR="$REPO_ROOT/lambdas"

# ── Path helper — Git Bash /d/foo → //d/foo for Docker Desktop on Windows ────
to_vol() {
  local p="$1"
  p="${p//\\//}"
  if [[ "$p" =~ ^/[a-zA-Z]/ ]]; then p="/$p"; fi
  echo "$p"
}

# ── Load tfvars into TF_VAR_* env vars ───────────────────────────────────────
TFVARS="$TF_DIR/terraform.tfvars"
if [ ! -f "$TFVARS" ]; then
  echo "❌  terraform/terraform.tfvars not found."
  echo "    Copy terraform/terraform.tfvars.example → terraform.tfvars and fill values."
  exit 1
fi

while IFS= read -r line; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  key="${line%%=*}"; key="${key// /}"
  val="${line#*=}"
  val="${val#"${val%%[![:space:]]*}"}"; val="${val%"${val##*[![:space:]]}"}"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  export "TF_VAR_${key}=${val}"
done < "$TFVARS"

# ── Build Lambda packages (Linux-compatible wheels via Docker) ────────────────
echo ""
echo "── Building Lambda packages ─────────────────────────────────────────"

build_lambda() {
  local name="$1"
  local src="$LAMBDA_DIR/$name"
  local build_dir="$src/build"
  local src_vol; src_vol="$(to_vol "$src")"

  echo "📦  Building: $name"
  rm -rf "$build_dir" && mkdir -p "$build_dir"

  docker run --rm \
    -v "${src_vol}://src" \
    python:3.11-slim \
    bash -c "
      pip install -r /src/requirements.txt \
        --platform manylinux2014_x86_64 \
        --python-version 3.11 \
        --only-binary=:all: \
        --target /src/build \
        --quiet 2>&1
      cp /src/handler.py /src/build/
      cd /src/build && zip -r /src/${name}.zip . -q
      echo '    ✅  ${name}.zip ready'
    "
}

build_lambda dispatcher
build_lambda recovery

# ── Terraform via Docker ──────────────────────────────────────────────────────
echo ""
echo "── Terraform ($CMD) ─────────────────────────────────────────────────"

TF_VOL="$(to_vol "$TF_DIR")"
LAMBDA_VOL="$(to_vol "$LAMBDA_DIR")"

TF_ENV_FLAGS=()
while IFS= read -r envline; do
  TF_ENV_FLAGS+=("-e" "$envline")
done < <(env | grep '^TF_VAR_' || true)

run_tf() {
  docker run --rm \
    -e "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-}" \
    -e "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-}" \
    -e "AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-ap-south-1}" \
    "${TF_ENV_FLAGS[@]}" \
    -v "${TF_VOL}://workspace" \
    -v "${LAMBDA_VOL}://lambdas" \
    "$TF_IMAGE" \
    -chdir=//workspace "$@"
}

echo "🔧  terraform init..."
run_tf init -reconfigure -input=false

case "$CMD" in
  plan)
    echo "🔍  terraform plan..."
    run_tf plan -input=false
    ;;
  apply)
    echo "🚀  terraform apply..."
    run_tf apply -auto-approve -input=false
    echo "✅  Apply complete. Outputs:"
    run_tf output
    ;;
  destroy)
    echo "⚠️   terraform destroy..."
    run_tf destroy -auto-approve -input=false
    ;;
  *)
    echo "Unknown command: $CMD  (use plan|apply|destroy)"
    exit 1
    ;;
esac
