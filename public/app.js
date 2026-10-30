// 星詠 — AI占いエージェント フロントエンド（チャット制御）
(() => {
  const chat = document.getElementById('chat');
  const form = document.getElementById('composer');
  const input = document.getElementById('input');
  const sendBtn = document.getElementById('send');
  const quick = document.getElementById('quick');

  let DIVS = [];
  const state = { stage: 'idle', div: null, fields: [], idx: 0, answers: {} };

  // ---------- 星空 ----------
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  let stars = [];
  function initStars() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round(innerWidth * innerHeight / 7000) }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      r: Math.random() * 1.3 + 0.2, a: Math.random(), s: Math.random() * 0.02 + 0.004,
    }));
  }
  function drawStars() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const st of stars) {
      st.a += st.s; const o = (Math.sin(st.a) + 1) / 2;
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7);
      ctx.fillStyle = `rgba(231,201,139,${0.15 + o * 0.6})`; ctx.fill();
    }
    requestAnimationFrame(drawStars);
  }
  initStars(); drawStars();
  addEventListener('resize', initStars);

  // ---------- メッセージ描画 ----------
  function scroll() { chat.scrollTop = chat.scrollHeight; }
  function bubble(role, html) {
    const m = document.createElement('div');
    m.className = `msg ${role}`;
    m.innerHTML = `<div class="avatar">${role === 'bot' ? '☾' : '🙂'}</div><div class="bubble">${html}</div>`;
    chat.appendChild(m); scroll(); return m;
  }
  function typing() {
    const m = document.createElement('div');
    m.className = 'msg bot'; m.dataset.typing = '1';
    m.innerHTML = `<div class="avatar">☾</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
    chat.appendChild(m); scroll(); return m;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function botSay(html, delay = 500) {
    const t = typing(); await wait(delay); t.remove(); return bubble('bot', html);
  }
  function setQuick(items) {
    quick.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (it.ghost ? ' ghost' : '');
      b.textContent = it.label; b.onclick = () => it.onClick();
      quick.appendChild(b);
    }
  }
  function clearQuick() { quick.innerHTML = ''; }

  // ---------- 会話フロー ----------
  async function start() {
    try {
      const r = await fetch('/api/divinations'); DIVS = (await r.json()).divinations;
    } catch { DIVS = []; }
    await botSay('ようこそ、星詠へ。🌙<br>わたしがあなたの運命をお読みします。<br>まずは占いたいものを選んでください。', 300);
    showPicker();
  }

  function showPicker() {
    state.stage = 'picking'; clearQuick();
    const wrap = document.createElement('div');
    wrap.className = 'msg bot';
    const cards = DIVS.map((d) =>
      `<button class="pick" data-key="${d.key}"><span class="ic">${d.icon}</span>
        <span><span class="ttl">${esc(d.ja)}</span><span class="tag">${esc(d.tagline)}</span></span></button>`
    ).join('');
    wrap.innerHTML = `<div class="avatar">☾</div><div class="bubble" style="width:100%"><div class="picker">${cards}</div></div>`;
    chat.appendChild(wrap); scroll();
    wrap.querySelectorAll('.pick').forEach((b) => b.onclick = () => chooseDivination(b.dataset.key));
  }

  async function chooseDivination(key) {
    const d = DIVS.find((x) => x.key === key); if (!d) return;
    state.div = d; state.fields = d.fields; state.idx = 0; state.answers = {}; state.stage = 'collecting';
    bubble('user', esc(d.ja));
    await botSay(`承知しました。<b>${esc(d.ja)}</b>で占います。<br>いくつか教えてくださいね。`, 500);
    askNext();
  }

  async function askNext() {
    if (state.idx >= state.fields.length) return runReading();
    const f = state.fields[state.idx];
    let msg = `<b>${esc(f.label)}</b>を教えてください。`;
    if (f.help) msg += `<br><span style="color:var(--muted);font-size:13px">${esc(f.help)}</span>`;
    await botSay(msg, 450);

    if (f.type === 'select') {
      input.disabled = true; input.placeholder = '下から選んでください';
      setQuick(f.options.map((o) => ({
        label: o.label, onClick: () => { input.disabled = false; input.placeholder = 'メッセージを入力…'; answerField(o.value, o.label); },
      })));
    } else {
      input.disabled = false; input.placeholder = f.help ? f.help.replace(/^例）/, '例: ') : 'メッセージを入力…';
      if (!f.required) {
        setQuick([{ label: '不明 / スキップ', ghost: true, onClick: () => answerField('不明', '不明') }]);
      } else clearQuick();
      input.focus();
    }
  }

  function validate(f, raw) {
    const v = raw.trim();
    if (!v && f.required) return { ok: false, err: 'こちらは必須です。もう一度入力してください。' };
    if (f.type === 'date') {
      if (!/\d{4}\D+\d{1,2}\D+\d{1,2}/.test(v)) return { ok: false, err: '「1990/5/15」のような形式で入力してください。' };
    }
    return { ok: true, value: v };
  }

  async function answerField(value, display) {
    const f = state.fields[state.idx];
    if (display === undefined) {
      const res = validate(f, value);
      if (!res.ok) { bubble('user', esc(value)); await botSay(res.err, 400); return; }
      value = res.value;
    }
    bubble('user', esc(display ?? value));
    state.answers[f.key] = value;
    state.idx++; clearQuick();
    askNext();
  }

  async function runReading() {
    state.stage = 'reading';
    input.disabled = true; input.placeholder = '鑑定中…'; clearQuick();
    const t = typing();
    await botSay('', 0).then((m) => m.remove()).catch(() => {});
    try {
      const r = await fetch('/api/reading', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ divination: state.div.key, answers: state.answers }),
      });
      const data = await r.json();
      t.remove();
      if (!r.ok || data.error) { await botSay(`うまく鑑定できませんでした。${esc(data.error || '')}<br>もう一度お試しください。`); offerRestart(); return; }
      renderResult(data);
    } catch (e) {
      t.remove(); await botSay('通信に失敗しました。少し時間をおいて再度お試しください。');
    }
    offerRestart();
  }

  function renderResult(data) {
    const panel = renderData(data);
    const wrap = document.createElement('div');
    wrap.className = 'msg bot';
    wrap.innerHTML = `<div class="avatar">☾</div><div class="bubble" style="width:100%;padding:0;background:transparent;border:none;box-shadow:none">
      <div class="result">
        <div class="rhead">${esc(data.title)}の鑑定</div>
        ${panel}
        <div class="rbody">${formatReading(data.reading)}</div>
        <div class="disc">${esc(data.disclaimer)}</div>
      </div></div>`;
    chat.appendChild(wrap); scroll();
  }

  function formatReading(txt) {
    return esc(txt)
      .replace(/^[\s　]*[①-⑩0-9]+[．.、]?\s*(.+)$/gm, (m, p1) => (/[：:]/.test(m) || m.length < 30) && /^[\s　]*[①-⑩]/.test(m) ? `<h4>${p1}</h4>` : m)
      .replace(/【(.+?)】/g, '<h4>$1</h4>');
  }

  function cell(b, v) { return `<div class="data-cell"><b>${esc(b)}</b>${esc(v)}</div>`; }

  function renderData(data) {
    const d = data.data;
    if (data.divination === 'fourpillars') {
      const tg = d.tenGods || {};
      const ps = [['年柱', d.year, tg.year], ['月柱', d.month, tg.month], ['日柱', d.day, '日主']];
      if (d.hour) ps.push(['時柱', d.hour, tg.hour]);
      const pillars = ps.map(([lbl, p, god]) =>
        `<div class="pillar"><div class="lbl">${lbl}</div><div class="kanshi">${esc(p.kanshi)}</div><div class="el">${esc(p.element)}</div>${god ? `<div class="god">${esc(god)}</div>` : ''}</div>`
      ).join('');
      const b = d.elementBalance || {};
      const bal = ['木', '火', '土', '金', '水'].map((e) =>
        `<span class="bchip${(b[e] || 0) === 0 ? ' zero' : ''}">${e}${b[e] || 0}</span>`
      ).join('');
      const str = d.dayMasterStrength ? d.dayMasterStrength.label : '';
      return `<div class="rbody" style="border-bottom:1px solid var(--line)">
        <h4 style="margin-top:0">命式</h4><div class="pillars">${pillars}</div>
        <div class="balance">五行バランス ${bal}</div>
        <div style="margin-top:6px;font-size:12.5px;color:var(--muted)">日主（あなたの核）：<b style="color:var(--gold)">${esc(d.dayMaster.stem)}（${esc(d.dayMaster.element)}）</b>　${esc(str)}</div>
      </div>`;
    }
    if (data.divination === 'astrology') {
      const main = d.planets.slice(0, 3).map((p) => cell(p.ja, p.position)).join('');
      const ang = (d.ascendant ? cell('アセンダント', d.ascendant.label) : '') + (d.mc ? cell('MC', d.mc.label) : '');
      const rest = d.planets.slice(3).map((p) => cell(p.ja, p.position + (p.retrograde ? ' ℞' : ''))).join('');
      return `<div class="rbody" style="border-bottom:1px solid var(--line)">
        <h4 style="margin-top:0">ホロスコープ</h4><div class="data-grid">${main}${ang}${rest}</div>
        ${d.notice ? `<div style="font-size:12px;color:var(--muted);margin-top:6px">${esc(d.notice)}</div>` : ''}
      </div>`;
    }
    if (data.divination === 'tarot') {
      const cards = d.cards.map((c) =>
        `<div class="tcard"><div class="pos">${esc(c.position)}</div><div class="nm">${esc(c.name)}</div>
          <div class="or">${esc(c.orientation)}</div><div class="kw">${esc(c.keywords.join('・'))}</div></div>`
      ).join('');
      return `<div class="rbody" style="border-bottom:1px solid var(--line)">
        <h4 style="margin-top:0">${esc(d.spread)}</h4><div class="cards">${cards}</div></div>`;
    }
    return '';
  }

  function offerRestart() {
    state.stage = 'done'; input.disabled = true; input.placeholder = 'もう一度占う場合は下のボタンから';
    setQuick([{ label: '🔮 もう一度占う', onClick: () => { clearQuick(); showPicker(); } }]);
  }

  // ---------- 入力送信 ----------
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    if (!v.trim() || input.disabled) return;
    input.value = '';
    if (state.stage === 'collecting') answerField(v);
  });

  start();
})();
