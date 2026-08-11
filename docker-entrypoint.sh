#!/bin/sh
set -eu

data_dir=${FOLIO_DATA_DIR:-/data}

case "$data_dir" in
  /data|/data/*) ;;
  *)
    echo "Refusing to change ownership outside /data: $data_dir" >&2
    exit 1
    ;;
esac

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$data_dir"
  chown -R node:node "$data_dir"
  exec su-exec node:node "$@"
fi

exec "$@"
