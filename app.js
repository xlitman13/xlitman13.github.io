(() => {
  const STORAGE_KEY = "family-yahtzee-scorecard-v1";

  const categories = [
    { id: "ones", label: "Ones", hint: "Total 1s", type: "upper", face: 1 },
    { id: "twos", label: "Twos", hint: "Total 2s", type: "upper", face: 2 },
    { id: "threes", label: "Threes", hint: "Total 3s", type: "upper", face: 3 },
    { id: "fours", label: "Fours", hint: "Total 4s", type: "upper", face: 4 },
    { id: "fives", label: "Fives", hint: "Total 5s", type: "upper", face: 5 },
    { id: "sixes", label: "Sixes", hint: "Total 6s", type: "upper", face: 6 },
    { id: "threeKind", label: "3 of a Kind", hint: "Total all dice", type: "lower" },
    { id: "fourKind", label: "4 of a Kind", hint: "Total all dice", type: "lower" },
    { id: "fullHouse", label: "Full House", hint: "25 points", type: "fixed", choices: [0, 25] },
    { id: "smallStraight", label: "Small Straight", hint: "30 points", type: "fixed", choices: [0, 30] },
    { id: "largeStraight", label: "Large Straight", hint: "40 points", type: "fixed", choices: [0, 40] },
    { id: "yahtzee", label: "Yahtzee", hint: "50 points", type: "fixed", choices: [0, 50] },
    { id: "chance", label: "Chance", hint: "Total all dice", type: "lower" },
    { id: "yahtzeeBonus", label: "Yahtzee Bonus", hint: "100 each", type: "bonus" },
  ];

  const els = {
    head: document.getElementById("scoreHead"),
    body: document.getElementById("scoreBody"),
    addPlayer: document.getElementById("addPlayerBtn"),
    newGame: document.getElementById("newGameBtn"),
    newGameDialog: document.getElementById("newGameDialog"),
    confirmNewGame: document.getElementById("confirmNewGameBtn"),
    dialog: document.getElementById("scoreDialog"),
    scoreForm: document.getElementById("scoreForm"),
    scoreInput: document.getElementById("scoreInput"),
    scoreInputWrap: document.getElementById("scoreInputWrap"),
    dialogPlayer: document.getElementById("dialogPlayer"),
    dialogCategory: document.getElementById("dialogCategory"),
    quickChoices: document.getElementById("quickChoices"),
    clearScore: document.getElementById("clearScoreBtn"),
  };

  let state = loadState();
  let editing = null;

  function freshPlayer(name) {
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      name,
      scores: {}
    };
  }

  function defaultState() {
    return {
      players: [freshPlayer("Player 1"), freshPlayer("Player 2")]
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.players?.length) return parsed;
    } catch {}
    return defaultState();
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function numericScore(player, id) {
    const value = player.scores[id];
    return Number.isFinite(value) ? value : 0;
  }

  function totals(player) {
    const upperIds = ["ones","twos","threes","fours","fives","sixes"];
    const lowerIds = ["threeKind","fourKind","fullHouse","smallStraight","largeStraight","yahtzee","chance","yahtzeeBonus"];
    const upper = upperIds.reduce((sum, id) => sum + numericScore(player, id), 0);
    const bonus = upper >= 63 ? 35 : 0;
    const lower = lowerIds.reduce((sum, id) => sum + numericScore(player, id), 0);
    return { upper, bonus, upperTotal: upper + bonus, lower, grand: upper + bonus + lower };
  }

  function row(label, hint, rowClass = "") {
    const tr = document.createElement("tr");
    if (rowClass) tr.className = rowClass;
    const td = document.createElement("td");
    td.innerHTML = `<div class="category">${label}${hint ? `<small>${hint}</small>` : ""}</div>`;
    tr.appendChild(td);
    return tr;
  }

  function addSummaryRow(label, key, className = "summary-row") {
    const tr = row(label, "", className);
    state.players.forEach(player => {
      const td = document.createElement("td");
      td.textContent = totals(player)[key];
      tr.appendChild(td);
    });
    els.body.appendChild(tr);
  }

  function render() {
    renderHead();
    renderBody();
    saveState();
  }

  function renderHead() {
    els.head.innerHTML = "";
    const tr = document.createElement("tr");
    const first = document.createElement("th");
    first.textContent = "Category";
    tr.appendChild(first);

    state.players.forEach((player, index) => {
      const th = document.createElement("th");
      th.className = "player-head";

      const input = document.createElement("input");
      input.className = "player-name";
      input.value = player.name;
      input.maxLength = 18;
      input.setAttribute("aria-label", `Player ${index + 1} name`);
      input.addEventListener("change", () => {
        player.name = input.value.trim() || `Player ${index + 1}`;
        render();
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-player";
      remove.textContent = "Remove";
      remove.hidden = state.players.length <= 1;
      remove.addEventListener("click", () => {
        state.players = state.players.filter(p => p.id !== player.id);
        render();
      });

      th.append(input, remove);
      tr.appendChild(th);
    });

    els.head.appendChild(tr);
  }

  function renderBody() {
    els.body.innerHTML = "";

    const upperHeader = row("Upper Section", "", "section-row");
    state.players.forEach(() => upperHeader.appendChild(document.createElement("td")));
    els.body.appendChild(upperHeader);

    categories.filter(c => c.type === "upper").forEach(renderCategoryRow);

    addSummaryRow("Upper subtotal", "upper");
    addSummaryRow("Bonus", "bonus", "summary-row bonus-row");
    addSummaryRow("Upper total", "upperTotal");

    const lowerHeader = row("Lower Section", "", "section-row");
    state.players.forEach(() => lowerHeader.appendChild(document.createElement("td")));
    els.body.appendChild(lowerHeader);

    categories.filter(c => c.type !== "upper").forEach(renderCategoryRow);

    addSummaryRow("Lower total", "lower");
    addSummaryRow("Grand total", "grand", "summary-row grand-row");
  }

  function renderCategoryRow(category) {
    const tr = row(category.label, category.hint);

    state.players.forEach(player => {
      const td = document.createElement("td");
      td.className = "score-cell";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "score-button";
      const value = player.scores[category.id];
      const filled = Number.isFinite(value);
      btn.classList.add(filled ? "filled" : "empty");
      btn.textContent = filled ? value : "Tap";
      btn.setAttribute("aria-label", `${player.name}, ${category.label}: ${filled ? value : "empty"}`);
      btn.addEventListener("click", () => openScoreDialog(player, category));

      td.appendChild(btn);
      tr.appendChild(td);
    });

    els.body.appendChild(tr);
  }

  function openScoreDialog(player, category) {
    editing = { playerId: player.id, categoryId: category.id };
    els.dialogPlayer.textContent = player.name;
    els.dialogCategory.textContent = category.label;
    const current = player.scores[category.id];
    els.scoreInput.value = Number.isFinite(current) ? current : "";

    els.quickChoices.innerHTML = "";
    if (category.choices) {
      els.quickChoices.hidden = false;
      els.scoreInputWrap.hidden = true;
      category.choices.forEach(choice => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quick-choice";
        btn.textContent = choice === 0 ? "Scratch · 0" : String(choice);
        btn.addEventListener("click", () => {
          setScore(choice);
          els.dialog.close();
        });
        els.quickChoices.appendChild(btn);
      });
    } else if (category.type === "bonus") {
      els.quickChoices.hidden = false;
      els.scoreInputWrap.hidden = false;
      [0, 100, 200, 300].forEach(choice => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quick-choice";
        btn.textContent = String(choice);
        btn.addEventListener("click", () => {
          setScore(choice);
          els.dialog.close();
        });
        els.quickChoices.appendChild(btn);
      });
    } else {
      els.quickChoices.hidden = true;
      els.scoreInputWrap.hidden = false;
    }

    els.dialog.showModal();
    setTimeout(() => {
      if (!els.scoreInputWrap.hidden) els.scoreInput.focus();
    }, 50);
  }

  function setScore(value) {
    if (!editing) return;
    const player = state.players.find(p => p.id === editing.playerId);
    if (!player) return;

    if (value === null) {
      delete player.scores[editing.categoryId];
    } else {
      player.scores[editing.categoryId] = Math.max(0, Math.floor(Number(value) || 0));
    }
    render();
  }

  els.scoreForm.addEventListener("submit", (event) => {
    const submitter = event.submitter;
    if (!submitter || submitter.value !== "default") return;
    event.preventDefault();

    const category = categories.find(c => c.id === editing?.categoryId);
    if (category?.choices) return;

    const raw = els.scoreInput.value.trim();
    if (raw === "") return;
    setScore(Number(raw));
    els.dialog.close();
  });

  els.clearScore.addEventListener("click", () => {
    setScore(null);
    els.dialog.close();
  });

  els.addPlayer.addEventListener("click", () => {
    if (state.players.length >= 8) {
      alert("This scorecard supports up to 8 players.");
      return;
    }
    state.players.push(freshPlayer(`Player ${state.players.length + 1}`));
    render();
  });

  els.newGame.addEventListener("click", () => els.newGameDialog.showModal());

  els.confirmNewGame.addEventListener("click", () => {
    state.players.forEach(player => { player.scores = {}; });
    render();
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  render();
})();
