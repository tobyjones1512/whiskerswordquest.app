// Create a Task: builds the task from the form, keeps the link and QR code up to date, and exports the image and PDF.
(function () {
  const { games, englishes, focus, encode, cleanWords, describe } = WWQ;
  const D = WWQ_DATA;
  const $ = (id) => document.getElementById(id);
  const form = $("form");
  const radio = (name) => (form.querySelector(`input[name="${name}"]:checked`) || {}).value;
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // A grown-up opening this inside the app (?app=1): no class wording, and the task is saved to the app instead of shared.
  const parent = new URLSearchParams(location.search).get("app") === "1";
  if (parent) {
    document.body.classList.add("parent");
    $("lead").textContent = "Choose a game, set it up for your child, then save it to the app. It appears in My Tasks on their home screen.";
    $("title").placeholder = "e.g. Week 5 spellings";
  }

  // ---------- Build the controls ----------
  for (const g of games) {
    const box = $(g.kind === "Learn" ? "pick-learn" : "pick-games");
    box.append(el(`<label><input type="radio" name="game" value="${g.key}"><div class="tile" style="--c:${g.color}"><div class="badge">${esc(g.badge)}</div><h3>${esc(g.title)}</h3><p>${esc(g.sub)}</p></div></label>`));
  }
  for (const e of englishes) $("english").append(el(`<option value="${e.id}">${e.flag} ${esc(e.name)}</option>`));
  const guess = { "en-US": "us", "en-CA": "canada", "en-AU": "australia", "en-NZ": "newZealand", "en-IE": "ireland", "en-IN": "india", "en-ZA": "southAfrica" }[navigator.language];
  $("english").value = guess || "uk";

  for (const grp of focus) {
    const wrap = el(`<div style="margin-bottom:12px"><p class="small" style="margin:0 0 6px">${esc(grp.title)}</p><div class="chips"></div></div>`);
    for (const f of grp.items) wrap.lastChild.append(el(`<label><input type="checkbox" name="focus" value="${f}">${f}</label>`));
    $("focus").append(wrap);
  }
  // Sound Buttons can only focus on sounds its words actually use.
  const focusAll = new Set(focus.flatMap((g) => g.items));
  const soundParts = [...new Set(D.sounds.flatMap((w) => w.parts))].filter((p) => focusAll.has(p));
  for (const p of soundParts) $("sounds").append(el(`<label><input type="checkbox" name="sound" value="${p}">${p}</label>`));

  function renderYears() {
    const e = englishes.find((x) => x.id === $("english").value);
    const cur = Number(radio("year") || 2);
    $("year").replaceChildren(...e.years.map((y, i) => el(`<label><input type="radio" name="year" value="${i + 1}" ${i + 1 === cur ? "checked" : ""}>${esc(y)}</label>`)));
  }
  function renderSets() {
    const y = Number(radio("year") || 2), all = $("sets-all").checked;
    const ticked = new Set([...form.querySelectorAll('input[name="set"]:checked')].map((i) => i.value));
    const items = Object.entries(D.sorts).filter(([id, s]) => all || s.years.includes(y) || ticked.has(id));
    $("sets").replaceChildren(...items.map(([id, s]) => el(`<label><input type="checkbox" name="set" value="${id}" ${ticked.has(id) ? "checked" : ""}><span>${esc(s.title)} <span class="muted">${esc(s.a)} / ${esc(s.b)}</span><small>${esc([...s.aw.slice(0, 3), ...s.bw.slice(0, 3)].join(", "))}…</small></span></label>`)));
    const pt = new Set([...form.querySelectorAll('input[name="pairset"]:checked')].map((i) => i.value)), pall = $("pairs-all").checked;
    const pitems = Object.entries(D.pairs).filter(([id, p]) => pall || p.years.includes(y) || pt.has(id));
    $("pairsets").replaceChildren(...pitems.map(([id, p]) => el(`<label><input type="checkbox" name="pairset" value="${id}" ${pt.has(id) ? "checked" : ""}><span>${esc(p.title)}<small>${esc(p.pairs.slice(0, 4).map((x) => x.join(" = ")).join(", "))}…</small></span></label>`)));
  }
  function renderCount(game, words) {
    const cur = radio("count");
    const choices = [5, 8, 10, 15, 20, 30];
    const opts = [];
    if (game === "spelling" && words.length) opts.push(["all", "Every word"]);
    for (const n of choices) opts.push([String(n), String(n)]);
    const pick = opts.some(([v]) => v === cur) ? cur : (opts[0][0] === "all" ? "all" : "8");
    $("count").replaceChildren(...opts.map(([v, l]) => el(`<label><input type="radio" name="count" value="${v}" ${v === pick ? "checked" : ""}>${l}</label>`)));
  }

  // What each game accepts as "your own content". The app reads the same line formats (Custom.swift).
  const own = {
    sounds: { hint: "Words with - between each sound, separated by commas or new lines. At least 3 words.", ph: "c-a-t, sh-i-p, r-ai-n", min: 3,
      count: (ls) => ls.flatMap((l) => l.split(",")).filter((w) => w.split("-").filter((p) => p.trim()).length >= 2).length },
    tenses: { hint: "One verb per line: now = before. At least 3 verbs.", ph: "walk = walked\nrun = ran\nswim = swam", min: 3,
      count: (ls) => ls.filter((l) => l.split("=").map((s) => s.trim()).filter(Boolean).length === 2).length },
    homophones: { hint: "A sentence with ___, then | the right word, then | the wrong one. At least 3 lines.", ph: "We swim in the ___. | sea | see", min: 3,
      count: (ls) => ls.filter((l) => l.split("|").map((s) => s.trim()).filter(Boolean).length >= 3 && l.split("|")[0].includes("___")).length },
    sentences: { hint: "One sentence per line. At least 3 sentences.", ph: "The cat sat on the mat.\nWe went to the park.", min: 3, count: (ls) => ls.length },
    phonics: { hint: "A sound, a colon, then words that have it. Use two or more lines.", ph: "ai: rain, train, paint\nee: feet, tree, green", min: 3,
      count: (ls) => { const g = ls.map((l) => l.split(":")[1] || "").map((s) => s.split(",").map((w) => w.trim()).filter(Boolean)); return g.length >= 2 ? g.reduce((n, w) => n + w.length, 0) : 0; } },
  };
  own.tilt = { ...own.homophones, hint: "Same as Sound-Alikes: a sentence with ___, then | right | wrong. At least 3 lines." };

  // ---------- Read the form ----------
  function lines(id) { return $(id).value.split(/\n|,/).map((s) => s.trim()).filter(Boolean); }

  function read() {
    const key = radio("game") || "spelling";
    const g = games.find((x) => x.key === key);
    const has = (o) => g.opts.includes(o);
    const t = { g: key };
    const problems = [];
    const title = $("title").value.trim();
    if (title) t.t = title;
    t.e = $("english").value;
    if (key !== "sounds") t.y = Number(radio("year") || 2);
    const v = radio("voice"); if (v) t.r = v === "1";

    const words = cleanWords($("words").value).slice(0, 60);
    if (has("words") && words.length) t.w = words;
    if (has("style") && radio("style")) t.q = radio("style");
    if (has("keyboard") && t.q !== "pick" && radio("kb") === "keys") t.k = "keys";
    if (has("focus") && !t.w) { const f = [...form.querySelectorAll('input[name="focus"]:checked')].map((i) => i.value); if (f.length) t.f = f; }
    if (has("sounds")) {
      const f = [...form.querySelectorAll('input[name="sound"]:checked')].map((i) => i.value);
      if (f.length) t.f = f;
      const hits = D.sounds.filter((w) => f.some((p) => w.parts.includes(p)));
      $("sounds-words").textContent = f.length ? `${hits.length} word${hits.length === 1 ? "" : "s"}: ${hits.map((w) => w.emoji + " " + w.word).join("  ")}` : "";
      if (f.length && hits.length < 3) problems.push("Pick more sounds: at least 3 words must use them, or the app will use a mix.");
    }
    if (has("sets")) {
      if (radio("setsrc") === "own") {
        const a = $("ga").value.trim(), b = $("gb").value.trim(), aw = lines("gaw").slice(0, 12), bw = lines("gbw").slice(0, 12);
        if (!a || !b) problems.push("Give both groups a name.");
        if (aw.length < 3 || bw.length < 3) problems.push("Add at least 3 words to each group.");
        if (a && b && aw.length >= 3 && bw.length >= 3) t.c = { a, b, aw, bw };
      } else {
        const s = [...form.querySelectorAll('input[name="set"]:checked')].map((i) => i.value);
        if (s.length) t.s = s;
      }
    }
    if (has("pairs")) {
      if (radio("pairsrc") === "own") {
        const p = $("ownpairs").value.split("\n").map((l) => l.split("=").map((s) => s.trim())).filter((p) => p.length === 2 && p[0] && p[1]).slice(0, 8);
        if (p.length < 3) problems.push("Add at least 3 pairs, one per line, like hot = cold.");
        else t.p = p;
      } else {
        const s = [...form.querySelectorAll('input[name="pairset"]:checked')].map((i) => i.value);
        if (s.length) t.s = s;
      }
    }
    if (has("own") && own[key]) {
      const ls = $("owntext").value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 40).map((s) => s.slice(0, 120));
      if (ls.length) {
        if (own[key].count(ls) < own[key].min) problems.push(`Your own content needs at least ${own[key].min} valid items. Check the format shown under the box.`);
        else { t.x = ls; delete t.f; }
      }
    }
    if (has("count")) {
      const c = radio("count");
      if (c === "all") t.n = Math.min(30, Math.max(3, words.length));
      else if (c && c !== "8") t.n = Number(c);
    }
    if (has("hints") && !$("hints").checked) t.h = false;

    // An empty task can't be shared: it needs a name and, where the game has anything to customise, something chosen.
    if (!title) problems.push("Give your task a name.");
    const customisable = g.opts.some((o) => ["words", "focus", "sounds", "sets", "pairs", "own"].includes(o));
    if (customisable && !(t.w || t.f || t.c || t.p || t.x || (t.s && t.s.length))) problems.push("This task is empty. Add your own content, or choose words, sounds or sets in step 3.");

    $("words-count").textContent = $("words").value.trim()
      ? `${words.length} word${words.length === 1 ? "" : "s"}${words.length ? ": " + words.join(", ") : ""}` : "";
    if (has("count") && radio("count") === "all" && words.length > 30) problems.push("The app plays up to 30 questions in a round, so some words will be left out. Split long lists into two tasks.");
    return { t, g, words, problems };
  }

  // ---------- Update ----------
  let current = null;
  function update() {
    const key = radio("game") || "spelling";
    const g = games.find((x) => x.key === key);
    const words = cleanWords($("words").value);
    renderCount(key, words);
    for (const box of form.querySelectorAll(".opt")) box.classList.toggle("hidden", !g.opts.includes(box.dataset.opt));
    if (key === "spelling") {
      form.querySelector('[data-opt="keyboard"]').classList.toggle("hidden", radio("style") === "pick");
      form.querySelector('[data-opt="focus"]').classList.toggle("hidden", words.length > 0);
    }
    if (own[key]) { $("owntext").placeholder = own[key].ph; $("own-hint").textContent = own[key].hint; }
    $("no-opts").classList.toggle("hidden", g.opts.some((o) => o !== "voice"));
    $("year-field").classList.toggle("hidden", key === "sounds");
    $("sets-built").classList.toggle("hidden", radio("setsrc") === "own");
    $("sets-own").classList.toggle("hidden", radio("setsrc") !== "own");
    $("pairs-built").classList.toggle("hidden", radio("pairsrc") === "own");
    $("pairs-own").classList.toggle("hidden", radio("pairsrc") !== "own");

    const b = $("benefit");
    b.style.setProperty("--c", g.color);
    b.innerHTML = `<h3>${esc(g.title)}</h3><dl><dt>What it practises</dt><dd>${esc(g.practises)}</dd><dt>Why it helps</dt><dd>${esc(g.why)}</dd></dl>`;

    const { t, problems } = read();
    current = t;
    const link = WWQ.base + encode(t);
    WWQQR.draw($("qr"), link, 600);
    $("chip").textContent = g.title;
    $("chip").style.background = g.color;
    $("pv-title").textContent = t.t || "Untitled task";
    $("summary").replaceChildren(...describe(t).lines.map(([k, v]) => el(`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)));
    $("problems").innerHTML = problems.map((p) => `<p class="notice bad" style="margin:0 0 10px">${esc(p)}</p>`).join("");
    $("save-app").href = "whiskerswordquest://save#" + encode(t);
    const blocked = problems.some((p) => !p.startsWith("The app plays"));
    $("link").value = blocked ? "" : link;
    $("open").href = blocked ? "#" : link;
    $("qr").style.opacity = blocked ? ".1" : "";
    $("save-app").classList.toggle("hidden", blocked);
    for (const id of ["png", "pdf", "share", "copy"]) $(id).disabled = blocked;
    $("open").classList.toggle("hidden", blocked);
  }

  // ---------- Export ----------
  const fileName = () => ((current.t || games.find((g) => g.key === current.g).title).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "task") + "-whiskers-word-quest";

  async function cardBlob() {
    const cv = await WWQQR.card($("link").value, current);
    return new Promise((ok) => cv.toBlob(ok, "image/png"));
  }
  function save(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  $("png").onclick = async () => save(await cardBlob(), fileName() + ".png");

  $("pdf").onclick = async () => {
    const cv = await WWQQR.card($("link").value, current);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const w = 170, h = w * cv.height / cv.width, x = 20, y = 12;
    doc.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", x, y, w, h);   // a PNG here makes a 7 MB PDF
    doc.link(x, y, w, h, { url: $("link").value });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(31, 42, 68);
    doc.text("Scan the code with the Camera app on iPhone or iPad, or tap it in this PDF. On a classroom iPad, use Scan class QR code on the home screen.", 105, y + h + 8, { align: "center", maxWidth: 170 });
    doc.save(fileName() + ".pdf");
  };

  $("share").onclick = async () => {
    const link = $("link").value, title = current.t || "Whiskers' Word Quest task";
    try {
      const file = new File([await cardBlob()], fileName() + ".png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ title, text: title, url: link, files: [file] });
      if (navigator.share) return await navigator.share({ title, url: link });
    } catch (e) { if (e.name === "AbortError") return; }
    copy();
  };

  async function copy() {
    try { await navigator.clipboard.writeText($("link").value); }
    catch { $("link").select(); document.execCommand("copy"); }
    const b = $("copy"); b.textContent = "Copied!"; setTimeout(() => (b.textContent = "Copy"), 1600);
  }
  $("copy").onclick = copy;

  // ---------- Drafts: save the whole form to this browser or a file, and open it again later ----------
  const snapshot = () => {
    const s = { radios: {}, checks: {}, groups: {}, fields: {} };
    for (const i of form.elements) {
      const k = i.id || i.name;
      if (!k || i.id === "link" || ["button", "submit", "file"].includes(i.type)) continue;
      if (i.type === "radio") { if (i.checked) s.radios[i.name] = i.value; }
      else if (i.type === "checkbox") { if (i.name) { (s.groups[i.name] ||= []); if (i.checked) s.groups[i.name].push(i.value); } else s.checks[i.id] = i.checked; }
      else s.fields[i.id] = i.value;
    }
    return s;
  };
  const tick = (name, value) => { const i = form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`); if (i) i.checked = true; };
  function restore(s) {
    tick("game", s.radios.game);
    $("english").value = s.fields.english; renderYears();
    if (s.radios.year) tick("year", s.radios.year);
    $("sets-all").checked = $("pairs-all").checked = true; renderSets();   // so every saved set is listed to tick
    for (const n of ["set", "pairset"]) for (const v of s.groups[n] || []) tick(n, v);
    for (const [id, on] of Object.entries(s.checks)) $(id).checked = on;
    renderSets();
    for (const [id, v] of Object.entries(s.fields)) if ($(id) && id !== "english") $(id).value = v;
    for (const [n, v] of Object.entries(s.radios)) if (!["game", "year", "count"].includes(n)) tick(n, v);
    for (const n of ["focus", "sound"]) { for (const i of form.querySelectorAll(`input[name="${n}"]`)) i.checked = (s.groups[n] || []).includes(i.value); }
    update();
    if (s.radios.count) { tick("count", s.radios.count); update(); }
  }
  const draftName = () => $("title").value.trim() || games.find((g) => g.key === (radio("game") || "spelling")).title;
  const stored = () => { try { return JSON.parse(localStorage.getItem("wwq.drafts") || "[]"); } catch { return []; } };
  function listDrafts() {
    const ds = stored();
    $("draft-list").replaceChildren(...ds.map((d, i) => {
      const row = el(`<div class="draft-row"><span>${esc(d.name)}<small>${esc(new Date(d.saved).toLocaleString())}</small></span><button type="button" class="btn small white">Open</button><button type="button" class="btn small coral">Delete</button></div>`);
      const [open, del] = row.querySelectorAll("button");
      open.onclick = () => restore(d.state);
      del.onclick = () => { ds.splice(i, 1); localStorage.setItem("wwq.drafts", JSON.stringify(ds)); listDrafts(); };
      return row;
    }));
  }
  $("draft-save").onclick = () => {
    const ds = stored(), name = draftName(), d = { name, saved: Date.now(), state: snapshot() };
    const at = ds.findIndex((x) => x.name === name);
    if (at >= 0) ds[at] = d; else ds.unshift(d);
    try { localStorage.setItem("wwq.drafts", JSON.stringify(ds.slice(0, 30))); } catch { alert("This browser would not save the draft. Use Save to file instead."); }
    listDrafts();
    const b = $("draft-save"); b.textContent = "Saved!"; setTimeout(() => (b.textContent = "Save in browser"), 1600);
  };
  $("draft-file").onclick = () => {
    const name = draftName();
    save(new Blob([JSON.stringify({ wwq: 1, name, saved: Date.now(), state: snapshot() })], { type: "application/json" }), name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") + ".wwq.json");
  };
  $("draft-open").onclick = () => $("draft-input").click();
  $("draft-input").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.wwq !== 1 || !games.some((g) => g.key === d.state.radios.game)) throw 0;
      restore(d.state);
    } catch { alert("That file is not a Whiskers' Word Quest task."); }
  };
  listDrafts();

  // ---------- Start ----------
  const params = new URLSearchParams(location.search);
  const start = games.some((g) => g.key === params.get("game")) ? params.get("game") : "spelling";
  form.querySelector(`input[name="game"][value="${start}"]`).checked = true;
  renderYears(); renderSets();
  $("english").addEventListener("change", () => { renderYears(); update(); });
  form.addEventListener("change", (e) => { if (["year", "sets-all", "pairs-all"].includes(e.target.name || e.target.id)) renderSets(); update(); });
  form.addEventListener("input", update);
  update();
})();
