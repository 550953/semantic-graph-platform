#!/usr/bin/env bash
# Restore SSH config for deploy key on each session restart.
# Run: bash scripts/setup-ssh.sh
set -e

KEY_SRC="$(cd "$(dirname "$0")/.." && pwd)/.local/ssh/deploy_semantic-graph-platform"

if [ ! -f "$KEY_SRC" ]; then
  echo "ERROR: deploy key not found at $KEY_SRC" >&2
  exit 1
fi

mkdir -p ~/.ssh
chmod 700 ~/.ssh

cat > ~/.ssh/config << EOF
Host github-semantic
  HostName github.com
  User git
  IdentityFile $KEY_SRC
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config "$KEY_SRC"

echo "SSH config restored. Testing connection..."
ssh -T git@github-semantic -o StrictHostKeyChecking=no 2>&1 || true
