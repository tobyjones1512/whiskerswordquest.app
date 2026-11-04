// Create a Task: builds the task from the form, keeps the link and QR code up to date, and exports the image and PDF.
(function () {
  const { games, englishes, focus, encode, cleanWords, describe } = WWQ;
  const D = WWQ_DATA;
  const $ = (id) => document.getElementById(id);
  const form = $("form");
  const radio = (name) => (form.querySelector(`input[name="${name}"]:checked`) || {}).value;
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
    if (has("count")) {
      const c = radio("count");
      if (c === "all") t.n = Math.min(30, Math.max(3, words.length * (t.q ? 1 : 2)));
      else if (c && c !== "8") t.n = Number(c);
    }
    if (has("hints") && !$("hints").checked) t.h = false;

    $("words-count").textContent = $("words").value.trim()
      ? `${words.length} word${words.length === 1 ? "" : "s"}${words.length ? ": " + words.join(", ") : ""}` : "";
    if (has("count") && radio("count") === "all" && words.length * (t.q ? 1 : 2) > 30) problems.push("The app plays up to 30 questions in a round, so some words will be left out. Split long lists into two tasks.");
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
    $("link").value = link;
    $("open").href = link;
    WWQQR.draw($("qr"), link, 600);
    $("chip").textContent = g.title;
    $("chip").style.background = g.color;
    $("pv-title").textContent = t.t || "Untitled task";
    $("summary").replaceChildren(...describe(t).lines.map(([k, v]) => el(`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)));
    $("problems").innerHTML = problems.map((p) => `<p class="notice bad" style="margin:0 0 10px">${esc(p)}</p>`).join("");
    const blocked = problems.some((p) => !p.startsWith("The app plays"));
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
