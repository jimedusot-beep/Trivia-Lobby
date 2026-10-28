# Phone race screen

One focused improvement: Grand Prix players should drive without scrolling a web
page or hunting through party panels. The TV, other games and server rules retain
their current behavior. This is the first phone-playability pass, not a claim that
all thirty game interfaces have been redesigned.

During a heat, fit the visible viewport (including changing mobile browser bars
and safe-area insets). Keep identity, position/lap/time, item/boost feedback and
four large independent touch controls visible. Move assistance and leaving the
party into an accessible Options menu. Keep connection/reconnect feedback visible.
Opening Options releases held controls. No mandatory fullscreen, rotation or login.

On phone results show the player's own result and a wait-for-host message; the TV
keeps all standings. Restore the ordinary party layout on returning to the lobby
or another game. Support portrait/landscape and 320px-wide screens, long names,
reload/reconnect, keyboard and simultaneous touch, without disabling zoom.

Acceptance: assert no horizontal or vertical document scrolling during play and
results; all buttons and opened options fit, have at least 44px targets and remain
operable. Test short/tall phones, rotation, reconnect and return-to-lobby cleanup.
Inspect portrait/landscape screenshots; run root checks/build, guest tests and
racer browser flows. Physical iPhone/Android testing remains separate.
