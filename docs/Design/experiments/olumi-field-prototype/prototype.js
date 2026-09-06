(() => {
  "use strict";

  const body = document.body;
  const steps = ["initial", "resolve", "analyse", "intervention", "edit", "changes", "collaborate"];
  const stepMeta = {
    initial: ["1 of 7", "Initial model"],
    resolve: ["2 of 7", "Resolve uncertainty"],
    analyse: ["3 of 7", "Analyse"],
    intervention: ["4 of 7", "Science intervention"],
    edit: ["5 of 7", "Workspace action"],
    changes: ["6 of 7", "What changed"],
    collaborate: ["7 of 7", "Collaboration"],
  };
  const stepStage = {
    initial: "frame",
    resolve: "frame",
    analyse: "evaluate",
    intervention: "evaluate",
    edit: "evaluate",
    changes: "improve",
    collaborate: "strategise",
  };
  const stageCopy = {
    strategise: {
      eyebrow: "Strategic direction",
      subtitle: "Strategise context · Direction, stakes and tensions are emphasised",
      label: "Clarify next",
      title: "Which route depends most on a belief the team has not aligned on?",
      detail: "Resolve one strategic tension before the team commits to a direction.",
      button: "Clarify the tension",
      action: "go-resolve",
    },
    frame: {
      eyebrow: "Shared understanding",
      subtitle: "Frame context · Brief, workshop notes and team contributions are in view",
      label: "Resolve next",
      title: "Does sponsor engagement cause renewal, or signal an already healthy account?",
      detail: "This is the smallest unknown that could change the strongest route.",
      button: "Resolve this",
      action: "go-resolve",
    },
    ideate: {
      eyebrow: "Possibility space",
      subtitle: "Ideate context · Current routes are emphasised so missing alternatives stand out",
      label: "Expand next",
      title: "What route becomes plausible if sponsor engagement is only a proxy?",
      detail: "Challenge the shared mechanism before converging on the three routes already visible.",
      button: "Explore the gap",
      action: "go-intervention",
    },
    evaluate: {
      eyebrow: "Reasoned comparison",
      subtitle: "Evaluate context · Causal paths, outcomes and uncertainty are emphasised",
      label: "Challenge next",
      title: "Which fragile relationship could overturn the current route ranking?",
      detail: "Test the highest-value uncertainty before relying on the analysis.",
      button: "Inspect uncertainty",
      action: "go-intervention",
    },
    act: {
      eyebrow: "Commitment path",
      subtitle: "Act context · Routes, consequences and the goal are emphasised",
      label: "Commit next",
      title: "What pilot would distinguish executive reviews from adoption support?",
      detail: "Make the first move small enough to learn from, not just deliver.",
      button: "Resolve the key belief",
      action: "go-resolve",
    },
    improve: {
      eyebrow: "Learning loop",
      subtitle: "Improve context · Outcomes and changes are emphasised",
      label: "Learn next",
      title: "Which changed belief should shape the next cycle?",
      detail: "Review model evolution before carrying the result into new work.",
      button: "Review changes",
      action: "go-changes",
    },
  };
  const transientClasses = [
    "tour-open",
    "composer-open",
    "log-open",
    "key-open",
    "reason-open",
    "method-open",
    "change-detail-open",
    "analysis-stale",
    "highlight-executive",
    "highlight-adoption",
    "highlight-shared",
    "node-selected",
    "change-highlight-1",
    "change-highlight-2",
    "change-highlight-3",
  ];
  const historyClasses = [
    "patch-preview",
    "patch-accepted",
    "relationship-edited",
    "analysis-updated",
    "edge-direction-negative",
    "edge-confidence-high",
    "edge-confidence-medium",
    "edge-confidence-low",
    "collaboration-model-applied",
    "collaboration-model-disagreement",
    "log-has-question",
  ];
  const modelState = {
    judgement: "Modest",
    judgementReason: "Executive sponsors unblock renewal, but healthy accounts are also more likely to engage them.",
    judgementRecorded: false,
    direction: "Positive",
    strength: "Weak",
    confidence: "Low",
    edgeReason: "Likely confounded by existing account health.",
    currentAnalysis: { executive: 64, adoption: 31, winner: "executive" },
    revisedAnalysis: null,
  };

  let zoom = 1;
  let toastTimer = 0;
  let reasonMode = null;
  let returnFocus = null;

  const query = (selector) => document.querySelector(selector);
  const queryAll = (selector) => document.querySelectorAll(selector);
  const setText = (selector, value) => {
    const element = query(selector);
    if (element) element.textContent = value;
  };

  function setExclusive(prefix, value, values) {
    values.forEach((item) => body.classList.remove(`${prefix}-${item}`));
    body.classList.add(`${prefix}-${value}`);
  }

  function setElementActive(element, active) {
    if (!element) return;
    element.inert = !active;
    element.setAttribute("aria-hidden", String(!active));
  }

  function syncUiState() {
    const fieldActive = body.dataset.view === "field";
    const boardActive = body.dataset.view === "board";
    setElementActive(query("#field-view"), fieldActive);
    setElementActive(query("#board-view"), boardActive);

    queryAll("[data-state-panel]").forEach((panel) => {
      const state = panel.dataset.statePanel;
      let active = fieldActive && state === body.dataset.step;
      if (state === "edit") active = active && !body.classList.contains("analysis-stale");
      if (state === "stale") active = fieldActive && body.dataset.step === "edit" && body.classList.contains("analysis-stale");
      setElementActive(panel, active);
    });

    queryAll("[data-resolve-view]").forEach((panel) => {
      const active = fieldActive && body.dataset.step === "resolve" && body.classList.contains(`resolve-view-${panel.dataset.resolveView}`);
      setElementActive(panel, active);
    });
    queryAll("[data-patch-view]").forEach((panel) => {
      const active = fieldActive && body.dataset.step === "intervention" && body.classList.contains(`patch-view-${panel.dataset.patchView}`);
      setElementActive(panel, active);
    });
    queryAll("[data-collaboration-view]").forEach((panel) => {
      const active = fieldActive && body.dataset.step === "collaborate" && body.classList.contains(`collaboration-view-${panel.dataset.collaborationView}`);
      setElementActive(panel, active);
    });

    setElementActive(query(".model-key-popover"), fieldActive && body.classList.contains("key-open"));
    setElementActive(query(".tour-menu"), fieldActive && body.classList.contains("tour-open"));
    setElementActive(query(".composer-popover"), fieldActive && body.classList.contains("composer-open"));
    setElementActive(query(".thinking-log"), fieldActive && body.classList.contains("log-open"));
    setElementActive(query(".reason-popover"), fieldActive && body.classList.contains("reason-open"));
    setElementActive(query(".method-disclosure"), fieldActive && body.dataset.step === "analyse" && body.classList.contains("method-open"));
    setElementActive(query(".change-detail"), fieldActive && body.dataset.step === "changes" && body.classList.contains("change-detail-open"));

    queryAll("[data-board-panel]").forEach((panel) => {
      setElementActive(panel, boardActive && panel.classList.contains("is-active"));
    });

    queryAll(".surface-thumb, .retired-thumb").forEach((thumb) => {
      thumb.inert = true;
      thumb.setAttribute("aria-hidden", "true");
      thumb.querySelectorAll("button, input, select, textarea, a").forEach((control) => {
        control.setAttribute("tabindex", "-1");
      });
    });
  }

  function focusRegion(selector) {
    window.setTimeout(() => {
      const region = query(selector);
      if (!region || region.inert) return;
      const target = region.matches("h1, h2") ? region : region.querySelector("h1, h2") || region;
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }, 40);
  }

  function activePanelSelector(step) {
    if (step === "edit") return ".edge-editor";
    return `[data-state-panel="${step}"]`;
  }

  function updateTour(step) {
    const [count, name] = stepMeta[step];
    setText(".tour-count", count);
    setText(".tour-name", name);
    queryAll("[data-go-step]").forEach((button) => {
      const active = button.dataset.goStep === step;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "step" : "false");
    });
  }

  function updateStage(stage) {
    body.dataset.stage = stage;
    queryAll(".stage-compass [data-stage]").forEach((button) => {
      const active = button.dataset.stage === stage;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const copy = stageCopy[stage];
    setText(".model-heading .eyebrow", copy.eyebrow);
    setText(".model-subtitle", copy.subtitle);
    if (body.dataset.step === "initial") {
      setText(".next-move-copy .tray-label", copy.label);
      setText(".next-move-copy h2", copy.title);
      setText(".next-move-copy p", copy.detail);
      const stageAction = query(".next-move-tray .primary-button");
      if (stageAction) {
        stageAction.dataset.action = copy.action;
        stageAction.firstChild.textContent = `${copy.button} `;
      }
    }
  }

  function updateLensButtons() {
    queryAll(".lens-cluster [data-lens]").forEach((button) => {
      const active = button.dataset.lens === body.dataset.lens;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setStep(step, options = {}) {
    if (!steps.includes(step)) return;

    transientClasses.forEach((className) => body.classList.remove(className));
    body.dataset.view = "field";
    body.dataset.step = step;

    if (step === "resolve") setExclusive("resolve-view", "choices", ["choices", "judgement", "confirmed"]);
    if (step === "intervention") setExclusive("patch-view", "offer", ["offer", "preview"]);
    if (step === "collaborate") setExclusive("collaboration-view", "private", ["private", "reveal", "applied"]);

    if (options.preservePatch !== true && !["changes", "edit"].includes(step)) body.classList.remove("patch-preview");

    if (step === "changes") {
      body.dataset.lens = "changes";
      body.classList.add("relationship-edited", "patch-accepted", "analysis-updated");
    } else if (["analyse", "intervention", "edit"].includes(step)) {
      body.dataset.lens = "outcome";
    } else {
      body.dataset.lens = "structure";
    }

    updateLensButtons();
    updateTour(step);
    updateStage(stepStage[step]);
    queryAll(".model-node").forEach((node) => node.classList.remove("is-selected", "is-highlighted"));
    queryAll(".edge, .edge-label, .changes-list button").forEach((item) => item.classList.remove("is-highlighted", "is-active"));

    if (step === "edit") {
      query('[data-node="sponsor-engagement"]')?.classList.add("is-selected");
      query(".edge-sponsor-renewal")?.classList.add("is-highlighted");
      query('[data-edge-label="sponsor-renewal"]')?.classList.add("is-highlighted");
    }

    syncUiState();
    if (options.focus) focusRegion(activePanelSelector(step));
  }

  function setLens(lens) {
    if (lens === "changes" && body.dataset.step !== "changes") {
      prepareTourStep("changes");
      return;
    }
    body.dataset.lens = lens;
    updateLensButtons();
  }

  function showToast(message, kind = "success") {
    const toast = query(".toast");
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.borderLeftColor = `var(--${kind})`;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3600);
  }

  function highlightPath(path) {
    body.classList.remove("highlight-executive", "highlight-adoption", "highlight-shared");
    if (path) body.classList.add(`highlight-${path}`);
  }

  function renderCurrentAnalysis(analysis) {
    modelState.currentAnalysis = { ...analysis };
    const executiveWins = analysis.winner === "executive";
    const winnerScore = executiveWins ? analysis.executive : analysis.adoption;
    setText(".current-direction-title", executiveWins ? "Start with executive value reviews" : "Start with targeted adoption support");
    setText(".current-direction-percent", `${winnerScore}%`);
    setText(".answer-title", executiveWins ? "Executive value reviews" : "Targeted adoption support");
    setText(
      ".answer-reason",
      executiveWins
        ? "Best current balance of renewal influence and service cost."
        : "The more direct current route to renewal without adding service headcount."
    );

    const references = queryAll(".result-cell:nth-child(2) .graph-reference");
    if (references.length >= 2) {
      references[0].textContent = executiveWins
        ? "Sponsor access can unblock value decisions"
        : "Product activation is the more direct renewal mechanism";
      references[0].dataset.highlight = executiveWins ? "executive" : "adoption";
      references[1].textContent = executiveWins
        ? "It works through the renewal path without adding headcount"
        : "Targeted support improves it without adding headcount";
      references[1].dataset.highlight = "shared";
    }
  }

  function analysisFromJudgement(strength) {
    const scenarios = {
      Strong: { executive: 71, adoption: 24, winner: "executive" },
      Modest: { executive: 64, adoption: 31, winner: "executive" },
      Weak: { executive: 54, adoption: 39, winner: "executive" },
      "Not causal": { executive: 38, adoption: 55, winner: "adoption" },
    };
    return scenarios[strength] || scenarios.Modest;
  }

  function deriveRevisedAnalysis() {
    const scenarios = {
      "Positive|Strong": { executive: 70, adoption: 25, winner: "executive", outcome: 90 },
      "Positive|Modest": { executive: 56, adoption: 39, winner: "executive", outcome: 89 },
      "Positive|Weak": { executive: 37, adoption: 58, winner: "adoption", outcome: 90 },
      "Negative|Strong": { executive: 18, adoption: 73, winner: "adoption", outcome: 91 },
      "Negative|Modest": { executive: 28, adoption: 65, winner: "adoption", outcome: 90 },
      "Negative|Weak": { executive: 41, adoption: 53, winner: "adoption", outcome: 89 },
    };
    return { ...scenarios[`${modelState.direction}|${modelState.strength}`] };
  }

  function renderEditedEdge() {
    const direction = modelState.direction.toLowerCase();
    const strength = modelState.strength.toLowerCase();
    const confidence = modelState.confidence.toLowerCase();
    setText(".edge-strength-edited", `${strength} ${direction}, ${confidence} confidence`);
    body.classList.remove("edge-direction-negative", "edge-confidence-high", "edge-confidence-medium", "edge-confidence-low");
    if (modelState.direction === "Negative") body.classList.add("edge-direction-negative");
    body.classList.add(`edge-confidence-${confidence}`);
  }

  function renderChanges(analysis) {
    modelState.revisedAnalysis = { ...analysis };
    const previous = modelState.currentAnalysis;
    const executiveWins = analysis.winner === "executive";
    const directionWord = modelState.direction.toLowerCase();
    const strengthWord = modelState.strength.toLowerCase();

    setText(
      ".updated-direction-title",
      executiveWins
        ? "Executive value reviews remain the stronger first move"
        : "Targeted adoption support is now the stronger first move"
    );
    setText(".executive-shift", `${previous.executive}% → ${analysis.executive}%`);
    setText(".adoption-shift", `${previous.adoption}% → ${analysis.adoption}%`);
    setText('[data-node="executive-reviews"] .changed-score', `${analysis.executive}%`);
    setText('[data-node="adoption-support"] .changed-score', `${analysis.adoption}%`);
    setText(".outcome-value", `Expected ${analysis.outcome}%`);
    setText(
      ".change-summary",
      `Sponsor engagement is now a ${strengthWord} ${directionWord} driver with ${modelState.confidence.toLowerCase()} confidence. ${
        executiveWins ? "Executive reviews still lead, but the reason is now explicit." : "Adoption support now carries the stronger renewal path."
      }`
    );
    setText(
      ".belief-change-copy",
      `Sponsor engagement became ${strengthWord} ${directionWord} with ${modelState.confidence.toLowerCase()} confidence.`
    );
    setText('.changes-list [data-change="3"] strong', executiveWins ? "Action clarified" : "Action changed");
    setText(
      ".action-change-copy",
      executiveWins ? "Executive reviews remain first with revised confidence." : "Adoption support moves from second to first."
    );
    setText(
      ".change-detail",
      executiveWins
        ? "The pilot can keep executive reviews first, while monitoring the revised relationship as an explicit assumption."
        : "The pilot should target activation barriers first, while using executive reviews selectively where sponsorship is genuinely absent."
    );
  }

  function resetModelState() {
    Object.assign(modelState, {
      judgement: "Modest",
      judgementReason: "Executive sponsors unblock renewal, but healthy accounts are also more likely to engage them.",
      judgementRecorded: false,
      direction: "Positive",
      strength: "Weak",
      confidence: "Low",
      edgeReason: "Likely confounded by existing account health.",
      currentAnalysis: { executive: 64, adoption: 31, winner: "executive" },
      revisedAnalysis: null,
    });

    const judgement = query('input[name="strength"][value="Modest"]');
    if (judgement) judgement.checked = true;
    const judgementReason = query("#judgement-reason");
    if (judgementReason) judgementReason.value = modelState.judgementReason;
    const direction = query("#edge-direction");
    const strength = query("#edge-strength");
    const confidence = query("#edge-confidence");
    const note = query("#edge-note");
    if (direction) direction.value = "Positive";
    if (strength) strength.value = "Weak";
    if (confidence) confidence.value = "Low";
    if (note) note.value = modelState.edgeReason;

    setText(".edge-strength", "Strong, uncertain");
    setText(".edge-strength-edited", "Weak, provisional");
    setText(".outcome-value", "Expected 88%");
    setText(".collaboration-applied h2", "One relationship became two conditional claims.");
    setText(".collaboration-applied p", "All three views and Noah's evidence remain attached. The current analysis is now marked out of date.");
    setText(".conditional-high strong", "Strong relationship");
    setText(".conditional-self strong", "Weak relationship");
    setText(".conditional-high small", "MC + PS · Experience + judgement");
    setText(".conditional-self small", "NW · Q2 cohort evidence");
    renderCurrentAnalysis({ executive: 64, adoption: 31, winner: "executive" });
    renderEditedEdge();
    renderChanges({ executive: 37, adoption: 58, winner: "adoption", outcome: 90 });
    setText(".outcome-value", "Expected 88%");
  }

  function resetExperienceHistory() {
    [...transientClasses, ...historyClasses].forEach((className) => body.classList.remove(className));
    setExclusive("resolve-view", "choices", ["choices", "judgement", "confirmed"]);
    setExclusive("patch-view", "offer", ["offer", "preview"]);
    setExclusive("collaboration-view", "private", ["private", "reveal", "applied"]);
    resetModelState();
  }

  function prepareTourStep(step) {
    resetExperienceHistory();

    if (step === "edit") body.classList.add("patch-accepted");
    if (["changes", "collaborate"].includes(step)) {
      body.classList.add("patch-accepted", "relationship-edited", "analysis-updated");
      renderEditedEdge();
      renderChanges(deriveRevisedAnalysis());
    }

    setStep(step, { preservePatch: true, focus: true });
  }

  function resetPrototype() {
    body.className = "resolve-view-choices patch-view-offer collaboration-view-private";
    body.dataset.view = "field";
    body.dataset.step = "initial";
    body.dataset.lens = "structure";
    zoom = 1;
    document.documentElement.style.setProperty("--graph-scale", String(zoom));
    resetModelState();
    updateLensButtons();
    updateTour("initial");
    updateStage("frame");
    syncUiState();
  }

  function setBoardTab(tab, focus = false) {
    queryAll("[data-board-tab]").forEach((button) => {
      const active = button.dataset.boardTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    queryAll("[data-board-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.boardPanel === tab);
    });
    syncUiState();
    if (focus) focusRegion(`[data-board-panel="${tab}"]`);
  }

  function openBoard(tab = "disposition", target = null) {
    body.dataset.view = "board";
    body.classList.remove("tour-open", "composer-open", "log-open", "key-open", "reason-open");
    setBoardTab(tab, !target);
    window.scrollTo({ top: 0, behavior: "instant" });
    if (target) {
      window.setTimeout(() => {
        const card = query(`[data-removal-card="${target}"]`);
        card?.scrollIntoView({ block: "center", behavior: "smooth" });
        card?.classList.add("is-flashed");
        card?.setAttribute("tabindex", "-1");
        card?.focus({ preventScroll: true });
        window.setTimeout(() => card?.classList.remove("is-flashed"), 1600);
      }, 80);
    }
  }

  function saveRelationship() {
    modelState.direction = query("#edge-direction")?.value || "Positive";
    modelState.strength = query("#edge-strength")?.value || "Weak";
    modelState.confidence = query("#edge-confidence")?.value || "Low";
    modelState.edgeReason = query("#edge-note")?.value.trim() || "No reason supplied.";
    renderEditedEdge();
    body.classList.remove("analysis-updated");
    body.classList.add("relationship-edited", "analysis-stale");
    syncUiState();
    focusRegion(".stale-ribbon");
    showToast("Relationship saved. Route scores remain unchanged until analysis is rerun.", "warning");
  }

  function openReason(mode, trigger) {
    reasonMode = mode;
    returnFocus = trigger;
    body.classList.add("reason-open");
    setText(
      ".reason-popover h2",
      mode === "proposal" ? "Why are you rejecting this change?" : "Why are you dismissing this intervention?"
    );
    const note = query("#reason-note");
    if (note) {
      note.value = mode === "proposal" ? "The proposed mechanism is not credible enough yet." : "Not material enough to change this pilot.";
    }
    syncUiState();
    window.setTimeout(() => note?.focus(), 40);
  }

  function closeReason() {
    body.classList.remove("reason-open");
    syncUiState();
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
    reasonMode = null;
  }

  function appendLog(title, detail, receipt) {
    const list = query(".log-list");
    if (!list) return;
    const item = document.createElement("li");
    const time = document.createElement("span");
    const copy = document.createElement("div");
    const heading = document.createElement("strong");
    const paragraph = document.createElement("p");
    const meta = document.createElement("small");
    time.className = "log-time";
    time.textContent = "Now";
    heading.textContent = title;
    paragraph.textContent = detail;
    meta.textContent = receipt;
    copy.append(heading, paragraph, meta);
    item.append(time, copy);
    list.append(item);
  }

  document.addEventListener("click", (event) => {
    const control = event.target.closest("button, [data-open-removal]");
    if (!control) return;

    if (control.dataset.goStep) {
      prepareTourStep(control.dataset.goStep);
      return;
    }
    if (control.dataset.lens) {
      setLens(control.dataset.lens);
      return;
    }
    if (control.dataset.stage) {
      updateStage(control.dataset.stage);
      body.dataset.lens = ["evaluate", "act"].includes(control.dataset.stage) ? "outcome" : "structure";
      updateLensButtons();
      return;
    }
    if (control.dataset.boardTab) {
      setBoardTab(control.dataset.boardTab);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (control.dataset.openRemoval) {
      openBoard("removals", control.dataset.openRemoval);
      return;
    }
    if (control.dataset.resolve) {
      const value = control.dataset.resolve;
      if (value === "judgement") {
        setExclusive("resolve-view", "judgement", ["choices", "judgement", "confirmed"]);
        syncUiState();
        focusRegion('.judgement-form');
      } else if (value === "choices") {
        setExclusive("resolve-view", "choices", ["choices", "judgement", "confirmed"]);
        syncUiState();
        focusRegion('.resolve-choices');
      } else if (value === "estimate") {
        modelState.judgement = "Modest";
        modelState.judgementRecorded = true;
        setText(".edge-strength", "Modest, Olumi estimate");
        renderCurrentAnalysis(analysisFromJudgement("Modest"));
        setExclusive("resolve-view", "confirmed", ["choices", "judgement", "confirmed"]);
        setText(".resolve-confirmation h2", "Olumi's provisional estimate is modest, with low confidence.");
        setText(".resolve-confirmation p", "The estimate is recorded as provisional and visible on the relationship. The result will remain sensitive until the team adds stronger evidence.");
        syncUiState();
        focusRegion('.resolve-confirmation');
      } else if (value === "unknown") {
        modelState.judgement = "Unknown";
        modelState.judgementRecorded = true;
        setText(".edge-strength", "Unknown, carried forward");
        renderCurrentAnalysis({ executive: 52, adoption: 40, winner: "executive" });
        showToast("Left unknown. Olumi kept it visible and carried uncertainty into analysis.", "info");
        window.setTimeout(() => setStep("analyse", { focus: true }), 500);
      }
      return;
    }
    if (control.dataset.highlight) {
      highlightPath(control.dataset.highlight);
      return;
    }
    if (control.dataset.change) {
      const change = control.dataset.change;
      body.classList.remove("change-highlight-1", "change-highlight-2", "change-highlight-3");
      body.classList.add(`change-highlight-${change}`);
      queryAll("[data-change]").forEach((item) => item.classList.toggle("is-active", item === control));
      return;
    }

    const action = control.dataset.action;
    if (!action) return;

    switch (action) {
      case "scenario-menu":
        showToast("Fixture scenario. No production data is connected.", "info");
        break;
      case "open-board":
        openBoard("disposition");
        break;
      case "close-board":
        body.dataset.view = "field";
        syncUiState();
        window.scrollTo({ top: 0, behavior: "instant" });
        query('[data-action="open-board"]')?.focus({ preventScroll: true });
        break;
      case "tour-menu":
        body.classList.toggle("tour-open");
        control.setAttribute("aria-expanded", String(body.classList.contains("tour-open")));
        syncUiState();
        break;
      case "toggle-key":
        body.classList.toggle("key-open");
        query(".model-key-control")?.setAttribute("aria-expanded", String(body.classList.contains("key-open")));
        syncUiState();
        if (body.classList.contains("key-open")) focusRegion(".model-key-popover");
        break;
      case "zoom-in":
        zoom = Math.min(1.12, zoom + 0.06);
        document.documentElement.style.setProperty("--graph-scale", String(zoom));
        break;
      case "zoom-out":
        zoom = Math.max(0.88, zoom - 0.06);
        document.documentElement.style.setProperty("--graph-scale", String(zoom));
        break;
      case "focus-model":
        zoom = 1;
        document.documentElement.style.setProperty("--graph-scale", "1");
        showToast("Model fitted to the available workspace.", "info");
        break;
      case "go-initial":
        prepareTourStep("initial");
        break;
      case "go-resolve":
        setStep("resolve", { focus: true });
        break;
      case "run-analysis":
        showToast("Running 1,000 fixture simulations…", "info");
        window.setTimeout(() => setStep("analyse", { focus: true }), 500);
        break;
      case "go-analyse":
        setStep("analyse", { preservePatch: true, focus: true });
        break;
      case "go-intervention":
        setStep("intervention", { focus: true });
        break;
      case "go-edit":
        setStep("edit", { preservePatch: true, focus: true });
        break;
      case "preview-patch":
        body.classList.add("patch-preview");
        setExclusive("patch-view", "preview", ["offer", "preview"]);
        syncUiState();
        focusRegion(".patch-actions");
        showToast("Preview shown on the field. Nothing has been applied.", "info");
        break;
      case "reject-patch":
        openReason("proposal", control);
        break;
      case "edit-patch":
        setStep("edit", { preservePatch: true, focus: true });
        break;
      case "accept-patch":
        body.classList.remove("patch-preview");
        body.classList.add("patch-accepted");
        syncUiState();
        showToast("Competing explanation added with provenance retained.", "success");
        window.setTimeout(() => setStep("edit", { preservePatch: true, focus: true }), 400);
        break;
      case "dismiss-intervention":
        openReason("intervention", control);
        break;
      case "cancel-reason":
        closeReason();
        break;
      case "rerun": {
        const revised = deriveRevisedAnalysis();
        renderChanges(revised);
        body.classList.remove("analysis-stale");
        body.classList.add("analysis-updated");
        syncUiState();
        showToast("Re-running with the saved relationship values…", "info");
        window.setTimeout(() => setStep("changes", { preservePatch: true, focus: true }), 550);
        break;
      }
      case "go-changes":
        setStep("changes", { preservePatch: true, focus: true });
        break;
      case "go-collaborate":
        setStep("collaborate", { preservePatch: true, focus: true });
        break;
      case "reveal-contributions":
        setExclusive("collaboration-view", "reveal", ["private", "reveal", "applied"]);
        syncUiState();
        focusRegion(".synthesis-card");
        showToast("Three views revealed together. No consensus score was created.", "success");
        break;
      case "apply-conditional":
        setExclusive("collaboration-view", "applied", ["private", "reveal", "applied"]);
        body.classList.remove("collaboration-model-disagreement");
        body.classList.add("collaboration-model-applied", "analysis-stale");
        setText(".collaboration-applied h2", "One relationship became two conditional claims.");
        setText(".collaboration-applied p", "All three views and Noah's evidence remain attached. The current analysis is now marked out of date.");
        syncUiState();
        focusRegion(".collaboration-applied");
        showToast("Two conditional relationships are now visible on the field with provenance.", "success");
        break;
      case "keep-disagreement":
        setExclusive("collaboration-view", "applied", ["private", "reveal", "applied"]);
        body.classList.remove("collaboration-model-applied", "analysis-stale");
        body.classList.add("collaboration-model-disagreement");
        setText(".conditional-high strong", "Maya: strong");
        setText(".conditional-self strong", "Noah: segment-dependent");
        setText(".collaboration-applied h2", "Three views remain visible as unresolved claims.");
        setText(".collaboration-applied p", "Olumi has not averaged them or changed the model. The disagreement remains attached for the next investigation.");
        syncUiState();
        focusRegion(".collaboration-applied");
        showToast("Disagreement preserved on the model without forcing consensus.", "info");
        break;
      case "inspect-conditional":
        query(".conditional-high")?.focus({ preventScroll: true });
        showToast("Both relationship claims show contributor and evidence provenance.", "info");
        break;
      case "toggle-method":
        body.classList.toggle("method-open");
        control.setAttribute("aria-expanded", String(body.classList.contains("method-open")));
        syncUiState();
        break;
      case "toggle-change-detail":
        body.classList.toggle("change-detail-open");
        control.setAttribute("aria-expanded", String(body.classList.contains("change-detail-open")));
        syncUiState();
        break;
      case "open-composer":
        returnFocus = control;
        body.classList.add("composer-open");
        syncUiState();
        window.setTimeout(() => query("#ask-input")?.focus(), 40);
        break;
      case "close-composer":
        body.classList.remove("composer-open");
        syncUiState();
        returnFocus?.focus({ preventScroll: true });
        returnFocus = null;
        break;
      case "open-log":
        returnFocus = control;
        body.classList.add("log-open");
        syncUiState();
        focusRegion(".thinking-log");
        break;
      case "close-log":
        body.classList.remove("log-open");
        syncUiState();
        returnFocus?.focus({ preventScroll: true });
        returnFocus = null;
        break;
      case "concept-only":
        showToast(`${control.dataset.concept || "This action"} is deliberately marked as a future concept.`, "warning");
        break;
      default:
        break;
    }
  });

  query(".judgement-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    modelState.judgement = query('input[name="strength"]:checked')?.value || "Modest";
    modelState.judgementReason = query("#judgement-reason")?.value.trim() || "No reason supplied.";
    modelState.judgementRecorded = true;
    const analysis = analysisFromJudgement(modelState.judgement);
    renderCurrentAnalysis(analysis);
    setText(".edge-strength", `${modelState.judgement}, your judgement`);
    setExclusive("resolve-view", "confirmed", ["choices", "judgement", "confirmed"]);

    const comparison = modelState.judgement === "Modest" ? "close to" : "different from";
    setText(".resolve-confirmation h2", `Your view is ${comparison} Olumi's provisional estimate.`);
    setText(
      ".resolve-confirmation p",
      `You recorded a ${modelState.judgement.toLowerCase()} effect before seeing Olumi's modest, low-confidence estimate. Your reason remains attached to the relationship.`
    );
    appendLog("Private judgement recorded", modelState.judgementReason, `Paul · ${modelState.judgement} effect`);
    syncUiState();
    focusRegion(".resolve-confirmation");
    showToast("Private judgement changed the relationship before Olumi's estimate was revealed.", "success");
  });

  query("#edge-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveRelationship();
  });

  query("#reason-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const note = query("#reason-note")?.value.trim() || "No reason supplied.";
    const mode = reasonMode;
    body.classList.remove("reason-open");
    if (mode === "proposal") {
      body.classList.remove("patch-preview");
      setExclusive("patch-view", "offer", ["offer", "preview"]);
      appendLog("Model proposal rejected", note, "Paul · Reason retained");
      showToast("Proposal rejected and the reason was added to the Thinking log.", "info");
      syncUiState();
      focusRegion(".intervention-actions");
    } else {
      appendLog("Intervention dismissed", note, "Paul · Reason retained");
      showToast("Intervention dismissed and the reason was added to the Thinking log.", "info");
      setStep("analyse", { focus: true });
    }
    reasonMode = null;
    returnFocus = null;
  });

  query("#ask-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    body.classList.remove("composer-open");
    body.classList.add("log-has-question");
    syncUiState();
    showToast("Olumi prioritised the relationship most likely to overturn the current view.", "success");
    window.setTimeout(() => setStep("intervention", { focus: true }), 400);
  });

  queryAll("[data-highlight]").forEach((reference) => {
    reference.addEventListener("mouseenter", () => highlightPath(reference.dataset.highlight));
    reference.addEventListener("mouseleave", () => highlightPath(null));
    reference.addEventListener("focus", () => highlightPath(reference.dataset.highlight));
    reference.addEventListener("blur", () => highlightPath(null));
  });

  queryAll(".model-node").forEach((node) => {
    node.addEventListener("click", () => {
      if (node.dataset.node === "sponsor-engagement") {
        setStep("edit", { preservePatch: true, focus: true });
        return;
      }
      queryAll(".model-node").forEach((item) => item.classList.toggle("is-selected", item === node));
      body.classList.add("node-selected");
      showToast(`${node.querySelector("strong")?.textContent || "Model element"} selected. Click the canvas to clear.`, "info");
    });
  });

  queryAll(".conditional-claim").forEach((claim) => {
    claim.addEventListener("click", () => {
      const label = claim.querySelector("strong")?.textContent || "Conditional relationship";
      const source = claim.querySelector("small")?.textContent || "Provenance retained";
      showToast(`${label}. ${source}.`, "info");
    });
  });

  query(".graph-plane")?.addEventListener("click", (event) => {
    if (event.target.closest(".model-node, .edge-label, .conditional-claim")) return;
    body.classList.remove("node-selected");
    queryAll(".model-node").forEach((node) => node.classList.remove("is-selected"));
  });

  query('[data-edge-label="sponsor-renewal"]')?.addEventListener("click", () => {
    setStep("edit", { preservePatch: true, focus: true });
  });

  queryAll("[data-open-removal]").forEach((card) => {
    if (card.tagName === "BUTTON") return;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      card.click();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const hadOverlay = body.classList.contains("reason-open") || body.classList.contains("composer-open") || body.classList.contains("log-open");
    body.classList.remove("tour-open", "composer-open", "log-open", "key-open", "reason-open", "highlight-executive", "highlight-adoption", "highlight-shared");
    query('[data-action="tour-menu"]')?.setAttribute("aria-expanded", "false");
    query(".model-key-control")?.setAttribute("aria-expanded", "false");
    syncUiState();
    if (hadOverlay) returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
    reasonMode = null;
  });

  resetPrototype();
})();
