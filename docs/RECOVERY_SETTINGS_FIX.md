# Preserve chosen rules across countdown recovery

A restart during countdown must preserve validated Color Clash bot/stacking/timer
settings and the Card & Dice Table preset. The checkpoint allowlist currently
omits packSettings; restore therefore opens the default rules. Add this explicit
field, retaining compatibility with older checkpoints that lack it. Verify JSON
round-trip during countdown and the resulting opened game configuration. No schema,
new dependency, credential or deployment change.
