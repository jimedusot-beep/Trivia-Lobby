# Initial guest entry recovery

A guest could lose its first create/join during a disconnect and reconnect to an
idle socket forever. Keeping only an unanswered message would also be unsafe: if
the server accepted it but its credential reply was lost, retrying could create
another room or another player. Issue #91 contains the original reproduction.

## Entry contract

The browser generates a new 256-bit `entryToken` for an explicit create or join.
The pending message stays in tab memory until a credential confirms its identity.
A replacement socket resends that same message; after receiving a credential it
uses the existing authenticated resume instead. A ten-second synchronization
deadline covers both an unanswered entry and a missing first state, even when
WebSocket heartbeats are healthy. Normal backoff applies until state is received.
Terminal errors clear entry intent and allow a corrected explicit attempt. Leave
clears it too. It is not persisted across a full page reload before credentials
arrive; established credentials retain the existing sessionStorage behavior.

The server treats the token as a private capability, not a player identifier:

- Create derives a stable six-character route from its SHA-256 digest. A retry
  reaches the same room, including after restart. A matching full host credential
  is required before an existing room can be reclaimed. A short-PIN collision
  fails rather than granting access.
- Join looks for a matching full credential inside the requested room's bounded
  session table. A match resumes the same player; a new token follows all normal
  nickname, capacity and lobby admission rules. A host token cannot join as a
  player. Knowing a nickname never grants its identity.
- Only SHA-256 credential hashes persist in the existing room checkpoint. Tokens
  never appear in public state, invitations or URLs. No new token index, unbounded
  replay cache, account, migration, dependency or hosting resource is added.
- Room transactions serialize concurrent retries and release credentials only
  after a durable commit. Old clients without entryToken continue to work.

## Verification

Transport tests exercise repeated and concurrent create/join, nickname isolation,
host/player separation, strict token validation and two synthetic secrets that
collide only in their short routing PIN. The root recovery test restarts a real
transport over the existing memory checkpoint store and verifies the same room,
player and credentials, with no plaintext token in persisted or public state.

Browser tests cut real proxied WebSockets before entry delivery, after server
acceptance and after credential delivery but before state. They check stable
identity, exactly one roster entry and subsequent reload. An unanswered-entry
case suppresses credential/state while forwarding heartbeats, then verifies the
synchronization deadline retries successfully. Invalid nickname and terminal
rejection tests ensure fresh explicit attempts use new secrets.

Record exact local, CI and deployed results in the PR. Cross-browser automation
is separate from testing physical phone connectivity and browser lifecycle.
