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

  /* —— How-to —— */
  const howtoEl = $("#howto-steps");
  howtoEl.innerHTML = data.howto.steps
    .map(
      (s) =>
        `<li><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`
    )
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
    const y = window.scrollY + 70;
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

  /* —— Hooks —— */
  const hookCat = $("#hook-cat");
  data.hooks.forEach((c, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = c.name;
    hookCat.appendChild(opt);
  });

  const renderHooks = () => {
    const q = ($("#hook-search").value || "").trim().toLowerCase();
    const catIdx = hookCat.value;
    const wrap = $("#hooks-list");
    const cats =
      catIdx === ""
        ? data.hooks.map((c, i) => ({ ...c, _i: i }))
        : [{ ...data.hooks[Number(catIdx)], _i: Number(catIdx) }];

    let html = "";
    let shown = 0;
    for (const cat of cats) {
      const items = cat.items
        .map((text, n) => ({ text, n: n + 1 }))
        .filter((it) => !q || it.text.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q));
      if (!items.length) continue;
      html += `<div class="cat-label">${esc(cat.name)}</div>`;
      if (cat.why) html += `<p class="cat-why">${esc(cat.why)}</p>`;
      for (const it of items) {
        html += `<div class="hook-line"><span class="num">${it.n}.</span>${esc(it.text)}</div>`;
        shown++;
      }
    }
    wrap.innerHTML = html || `<p class="empty">No hooks match.</p>`;
  };
  $("#hook-search").addEventListener("input", renderHooks);
  hookCat.addEventListener("change", renderHooks);
  renderHooks();

  /* —— Scripts —— */
  const scriptCat = $("#script-cat");
  data.scripts.forEach((c, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = c.name;
    scriptCat.appendChild(opt);
  });

  const renderScripts = () => {
    const q = ($("#script-search").value || "").trim().toLowerCase();
    const catIdx = scriptCat.value;
    const wrap = $("#scripts-list");
    const cats =
      catIdx === ""
        ? data.scripts.map((c, i) => ({ ...c, _i: i }))
        : [{ ...data.scripts[Number(catIdx)], _i: Number(catIdx) }];

    let html = "";
    let shown = 0;
    for (const cat of cats) {
      const scripts = cat.scripts.filter((s) => {
        if (!q) return true;
        const blob = `${s.title} ${s.text} ${cat.name}`.toLowerCase();
        return blob.includes(q);
      });
      if (!scripts.length) continue;
      html += `<div class="cat-label">${esc(cat.name)}</div>`;
      for (const s of scripts) {
        html += `<article class="item">
          <div class="item-meta"><span>${esc(cat.name)} · #${s.n}</span>${
            s.duration ? `<span class="dur">${esc(s.duration)}</span>` : ""
          }</div>
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.text)}</p>
        </article>`;
        shown++;
      }
    }
    $("#script-count").textContent = `${shown} of ${data.scriptCount} scripts`;
    wrap.innerHTML = html || `<p class="empty">No scripts match.</p>`;
  };
  $("#script-search").addEventListener("input", renderScripts);
  scriptCat.addEventListener("change", renderScripts);
  renderScripts();

  /* —— Cue sheet —— */
  const renderCue = () => {
    const q = ($("#cue-search").value || "").trim().toLowerCase();
    const wrap = $("#cue-list");
    const reels = data.cue.reels.filter((r) => {
      if (!q) return true;
      const blob = `${r.title} ${r.handle} ${r.listen} ${(r.say || []).join(" ")}`.toLowerCase();
      return blob.includes(q);
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
  $("#cue-search").addEventListener("input", renderCue);
  renderCue();

  /* —— Transcripts —— */
  const renderTranscripts = () => {
    const q = ($("#transcript-search").value || "").trim().toLowerCase();
    const wrap = $("#transcripts-list");
    const items = data.transcripts.filter((t) => {
      if (!q) return true;
      const blob = `${t.id} ${t.handle} ${t.uploader} ${t.text}`.toLowerCase();
      return blob.includes(q);
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
  $("#transcript-search").addEventListener("input", renderTranscripts);
  renderTranscripts();
}();
