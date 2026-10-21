# Upload and storage status

This repository's existing Create Deck importer supports CSV/TSV and Trivia Lobby JSON v1 backup preview/restore. It saves derived deck/cards in PostgreSQL; the browser importer does **not** archive originals.

**Phase 3 draft PR #15** introduces a separate authenticated Source Library for original-file retention, restricted access, search, organization and reviewed linked-deck creation. Its complete format support, migration requirements, security limitations and backup procedure are documented in [PHASE3_SECURITY_AND_OPERATIONS.md](PHASE3_SECURITY_AND_OPERATIONS.md).

On main until this PR is merged, no private document storage or account permissions should be presumed. On the Phase 3 branch, retention requires a persistent PostgreSQL database and a private persistent volume configured with PRIVATE_STORAGE_DIR; backups, real restore drills, antivirus and a complete portable library archive remain operator/unimplemented work. Neither branch should claim files are stored “forever.”
