#!/bin/sh
set -eu
if [ "${1:-web}" = "worker" ]; then
  exec node dist/worker.mjs
fi
node dist/setup.mjs
exec node server.js
