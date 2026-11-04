// Shared by the For Education, Create Task and Play pages: the games, the Englishes, and the task link format.
// The app reads the same format in ClassTask.swift, so keys here must match its CodingKeys.
(function () {
  const englishes = [
    { id: "uk", flag: "🇬🇧", name: "British English", years: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"] },
    { id: "us", flag: "🇺🇸", name: "American English", years: ["Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"] },
    { id: "canada", flag: "🇨🇦", name: "Canadian English", years: ["Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"] },
    { id: "australia", flag: "🇦🇺", name: "Australian English", years: ["Foundation", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5"] },
    { id: "newZealand", flag: "🇳🇿", name: "New Zealand English", years: ["Year 2", "Year 3", "Year 4", "Year 5", "Year 6", "Year 7"] },
    { id: "ireland", flag: "🇮🇪", name: "Irish English", years: ["Senior Infants", "1st Class", "2nd Class", "3rd Class", "4th Class", "5th Class"] },
    { id: "india", flag: "🇮🇳", name: "Indian English", years: ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6"] },
    { id: "southAfrica", flag: "🇿🇦", name: "South African English", years: ["Grade R", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"] },
  ];

  const focus = [
    { title: "Consonant sounds", items: ["sh", "ch", "th", "ng", "ck", "ph", "wh"] },
    { title: "Vowel sounds", items: ["ai", "ay", "ee", "ea", "igh", "ie", "oa", "ow", "oo", "ar", "or", "ir", "ur", "er", "oi", "oy", "air", "ear"] },
    { title: "Prefixes", items: ["un-", "dis-", "mis-", "re-", "im-", "il-", "ir-"] },
    { title: "Endings", items: ["-ed", "-ing", "-ly", "-ful", "-less", "-tion", "-sion", "-able", "-ible", "-ous", "-ant", "-ent"] },
  ];

  // opts: what the Create Task page offers for each game.
  const games = [
    { key: "spelling", kind: "Learn", title: "Spelling Spark", sub: "Spell it right", badge: "abc", color: "#8E6CFF",
      practises: "Spelling: hearing a word, then choosing the right spelling or building it letter by letter.",
      why: "Children hear each word read aloud before they spell it, so they link sound to spelling instead of copying. Believable wrong spellings train them to check every letter, and the tiles or keyboard turn a spelling test into something to play.",
      opts: ["words", "style", "keyboard", "focus", "count", "hints", "voice"] },
    { key: "phonics", kind: "Learn", title: "Phonics Fun / Word Patterns", sub: "Sounds, letters, prefixes and suffixes", badge: "ai", color: "#FF9F43",
      practises: "Phonics for younger years (digraphs, vowel sounds); prefixes and suffixes for older years.",
      why: "Short, repeated practice of one sound at a time builds automatic decoding. Pick focus sounds to match this week's phonics lesson.",
      opts: ["focus", "count", "hints", "voice"] },
    { key: "homophones", kind: "Learn", title: "Sound-Alikes", sub: "Words that sound the same", badge: "sea\nsee", color: "#FF6B6B",
      practises: "Homophones in context: there/their/they're, to/too/two, sea/see and many more.",
      why: "Each word is shown in a real sentence, so children choose by meaning rather than guessing. A tip after every answer explains the difference.",
      opts: ["count", "hints", "voice"] },
    { key: "tenses", kind: "Learn", title: "Time Travel", sub: "Past, present and verb forms", badge: "-ed", color: "#38B6FF",
      practises: "Past and present tense, regular -ed endings, irregular verbs and, for older years, perfect and progressive forms.",
      why: "Children see verbs inside sentences and decide when they happen, which builds the grammar awareness that writing assessments look for.",
      opts: ["count", "hints", "voice"] },
    { key: "sentences", kind: "Learn", title: "Sentence Maker", sub: "Put the words in order", badge: "A..", color: "#1FB8A8",
      practises: "Word order, capital letters and full stops by rebuilding jumbled sentences.",
      why: "Rebuilding sentences makes sentence structure visible and helps children who find it hard to get ideas down in the right order.",
      opts: ["count", "voice"] },
    { key: "mix", kind: "Learn", title: "Mix It Up!", sub: "A bit of everything", badge: "?!", color: "#2FCB8A",
      practises: "A mixed round of homophones, tenses, spelling, phonics and sentences.",
      why: "Mixed (interleaved) practice helps learning stick better than one topic at a time. Good for revision and starters.",
      opts: ["count", "hints", "voice"] },
    { key: "pop", kind: "Game", title: "Balloon Pop", sub: "Pop the right words", badge: "pop!", color: "#FF6FB5",
      practises: "Sorting words into two groups at speed: only pop the balloons that match the sign.",
      why: "Quick decisions build fluency and attention. Wrong pops cost points, so children learn to read before they tap.",
      opts: ["sets", "groups", "voice"] },
    { key: "catch", kind: "Game", title: "Fish Catch", sub: "Steer Whiskers to catch words", badge: "<·>", color: "#2E86DE",
      practises: "Spotting words from one group as they fall, and steering away from the rest.",
      why: "A movement game that still needs careful reading. Great for children who need to move while they learn.",
      opts: ["sets", "groups", "voice"] },
    { key: "sort", kind: "Game", title: "Sort Box", sub: "Swipe words into the right box", badge: "A|B", color: "#7C5CFF",
      practises: "Sorting words into two groups, at the child's own pace.",
      why: "Calm, untimed sorting lets children think through each word, and mistakes can be tried again straight away.",
      opts: ["sets", "groups", "voice"] },
    { key: "match", kind: "Game", title: "Match Pairs", sub: "Flip cards and find pairs", badge: "==", color: "#D35DE8",
      practises: "Matching pairs: opposites, plurals, contractions, homophones, adverbs, or your own pairs.",
      why: "A memory game that rewards noticing how words relate to each other. Use your own pairs for topic vocabulary.",
      opts: ["pairs", "voice"] },
    { key: "sounds", kind: "Game", title: "Sound Buttons", sub: "Tap, sound out, blend!", badge: "s-a-t", color: "#FF7A59",
      practises: "Segmenting and blending: tap the sounds in a word in order, then blend them.",
      why: "Sound buttons are how many phonics schemes teach blending. The app says each pure sound, not the letter name.",
      opts: ["sounds", "voice"] },
    { key: "tilt", kind: "Game", title: "Tilt Roll", sub: "Tilt your device to roll", badge: "↻", color: "#00A896",
      practises: "Multiple-choice grammar and spelling questions, answered by tilting to roll a ball of wool.",
      why: "Physical, playful and good for fine motor control. Children can drag instead of tilting.",
      opts: ["voice"] },
  ];

  // ---- Task link ----
  const base = "https://whiskerswordquest.app/play/#";

  function encode(task) {
    const bytes = new TextEncoder().encode(JSON.stringify(task));
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decode(payload) {
    try {
      let b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      b64 += "=".repeat((4 - (b64.length % 4)) % 4);
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const t = JSON.parse(new TextDecoder().decode(bytes));
      return t && typeof t.g === "string" && games.some((g) => g.key === t.g) ? t : null;
    } catch { return null; }
  }

  function cleanWords(raw) {
    const seen = new Set();
    return raw.split(/[^\p{L}'’-]+/u)
      .map((w) => w.replace(/^['’-]+|['’-]+$/g, "").toLowerCase())
      .filter((w) => w.length >= 2 && w.length <= 20 && !seen.has(w) && seen.add(w));
  }

  // A plain-English summary of a task, for the card, image, PDF and play page.
  function describe(t) {
    const g = games.find((x) => x.key === t.g);
    const e = englishes.find((x) => x.id === t.e) || englishes[0];
    const D = window.WWQ_DATA || { sorts: {}, pairs: {} };
    const lines = [];
    if (t.y) lines.push(["Year group", e.years[t.y - 1] + " · " + e.name]);
    else lines.push(["English", e.name]);
    if (t.w) lines.push(["Words", t.w.join(", ")]);
    if (t.q) lines.push(["Questions", t.q === "spell" ? "Spell the word" : "Pick the right spelling"]);
    if (t.g === "spelling" && (!t.q || t.q === "spell")) lines.push(["Keyboard", t.k === "keys" ? "Whole keyboard" : "Restricted (letter tiles)"]);
    if (t.f && t.f.length) lines.push([t.g === "sounds" ? "Sounds" : "Focus sounds", t.f.join(", ")]);
    if (t.c) lines.push(["Groups", `${t.c.a}: ${t.c.aw.join(", ")} / ${t.c.b}: ${t.c.bw.join(", ")}`]);
    if (t.p) lines.push(["Pairs", t.p.map((p) => p.join(" = ")).join(", ")]);
    if (t.s && t.s.length) lines.push(["Sets", t.s.map((id) => { const s = D.sorts[id]; const p = D.pairs[id]; return s ? `${s.title} (${s.a} / ${s.b})` : p ? p.title : id; }).join("; ")]);
    if (t.n) lines.push(["Questions in the round", String(t.n)]);
    if (t.h === false) lines.push(["Hints", "Off"]);
    if (t.r !== undefined) lines.push(["Read aloud", t.r ? "On" : "Off"]);
    return { game: g, english: e, lines };
  }

  window.WWQ = { englishes, focus, games, base, encode, decode, cleanWords, describe };
})();
