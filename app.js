(() => {
  const data = window.REEL_KIT_DATA;
  if (!data) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<p style="padding:2rem;color:#f88">Missing data.js — run build_data.py</p>'
    );
    return;
  }

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’‘ʻʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[—–−]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

  const matchesQuery = (blob, q) => {
    if (!q) return true;
    const hay = norm(blob);
    const needle = norm(q);
    if (!needle) return true;
    if (hay.includes(needle)) return true;
    // Multi-word: every token must appear (order-free)
    const parts = needle.split(" ").filter(Boolean);
    return parts.length > 1 && parts.every((p) => hay.includes(p));
  };

  const shortPattern = (name) =>
    String(name || "")
      .replace(/^\d+\.\s*/, "")
      .replace(/\s+/g, " ")
      .trim();

  const debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  /* —— How-to —— */
  const howtoEl = $("#howto-steps");
  howtoEl.innerHTML = data.howto.steps
    .map((s) => `<li><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`)
    .join("");
  $("#howto-note").textContent = data.howto.cue;
  const voice = data.voiceFilmPlayer;
  const voiceEl = $("#voice-link");
  if (voice && voice.available) {
    voiceEl.hidden = false;
    voiceEl.innerHTML = `${esc(data.howto.voice)} <a href="#cue">${esc(voice.label)}</a> — keep this kit open in Safari; voice player lives beside it when published.`;
  } else if (voice) {
    voiceEl.hidden = false;
    voiceEl.textContent = `${data.howto.voice} (${voice.relativeHint})`;
  }

  /* —— Sticky nav active —— */
  const navLinks = [...document.querySelectorAll(".sticky-nav a")];
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  const setActive = () => {
    const y = window.scrollY + 90;
    let current = sections[0];
    for (const sec of sections) {
      if (sec.offsetTop <= y) current = sec;
    }
    navLinks.forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("href") === `#${current.id}`);
    });
  };
  window.addEventListener("scroll", setActive, { passive: true });
  setActive();

  /* —— Pattern picker —— */
  const patternPick = $("#pattern-pick");
  data.hooks.forEach((c, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${i + 1}. ${shortPattern(c.name)}`;
    patternPick.appendChild(opt);
  });

  const searchInput = $("#global-search");
  const statusEl = $("#find-status");
  let didAutoScroll = false;

  const renderHooksAndScripts = (opts = {}) => {
    const q = (searchInput.value || "").trim();
    const catIdx = patternPick.value;
    const catFilter =
      catIdx === ""
        ? null
        : Number(catIdx);

    let hookShown = 0;
    let scriptShown = 0;
    let hooksHtml = "";
    let scriptsHtml = "";

    const cats =
      catFilter == null
        ? data.hooks.map((_, i) => i)
        : [catFilter];

    for (const i of cats) {
      const hookCat = data.hooks[i];
      const scriptCat = data.scripts[i];
      if (!hookCat || !scriptCat) continue;

      const groupName = hookCat.name;
      const groupBlob = `${groupName} ${shortPattern(groupName)} ${hookCat.why || ""}`;

      const hookItems = hookCat.items
        .map((text, n) => ({ text, n: n + 1 }))
        .filter((it) => matchesQuery(`${it.text} ${groupBlob}`, q));

      const scripts = scriptCat.scripts.filter((s) =>
        matchesQuery(`${s.title} ${s.text} ${groupBlob}`, q)
      );

      if (hookItems.length) {
        hooksHtml += `<div class="cat-label" data-pattern="${i}">${esc(shortPattern(groupName))}</div>`;
        if (hookCat.why) hooksHtml += `<p class="cat-why">${esc(hookCat.why)}</p>`;
        for (const it of hookItems) {
          hooksHtml += `<div class="hook-line"><span class="num">${it.n}.</span>${esc(it.text)}</div>`;
          hookShown++;
        }
      }

      if (scripts.length) {
        scriptsHtml += `<div class="cat-label" data-pattern="${i}">${esc(shortPattern(groupName))}</div>`;
        for (const s of scripts) {
          scriptsHtml += `<article class="item">
          <div class="item-meta"><span>${esc(shortPattern(groupName))} · #${s.n}</span>${
            s.duration ? `<span class="dur">${esc(s.duration)}</span>` : ""
          }</div>
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.text)}</p>
        </article>`;
          scriptShown++;
        }
      }
    }

    $("#hooks-list").innerHTML =
      hooksHtml || `<p class="empty">No hooks match “${esc(q) || "this filter"}”.</p>`;
    $("#scripts-list").innerHTML =
      scriptsHtml || `<p class="empty">No scripts match “${esc(q) || "this filter"}”.</p>`;

    $("#hook-count").textContent = q || catFilter != null
      ? `${hookShown} hook${hookShown === 1 ? "" : "s"} shown`
      : `${data.hookCount} hooks · 12 patterns`;
    $("#script-count").textContent = q || catFilter != null
      ? `${scriptShown} of ${data.scriptCount} scripts`
      : `${data.scriptCount} scripts · 12 patterns`;

    if (q) {
      statusEl.textContent = `${hookShown} hooks · ${scriptShown} scripts match “${q}”`;
    } else if (catFilter != null) {
      const name = shortPattern(data.hooks[catFilter].name);
      statusEl.textContent = `Showing pattern ${catFilter + 1}: ${name}`;
    } else {
      statusEl.textContent = "Browse a pattern group, or type a topic to filter both lists.";
    }

    if (opts.scroll && (q || catFilter != null) && (hookShown > 0 || scriptShown > 0)) {
      const target = hookShown > 0 ? $("#hooks") : $("#scripts");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      didAutoScroll = true;
    }
  };

  const onSearchInput = debounce(() => {
    renderHooksAndScripts({ scroll: true });
  }, 180);

  searchInput.addEventListener("input", onSearchInput);
  searchInput.addEventListener("search", () => {
    // Safari clear (x) fires search event
    renderHooksAndScripts({ scroll: false });
  });
  patternPick.addEventListener("change", () => {
    renderHooksAndScripts({ scroll: true });
  });

  renderHooksAndScripts();

  /* —— Cue sheet —— */
  const renderCue = () => {
    const q = ($("#cue-search").value || "").trim();
    const wrap = $("#cue-list");
    const reels = data.cue.reels.filter((r) => {
      if (!q) return true;
      return matchesQuery(
        `${r.title} ${r.handle} ${r.listen} ${(r.say || []).join(" ")}`,
        q
      );
    });
    wrap.innerHTML =
      reels
        .map(
          (r) => `<article class="item">
        <div class="item-meta">
          <span>Reel ${esc(r.n)}</span>
          ${r.duration ? `<span class="dur">${esc(r.duration)}</span>` : ""}
          ${r.handle ? `<span>${esc(r.handle)}</span>` : ""}
        </div>
        <h3>${esc(r.title)}</h3>
        ${r.source ? `<p style="margin-bottom:.6rem"><a href="${esc(r.source)}" style="color:var(--accent);word-break:break-all">${esc(r.source)}</a></p>` : ""}
        <p><strong style="color:var(--ink)">Listen</strong></p>
        <p>${esc(r.listen)}</p>
        ${
          r.say && r.say.length
            ? `<ul class="say">${r.say.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
            : ""
        }
      </article>`
        )
        .join("") || `<p class="empty">No cue reels match.</p>`;
  };
  $("#cue-search").addEventListener(
    "input",
    debounce(renderCue, 180)
  );
  renderCue();

  /* —— Transcripts —— */
  const renderTranscripts = () => {
    const q = ($("#transcript-search").value || "").trim();
    const wrap = $("#transcripts-list");
    const items = data.transcripts.filter((t) => {
      if (!q) return true;
      return matchesQuery(`${t.id} ${t.handle} ${t.uploader} ${t.text}`, q);
    });
    wrap.innerHTML =
      items
        .map(
          (t) => `<article class="item">
        <div class="item-meta">
          <span>${esc(t.n)}. ${esc(t.id)}</span>
          ${t.duration ? `<span class="dur">${esc(t.duration)}</span>` : ""}
          ${t.handle ? `<span>${esc(t.handle)}</span>` : ""}
          ${t.newer ? `<span class="dur">new</span>` : ""}
        </div>
        <h3>${esc(t.uploader || t.id)}</h3>
        ${t.source ? `<p style="margin-bottom:.6rem"><a href="${esc(t.source)}" style="color:var(--accent);word-break:break-all">${esc(t.source)}</a></p>` : ""}
        <p>${esc(t.text)}</p>
      </article>`
        )
        .join("") || `<p class="empty">No transcripts match.</p>`;
  };
  $("#transcript-search").addEventListener(
    "input",
    debounce(renderTranscripts, 180)
  );
  renderTranscripts();

  // Avoid unused lint in older tooling
  void didAutoScroll;
})();
