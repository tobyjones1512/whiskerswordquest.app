// QR codes and the printable task card (used for the image and the PDF).
(function () {
  function matrix(text) {
    // Long links (big spelling lists) drop to low error correction so the code stays scannable.
    const q = qrcode(0, text.length > 900 ? "L" : "M");
    q.addData(text, "Byte");
    q.make();
    return q;
  }

  // Draws the code with a quiet zone, filling the canvas.
  function draw(canvas, text, size) {
    const q = matrix(text), n = q.getModuleCount(), quiet = 3;
    const cell = Math.floor(size / (n + quiet * 2));
    const side = cell * (n + quiet * 2);
    canvas.width = canvas.height = side;
    const c = canvas.getContext("2d");
    c.fillStyle = "#fff"; c.fillRect(0, 0, side, side);
    c.fillStyle = "#1F2A44";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
    return canvas;
  }

  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

  function wrap(c, text, maxW) {
    const words = text.split(" "), lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function outlined(c, text, x, y, fill) {
    c.lineJoin = "round"; c.lineWidth = 14; c.strokeStyle = "#1F2A44";
    c.strokeText(text, x, y + 9); c.fillStyle = "#1F2A44"; c.fillText(text, x, y + 9);
    c.strokeText(text, x, y); c.fillStyle = fill; c.fillText(text, x, y);
  }

  const loadImage = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

  // A 1200 × 1600 card: sky header, the task, the code, and how to scan it.
  async function card(link, task) {
    await document.fonts.load("900 60px Nunito").catch(() => {});
    const W = 1200, H = 1600, F = "Nunito, ui-rounded, system-ui, sans-serif";
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    const info = WWQ.describe(task);

    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#6FCBFF"); sky.addColorStop(0.55, "#D6F3FF"); sky.addColorStop(1, "#FFF3D1");
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,.85)";
    for (const [x, y, w] of [[60, 70, 200], [880, 120, 240], [480, 40, 150]]) {
      roundRect(c, x, y + 14, w, 40, 20); c.fill(); roundRect(c, x + w * .2, y, w * .5, 48, 24); c.fill();
    }
    c.fillStyle = "#8EE08A"; c.beginPath(); c.moveTo(0, H - 120); c.bezierCurveTo(300, H - 210, 700, H - 60, W, H - 150); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = "#5CCB78"; c.beginPath(); c.moveTo(0, H - 50); c.bezierCurveTo(400, H - 120, 800, H - 20, W, H - 70); c.lineTo(W, H); c.lineTo(0, H); c.fill();

    try {
      const icon = await loadImage("/img/icon.png");
      c.save(); roundRect(c, 70, 60, 150, 150, 38); c.clip(); c.drawImage(icon, 70, 60, 150, 150); c.restore();
    } catch {}
    c.textBaseline = "alphabetic"; c.textAlign = "left";
    c.font = `900 66px ${F}`; outlined(c, "Whiskers'", 250, 125, "#fff");
    outlined(c, "Word Quest", 250, 200, "#FFC93C");

    // White panel
    const px = 70, py = 260, pw = W - 140, ph = H - 260 - 170;
    c.fillStyle = "rgba(0,0,0,.08)"; roundRect(c, px, py + 8, pw, ph, 44); c.fill();
    c.fillStyle = "#fff"; roundRect(c, px, py, pw, ph, 44); c.fill();

    // Game chip
    c.font = `900 34px ${F}`;
    const g = info.game, chipText = g.title, cw = c.measureText(chipText).width + 56;
    c.fillStyle = g.color; roundRect(c, (W - cw) / 2, py + 40, cw, 60, 30); c.fill();
    c.fillStyle = "#fff"; c.textAlign = "center"; c.fillText(chipText, W / 2, py + 82);

    // Title
    c.fillStyle = "#1F2A44"; c.font = `900 54px ${F}`;
    let y = py + 165;
    for (const l of wrap(c, task.t || "Your task", pw - 100).slice(0, 2)) { c.fillText(l, W / 2, y); y += 62; }

    // QR
    const q = draw(document.createElement("canvas"), link, 640);
    const qs = Math.min(640, q.width);
    c.imageSmoothingEnabled = false;
    c.drawImage(q, (W - qs) / 2, y - 10, qs, qs);
    y += qs + 30;

    c.font = `900 34px ${F}`; c.fillStyle = "#1F2A44";
    c.fillText("Scan with the Camera app to play", W / 2, y); y += 46;
    c.font = `800 26px ${F}`; c.fillStyle = "rgba(31,42,68,.7)";
    for (const [k, v] of info.lines.slice(0, 4)) {
      const lines = wrap(c, `${k}: ${v}`, pw - 120);
      c.fillText(lines[0] + (lines.length > 1 ? "…" : ""), W / 2, y); y += 36;
    }

    c.font = `900 30px ${F}`; c.fillStyle = "#0d3b1d";
    c.fillText("whiskerswordquest.app", W / 2, H - 50);
    return cv;
  }

  window.WWQQR = { draw, card };
})();
