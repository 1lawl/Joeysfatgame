# Agent notes

## Reverse engineering (REA)

Cloud sessions register the REA MCP server and skill through
`.claude/hooks/session-start.sh`.

Authorization is required before any REA analysis. Only analyze targets the
user owns or has confirmed they are authorized to analyze: this repository
and its own build outputs are in scope. For anything else (third-party
binaries, apps, websites, APKs, firmware, devices or network captures), ask
the user to confirm authorization first, and decline if they can't.
