#!/usr/bin/env sh
set -eu

compose_file="${COMPOSE_FILE:-docker-compose.yml}"

# podman-compose 1.6 cannot start dependents of successful one-shot containers
# in a single invocation. Establish the guarded infrastructure phase first.
podman-compose --in-pod false -f "$compose_file" up -d \
  postgres minio
podman wait --condition=healthy \
  amber-procurement_postgres_1 >/dev/null

# Replace only stateless application containers before one-shot jobs. This
# prevents podman-compose 1.6 from retaining stale native dependency IDs.
podman rm --force \
  amber-procurement_web_1 \
  amber-procurement_worker_1 \
  amber-procurement_api_1 2>/dev/null || true

# Always recreate one-shot jobs so migrations use the newly built workspace.
podman-compose --in-pod false -f "$compose_file" up -d --build \
  --force-recreate db-init minio-init
podman wait --condition=exited \
  amber-procurement_db-init_1 \
  amber-procurement_minio-init_1 >/dev/null

db_exit="$(podman inspect --format '{{.State.ExitCode}}' amber-procurement_db-init_1)"
minio_exit="$(podman inspect --format '{{.State.ExitCode}}' amber-procurement_minio-init_1)"
if [ "$db_exit" -ne 0 ] || [ "$minio_exit" -ne 0 ]; then
  echo "local initialization failed: db=$db_exit minio=$minio_exit" >&2
  exit 1
fi

# The first phase returns only after migrations and bucket initialization pass.
podman-compose --in-pod false -f "$compose_file" up -d --no-deps --force-recreate \
  api worker web
