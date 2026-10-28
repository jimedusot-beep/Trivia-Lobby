// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Family Showdown presentation. Only the host view contains answer keys.
export function renderFeud(state, { root, e, b, play, input, canAct }) {
  const s = state.pack,
    host = state.role === "host",
    playing = state.phase === "playing";
  const final = s.stage.startsWith("final"),
    teamName = (index) => s.teams[index]?.name ?? "No team";
  root.classList.add("feud-game", host ? "feud-host" : "feud-phone");
  e("h2", s.title);
  if (!s.guided)
    e(
      "p",
      "This restored match uses spoken answers and host judging. Start a new match to use phone answers and lightning review.",
    );
  const question = e("h3", s.question);
  question.className = "feud-question";
  if (!final)
    e(
      "p",
      `Board ${s.round} of ${s.total} · ×${s.multiplier} · Pot: ${s.pot}`,
      root,
    ).className = "feud-round-meta";

  function answerForm(label, action, parent) {
    const form = e("form", undefined, parent);
    form.className = "pack-entry feud-entry";
    const id = action === "answer" ? "feud-answer" : "feud-final-answer";
    const key = `feud-draft:${state.matchId}:${s.round}:${s.stage}:${s.strikes}:${s.board?.filter((a) => !a.hidden).length}:${s.finalPlayer}:${s.finalCursor}`;
    const caption = e("label", label, form),
      field = e("input", undefined, form);
    caption.htmlFor = id;
    field.id = id;
    field.maxLength = 60;
    field.required = true;
    field.autocomplete = "off";
    try {
      field.value = sessionStorage.getItem(key) ?? "";
    } catch {}
    field.oninput = () => {
      try {
        sessionStorage.setItem(key, field.value);
      } catch {}
    };
    const submit = b(
      action === "answer" ? "Send answer" : "Lock answer",
      () => {},
      form,
      !canAct(),
    );
    submit.type = "submit";
    form.onsubmit = (event) => {
      event.preventDefault();
      if (canAct() && field.value.trim())
        play({ action, text: field.value.trim() });
    };
    return field;
  }
  function privatePanel(parent) {
    const controls = e("details", undefined, parent);
    controls.className = "feud-private";
    e("summary", "Private host controls", controls);
    e(
      "p",
      "Answer key: open only on a private host screen. Anyone watching or casting this screen can see these controls.",
      controls,
    );
    try {
      controls.open = sessionStorage.getItem("feud-controls-open") === "yes";
    } catch {}
    controls.ontoggle = () => {
      try {
        sessionStorage.setItem(
          "feud-controls-open",
          controls.open ? "yes" : "no",
        );
      } catch {}
    };
    return controls;
  }

  const controller = e("section");
  controller.className = "feud-controller";
  controller.setAttribute(
    "aria-label",
    host ? "Host round guidance" : "Your game controls",
  );
  if (!host)
    e("p", `Your team: ${teamName(s.myTeam)}`, controller).className =
      "feud-identity";
  if (!final) {
    if (s.canBuzz && playing) {
      b("BUZZ!", () => play({ action: "buzz" }), controller).className =
        "buzz-button";
      e(
        "p",
        "Buzz first to answer. Say your answer aloud or send it from your phone.",
        controller,
      );
    } else if (s.stage === "buzz" && host) {
      e(
        "p",
        "Players: buzz on your phones. The first buzzer gets one answer.",
        controller,
      );
    } else if (s.stage === "faceoff") {
      e("p", `${s.buzzer} buzzed first!`, controller).className = "feud-turn";
      if (host)
        e(
          "p",
          "Judge a spoken answer, or review a typed response in the private controls.",
          controller,
        );
      else if (!s.canSubmit && !s.waitingForHost)
        e("p", "Wait for the buzzer player's answer.", controller);
    } else if (s.stage === "play") {
      e("p", `${teamName(s.team)} controls the board.`, controller).className =
        "feud-turn";
      e(
        "p",
        host
          ? "Judge spoken answers in the private controls. Phone answers that match the board reveal automatically."
          : s.myTeam === s.team
            ? "Agree on one answer with your team. Type it below or tell the host."
            : "Watch the board. After three strikes your team gets one chance to steal.",
        controller,
      );
    } else if (s.stage === "steal") {
      e(
        "p",
        `${teamName(1 - s.team)}: one answer to steal the pot!`,
        controller,
      ).className = "feud-turn";
      if (!host)
        e(
          "p",
          s.myTeam === 1 - s.team
            ? "Agree on one answer. Send it below or tell the host before time runs out."
            : "Wait for the other team's one steal attempt.",
          controller,
        );
    } else if (s.stage === "board-reveal") {
      e(
        "h3",
        s.paidTo === null
          ? "Board closed · no pot awarded"
          : `${teamName(s.paidTo)} wins the ${s.pot}-point pot!`,
        controller,
      );
      e(
        "p",
        host
          ? "Review the full board, then choose Next."
          : "The host will open the next round.",
        controller,
      );
    }
    if (s.canSubmit) answerForm("Your team's answer", "answer", controller);
    if (s.waitingForHost) {
      e(
        "p",
        !host && s.submittedAnswer
          ? `${s.submittedAnswer.name} sent “${s.submittedAnswer.text}”.`
          : "An answer was sent to the host.",
        controller,
      );
      e(
        "p",
        host
          ? "Open the private controls to match the wording or mark a miss."
          : "Waiting for the host to match the wording or mark a miss. Do not send another answer.",
        controller,
      );
    }
    if (s.lastDecision) {
      const decision = e("p", s.lastDecision, controller);
      decision.className = "feud-decision";
      decision.setAttribute("role", "status");
    }
    const strikes = e("p", `Strikes: ${s.strikes} / 3 `, controller);
    strikes.className = "feud-strikes";
    for (let i = 0; i < 3; i++) {
      const mark = e("span", "✕", strikes);
      mark.dataset.used = String(i < s.strikes);
      mark.setAttribute("aria-hidden", "true");
    }
  } else {
    e(
      "p",
      `Lightning final · ${teamName(s.finalTeam)} · Run ${s.finalPlayer} of 2 · ${s.finalist}`,
      controller,
    ).className = "feud-turn";
    if (s.soloFinalist)
      e(
        "p",
        "Your team has one player, so the same finalist takes both runs. Use different answers on the second run.",
        controller,
      );
    if (s.stage === "final-ready") {
      e(
        "p",
        `The host starts a ${s.finalPlayer === 1 ? 20 : 25}-second timer for all five questions. The next finalist must look away until their run.`,
        controller,
      );
      if (host)
        b(
          "Start lightning timer",
          () => play({ action: "final-start" }),
          controller,
        );
    } else if (s.stage === "final-answer") {
      e(
        "p",
        `Question ${Math.min(s.finalCursor, 5)} of 5 · One timer covers the whole run.`,
        controller,
      );
      if (s.canAnswer) {
        answerForm("Your quick answer", "final-answer", controller);
        b(
          "Pass this question",
          () => play({ action: "final-pass" }),
          controller,
        );
      } else
        e(
          "p",
          "Only the current finalist can answer. Answers stay private until the host publishes the results.",
          controller,
        );
    } else if (s.stage === "final-review")
      e(
        "p",
        host
          ? "Both runs are locked. Review different wording in the private answer key, then publish the results. Unmatched answers stay at zero."
          : "Both runs are locked. The host is reviewing the wording before showing the results.",
        controller,
      );
  }

  const teams = e("div");
  teams.className = "feud-teams";
  s.teams.forEach((team, index) => {
    const card = e("article", undefined, teams);
    card.dataset.mine = String(!host && s.myTeam === index);
    e("h3", team.name, card);
    e("strong", `${team.score} points`, card);
  });
  const layout = e("div");
  layout.className = "feud-layout";
  if (!final) {
    const boardPanel = e(host ? "section" : "details", undefined, layout);
    boardPanel.className = "feud-board-panel";
    if (host) e("h3", "Answer board", boardPanel);
    else {
      e("summary", "View the answer board", boardPanel);
      boardPanel.open = state.phase === "reveal";
    }
    const board = e("ol", undefined, boardPanel);
    board.className = "feud-board";
    for (const answer of s.board) {
      const row = e("li", undefined, board),
        label = e(
          "span",
          answer.hidden ? `${answer.index + 1}. Hidden answer` : answer.text,
          row,
        );
      label.className = "feud-answer-label";
      if (!answer.hidden) e("strong", String(answer.points), row);
      row.dataset.revealed = String(!answer.hidden);
    }
    if (host && playing) {
      const controls = privatePanel(layout);
      if (s.submittedAnswer) {
        e("h3", `${s.submittedAnswer.name}'s answer`, controls);
        e("p", s.submittedAnswer.text, controls).className =
          "feud-submitted-answer";
      }
      if (["faceoff", "play", "steal"].includes(s.stage)) {
        const judge = e("div", undefined, controls);
        judge.className = "feud-judge-actions";
        for (const a of s.judge)
          b(
            `Reveal ${a.text} (+${a.points * s.multiplier})`,
            () => play({ action: "judge", index: a.index }),
            judge,
            !s.board[a.index].hidden,
          );
        b(
          s.stage === "faceoff"
            ? "Miss — other team takes control"
            : s.stage === "steal"
              ? "Missed steal — controlling team keeps pot"
              : "Strike — answer not on board",
          () => play({ action: "judge", index: -1 }),
          judge,
        );
        if (
          s.stage === "play" &&
          !s.strikes &&
          !s.passed &&
          !s.waitingForHost &&
          s.board.filter((a) => !a.hidden).length === 1
        ) {
          e(
            "p",
            "The winning team keeps control. If they prefer, pass now before their next answer.",
            controls,
          );
          b(
            "Pass control to the other team",
            () => play({ action: "pass" }),
            controls,
          );
        }
      } else
        e(
          "p",
          "Wait for a player to buzz. The hidden answer key is not needed yet.",
          controls,
        );
      const names = e("details", undefined, controls);
      e("summary", "Edit team names", names);
      for (let index = 0; index < 2; index++) {
        const field = input(
          `Team ${index + 1} name`,
          `feud-team-${index}`,
          24,
          names,
        );
        if (!field.value) field.value = s.teams[index].name;
        b(
          `Save team ${index + 1} name`,
          () => play({ action: "team-name", index, name: field.value }),
          names,
        );
      }
    }
  } else if (s.finalReview && host) {
    const controls = privatePanel(layout);
    for (const [qIndex, q] of s.finalReview.entries()) {
      const row = e("section", undefined, controls);
      row.className = "feud-review-question";
      e("h3", `${qIndex + 1}. ${q.question}`, row);
      q.responses.forEach((response, player) => {
        e(
          "p",
          `Run ${player + 1}: ${response.text} · ${response.points} points`,
          row,
        );
        const label = e(
            "label",
            `Match run ${player + 1}, question ${qIndex + 1}`,
            row,
          ),
          select = e("select", undefined, row);
        select.id = `feud-review-${qIndex}-${player}`;
        label.htmlFor = select.id;
        const miss = e("option", "No match / zero points", select);
        miss.value = "-1";
        q.choices.forEach((answer, index) => {
          const option = e(
            "option",
            `${answer.text} · ${answer.points} points`,
            select,
          );
          option.value = String(index);
          option.disabled = q.responses[1 - player].index === index;
        });
        select.value = String(response.index ?? -1);
        select.disabled = !!response.skipped || !canAct();
        select.onchange = () => {
          if (canAct())
            play({
              action: "final-judge",
              player,
              question: qIndex,
              index: Number(select.value),
            });
        };
      });
    }
    b(
      "Publish lightning results",
      () => play({ action: "final-publish" }),
      controls,
    );
  } else if (s.finalAnswers) {
    const results = e("section", undefined, layout);
    results.className = "feud-final-results";
    e(
      "h3",
      `${s.finalTotal} / ${s.goal} points${s.finalTotal >= s.goal ? " · Goal reached!" : ""}`,
      results,
    );
    s.questions.forEach((q, index) => {
      e("h4", q, results);
      for (let run = 0; run < 2; run++) {
        const a = s.finalAnswers[run][index];
        e(
          "p",
          `Run ${run + 1}: ${a?.text ?? "Pass"} — ${a?.points ?? 0}`,
          results,
        );
      }
    });
  }
  const roster = e("details");
  e("summary", "Teams & players", roster);
  for (const team of s.teams)
    e("p", `${team.name}: ${team.players.join(", ")}`, roster);
  const rules = e("details");
  rules.className = "feud-rules";
  e("summary", "How Family Showdown works", rules);
  e(
    "p",
    "This is a casual team showdown with original sample questions and curated points. These are house rules, not an exact television-show simulation.",
    rules,
  );
  e(
    "p",
    "The first buzzer gets one answer. A correct answer wins control; a miss gives the other team control. The host can pass control immediately after the first reveal. Team members collaborate instead of taking fixed individual turns.",
    rules,
  );
  e(
    "p",
    "Phone answers matching the board reveal automatically. The host matches other wording or judges spoken answers. Three strikes give the other team one steal attempt. The steal answer also adds its points to the pot. Round multipliers apply to all pot additions.",
    rules,
  );
  e(
    "p",
    "The leading team takes two lightning runs: 20 seconds, then 25 seconds for all five questions. Different wording can be reviewed privately by the host. An answer can score once per question across both runs. In a team-score tie, the first team takes the final. The host publishes the results and chooses Next to bank the final points.",
    rules,
  );
}
