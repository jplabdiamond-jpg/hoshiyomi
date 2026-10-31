// Sibylla Vision — AI鑑定 フロントエンド（チャット制御）
(() => {
  const SIGIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1"><path d="M2.5 12C5.3 8.3 8.4 6.7 12 6.7S18.7 8.3 21.5 12C18.7 15.7 15.6 17.3 12 17.3S5.3 15.7 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/><path d="M12 9.3l.6 2.1 2.1.6-2.1.6-.6 2.1-.6-2.1-2.1-.6 2.1-.6z" fill="currentColor" stroke="none"/></svg>`;
  const USERMARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>`;
  const ICONS = {
    astrology: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="4.3"/><g stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/></g></svg>`,
    fourpillars: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3.5" y="3.5" width="17" height="17" rx="1"/><path d="M9 3.5v17M15 3.5v17"/></svg>`,
    tarot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3.5" y="6" width="8.5" height="12.5" rx="1" transform="rotate(-9 7.75 12.25)"/><rect x="11" y="5" width="8.5" height="12.5" rx="1" transform="rotate(9 15.25 11.25)"/></svg>`,
    seimei: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 7.5v9M8.5 11.5c1.6 0 3.5-1 3.5-4M15.5 11.5c-1.6 0-3.5-1-3.5-4" stroke-width="1"/></svg>`,
    numerology: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>`,
    comprehensive_plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1"><path d="M2.5 12C5.3 8.3 8.4 6.7 12 6.7S18.7 8.3 21.5 12C18.7 15.7 15.6 17.3 12 17.3S5.3 15.7 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/><path d="M12 9.3l.6 2.1 2.1.6-2.1.6-.6 2.1-.6-2.1-2.1-.6 2.1-.6z" fill="currentColor" stroke="none"/></svg>`,
  };
  // タロット裏面の紋章（太陽＋瞳＋星）
  const TAROT_BACK = `<svg viewBox="0 0 48 60" fill="none" stroke="currentColor" stroke-width="0.9" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="30" r="13.5" opacity=".5"/>
    <g opacity=".85">${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180;const x1=24+13.5*Math.cos(a),y1=30+13.5*Math.sin(a),x2=24+16.5*Math.cos(a),y2=30+16.5*Math.sin(a);return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke-linecap="round"/>`}).join('')}</g>
    <path d="M13 30C17 25.5 20.5 24 24 24C27.5 24 31 25.5 35 30C31 34.5 27.5 36 24 36C20.5 36 17 34.5 13 30Z"/>
    <circle cx="24" cy="30" r="3.4"/>
    <path d="M24 26.3l.8 2.9 2.9.8-2.9.8-.8 2.9-.8-2.9-2.9-.8 2.9-.8z" fill="currentColor" stroke="none"/>
  </svg>`;

  const ROMAN = ['0','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'];
  const SUIT_KEY = { 'ワンド': 'wands', 'カップ': 'cups', 'ソード': 'swords', 'ペンタクル': 'pentacles' };
  // カードごとの画像ID（/cards/<id>.webp）。大=major-0〜21 / 小=<suit>-<rank-1>
  function cardImgId(c) {
    if (c.arcana === '大アルカナ') return typeof c.number === 'number' ? 'major-' + c.number : null;
    const k = SUIT_KEY[c.suit];
    return (k && typeof c.number === 'number') ? k + '-' + (c.number - 1) : null;
  }

  function cardBackHTML() {
    return `<div class="tz-face tz-back">${TAROT_BACK}<div class="corners"><i></i><i></i><i></i><i></i></div></div>`;
  }
  function cardFrontHTML(c) {
    const rev = c.orientation === '逆位置';
    const sub = c.arcana === '大アルカナ'
      ? (typeof c.number === 'number' && ROMAN[c.number] ? `大アルカナ · ${ROMAN[c.number]}` : '大アルカナ')
      : `${esc(c.suit || '')}${c.element ? ' · ' + esc(c.element) : ''}`;
    const kw = Array.isArray(c.keywords) && c.keywords.length ? esc(c.keywords.slice(0, 2).join('・')) : '';
    const art = (window.SVTarotArt && SVTarotArt.cardArt) ? SVTarotArt.cardArt(c) : '';
    const id = cardImgId(c);
    const img = id ? `<img class="tz-img" src="/cards/${id}.webp" alt="${esc(c.name)}">` : '';
    return `<div class="tz-face tz-front${rev ? ' is-rev' : ''}${img ? ' hasimg' : ''}">
      ${img}
      <div class="tz-svg">
        <div class="ar">${sub}</div>
        <div class="tz-art">${art}</div>
        <div class="nm">${esc(c.name)}</div>
        ${kw ? `<div class="kw">${kw}</div>` : ''}
        <div class="mo ${rev ? 'rev' : 'up'}">${rev ? '逆位置' : '正位置'}</div>
      </div>
    </div>`;
  }
  function flipCardHTML(c) {
    return `<div class="tz"><div class="flip">${cardBackHTML()}${c ? cardFrontHTML(c) : cardBackHTML()}</div></div>`;
  }

  const chat = document.getElementById('chat');
  const form = document.getElementById('composer');
  const input = document.getElementById('input');
  const sendBtn = document.getElementById('send');
  const quick = document.getElementById('quick');

  let DIVS = [];
  const state = { stage: 'idle', div: null, fields: [], idx: 0, answers: {} };
  const anonId = (() => {
    try {
      let v = localStorage.getItem('sv_anon');
      if (!v) { v = (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); localStorage.setItem('sv_anon', v); }
      return v;
    } catch { return null; }
  })();

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
    m.innerHTML = `<div class="avatar${role === 'bot' ? '' : ' u'}">${role === 'bot' ? SIGIL : USERMARK}</div><div class="bubble">${html}</div>`;
    chat.appendChild(m); scroll(); return m;
  }
  function typing() {
    const m = document.createElement('div');
    m.className = 'msg bot'; m.dataset.typing = '1';
    m.innerHTML = `<div class="avatar">${SIGIL}</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
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
    const params = new URLSearchParams(location.search);
    const paid = params.get('paid');
    const canceled = params.get('canceled');
    // URLのクエリを消す（二重実行防止）
    if (paid || canceled) history.replaceState({}, '', location.pathname);
    if (paid) {
      await botSay('Sibylla Vision へお帰りなさい。', 300);
      await runPaidReading(paid);
      return;
    }
    await botSay('Sibylla Vision へようこそ。<br>星の配置・生まれ持った命式に、統計と風水を重ねて、これからの流れをお読みします。<br>まずは占いたいものをお選びください。', 300);
    if (canceled) await botSay('お支払いはキャンセルされました。いつでもまたどうぞ。', 300);
    showPicker();
  }

  function showPicker() {
    state.stage = 'picking'; clearQuick();
    const wrap = document.createElement('div');
    wrap.className = 'msg bot';
    const cards = DIVS.map((d) =>
      `<button class="pick" data-key="${d.key}"><span class="ic">${ICONS[d.key] || ''}</span>
        <span><span class="ttl">${esc(d.ja)}${d.price ? `<em class="price">¥${d.price.toLocaleString()}</em>` : ''}</span><span class="tag">${esc(d.tagline)}</span></span></button>`
    ).join('');
    wrap.innerHTML = `<div class="avatar">${SIGIL}</div><div class="bubble" style="width:100%"><div class="picker">${cards}</div></div>`;
    chat.appendChild(wrap); scroll();
    wrap.querySelectorAll('.pick').forEach((b) => b.onclick = () => chooseDivination(b.dataset.key));
  }

  async function chooseDivination(key) {
    const d = DIVS.find((x) => x.key === key); if (!d) return;
    state.div = d; state.fields = d.fields; state.idx = 0; state.answers = {}; state.stage = 'collecting';
    bubble('user', esc(d.ja));
    await botSay(`承知しました。<b>${esc(d.ja)}</b>で占います。<br>いくつか教えてくださいね。`, 500);
    if (d.privacyNote) await botSay(`<span style="font-size:13px;color:var(--muted)">🔒 ${esc(d.privacyNote)}</span>`, 400);
    askNext();
  }

  async function askNext() {
    if (state.idx >= state.fields.length) return runReading();
    const f = state.fields[state.idx];
    let msg = `<b>${esc(f.label)}</b>を教えてください。`;
    if (f.help) msg += `<br><span style="color:var(--muted);font-size:13px">${esc(f.help)}</span>`;
    await botSay(msg, 450);

    if (f.type === 'select' && f.options.some((o) => o.desc)) {
      // 説明つきの選択肢（スプレッドなど）はカード形式で提示
      input.disabled = true; input.placeholder = '下から選んでください'; clearQuick();
      const wrap = document.createElement('div');
      wrap.className = 'msg bot';
      const opts = f.options.map((o) =>
        `<button class="opt" data-value="${esc(o.value)}" data-label="${esc(o.label)}">
          <span class="opt-ttl">${esc(o.label)}</span>
          ${o.desc ? `<span class="opt-desc">${esc(o.desc)}</span>` : ''}</button>`
      ).join('');
      wrap.innerHTML = `<div class="avatar">${SIGIL}</div><div class="bubble" style="width:100%"><div class="optlist">${opts}</div></div>`;
      chat.appendChild(wrap); scroll();
      const list = wrap.querySelector('.optlist');
      list.querySelectorAll('.opt').forEach((b) => b.onclick = () => {
        if (list.classList.contains('chosen')) return;
        list.classList.add('chosen'); b.classList.add('sel');
        input.disabled = false; input.placeholder = 'メッセージを入力…';
        answerField(b.dataset.value, b.dataset.label);
      });
    } else if (f.type === 'select') {
      input.disabled = true; input.placeholder = '下から選んでください';
      const chips = f.options.map((o) => ({
        label: o.label, onClick: () => { input.disabled = false; input.placeholder = 'メッセージを入力…'; answerField(o.value, o.label); },
      }));
      if (!f.required) chips.push({ label: 'スキップ', ghost: true, onClick: () => { input.disabled = false; input.placeholder = 'メッセージを入力…'; answerField('', 'スキップ'); } });
      setQuick(chips);
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
    // 有料モードは決済へ
    if (state.div && state.div.price) return goCheckout();
    // タロットは演出（シャッフル→配布→めくり）を挟む
    if (state.div && state.div.key === 'tarot') return runTarotReading();
    state.stage = 'reading';
    input.disabled = true; input.placeholder = '鑑定中…'; clearQuick();
    const t = typing();
    await botSay('', 0).then((m) => m.remove()).catch(() => {});
    try {
      const r = await fetch('/api/reading', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ divination: state.div.key, answers: state.answers, anonId }),
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

  // ---------- タロット演出 ----------
  const SPREAD_COUNT = { one: 1, three: 3, celtic: 10 };
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const MAGIC_CIRCLE = `<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="94" stroke-width="0.8" opacity=".5"/>
    <circle cx="100" cy="100" r="82" stroke-width="0.6" opacity=".35"/>
    <circle cx="100" cy="100" r="60" stroke-width="0.8" opacity=".6"/>
    <g opacity=".7">${Array.from({ length: 24 }, (_, i) => { const a = i * 15 * Math.PI / 180; const x1 = 100 + 82 * Math.cos(a), y1 = 100 + 82 * Math.sin(a), x2 = 100 + 94 * Math.cos(a), y2 = 100 + 94 * Math.sin(a); return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke-width="0.7"/>`; }).join('')}</g>
    <path d="${(() => { let d = ''; for (let i = 0; i < 7; i++) { const a = (-90 + i * 360 * 3 / 7) * Math.PI / 180; const x = 100 + 60 * Math.cos(a), y = 100 + 60 * Math.sin(a); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); } return d + 'Z'; })()}" stroke-width="0.8" opacity=".8"/>
    <circle cx="100" cy="100" r="30" stroke-width="0.6" opacity=".5"/>
  </svg>`;

  // 裏返り時に、カードから光の粒子が弾け飛ぶ
  function sparkleBurst(slot) {
    const tz = slot.querySelector('.tz'); if (!tz) return;
    const burst = document.createElement('div'); burst.className = 'ts-spark-burst';
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 360 + (Math.random() * 24 - 12);
      const dist = 46 + Math.random() * 70;
      const s = document.createElement('i');
      s.style.setProperty('--tx', (Math.cos(a * Math.PI / 180) * dist).toFixed(1) + 'px');
      s.style.setProperty('--ty', (Math.sin(a * Math.PI / 180) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dl', (Math.random() * 0.12).toFixed(2) + 's');
      s.style.setProperty('--sz', (3 + Math.random() * 4).toFixed(1) + 'px');
      burst.appendChild(s);
    }
    tz.appendChild(burst);
    setTimeout(() => burst.remove(), 1300);
  }

  async function runTarotReading() {
    state.stage = 'reading';
    input.disabled = true; input.placeholder = '鑑定中…'; clearQuick();
    const spreadKey = state.answers.spread || 'one';
    const count = SPREAD_COUNT[spreadKey] || 1;

    const wrap = document.createElement('div');
    wrap.className = 'msg bot stagemsg';
    const backs = Array.from({ length: 6 }, (_, i) => `<div class="tz d${i}">${cardBackHTML()}</div>`).join('');
    const motes = Array.from({ length: 28 }, () => {
      const x = (Math.random() * 100).toFixed(1), d = (Math.random() * 5).toFixed(2), dur = (3.5 + Math.random() * 4).toFixed(2), sc = (0.5 + Math.random() * 1.3).toFixed(2);
      return `<i style="left:${x}%;--d:${d}s;--dur:${dur}s;--sc:${sc}"></i>`;
    }).join('');
    const sparks = Array.from({ length: 14 }, () => {
      const x = (Math.random() * 100).toFixed(1), y = (Math.random() * 100).toFixed(1), d = (Math.random() * 4).toFixed(2), dur = (1.8 + Math.random() * 2.2).toFixed(2), s = (9 + Math.random() * 9).toFixed(0);
      return `<b style="left:${x}%;top:${y}%;--d:${d}s;--dur:${dur}s;font-size:${s}px">✦</b>`;
    }).join('');
    wrap.innerHTML = `<div class="bubble" style="width:100%;padding:0;background:transparent;border:none;box-shadow:none">
        <div class="tarot-stage">
          <div class="ts-fx" aria-hidden="true"><div class="ts-rays"></div><div class="ts-circle">${MAGIC_CIRCLE}</div><div class="ts-motes">${motes}</div><div class="ts-sparks">${sparks}</div></div>
          <div class="ts-caption">星に問いを預けています…</div>
          <div class="ts-deck">${backs}</div>
          <div class="ts-spread" data-count="${count}" hidden></div>
        </div></div>`;
    chat.appendChild(wrap); scroll();
    const stage = wrap.querySelector('.tarot-stage');
    const caption = stage.querySelector('.ts-caption');
    const deck = stage.querySelector('.ts-deck');
    const spread = stage.querySelector('.ts-spread');
    const setCap = (t) => { caption.classList.add('swap'); setTimeout(() => { caption.textContent = t; caption.classList.remove('swap'); }, 220); };

    // 鑑定取得は演出と並行
    const fetchP = fetch('/api/reading', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ divination: 'tarot', answers: state.answers, anonId }),
    }).then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .catch(() => ({ ok: false, data: { error: '通信に失敗しました' } }));

    // シャッフル（結果が来るまで“止まらず”回し続ける）
    let data, ok;
    if (!reduceMotion) {
      deck.classList.add('shuffling');
      await wait(900);
      setCap('カードをきり、束ねています…');
      // 最低演出時間と取得完了の両方を待つ＝待機中も常に動く
      const res = (await Promise.all([fetchP, wait(2600)]))[0];
      ok = res.ok; data = res.data;
      deck.classList.remove('shuffling');
      deck.classList.add('gather');
      await wait(480);
    } else {
      const res = await fetchP; ok = res.ok; data = res.data; await wait(150);
    }

    if (!ok || !data || data.error) {
      stage.remove();
      await botSay(`うまく鑑定できませんでした。${esc((data && data.error) || '')}<br>もう一度お試しください。`);
      offerRestart(); return;
    }
    const cards = (data.data && data.data.cards) || [];

    // 束を舞い上げて消し、スロットを配る
    setCap('運命のカードを選び取ります…');
    deck.classList.add('out');
    await wait(reduceMotion ? 0 : 520);
    deck.hidden = true;
    spread.hidden = false;
    spread.innerHTML = cards.map((c) =>
      `<div class="ts-slot">${flipCardHTML(c)}<div class="ps">${esc(c.position)}</div></div>`
    ).join('');
    // 画像が無い札（未提供スート等）はSVG絵柄にフォールバック
    spread.querySelectorAll('.tz-img').forEach((im) => {
      im.addEventListener('error', () => {
        const face = im.closest('.tz-front');
        if (face) face.classList.remove('hasimg');
        im.remove();
      });
    });
    scroll();
    const slots = [...spread.querySelectorAll('.ts-slot')];
    for (let i = 0; i < slots.length; i++) {
      slots[i].classList.add('deal');
      if (!reduceMotion) await wait(count > 3 ? 85 : 150);
    }
    await wait(reduceMotion ? 0 : 520);

    // 1枚ずつ、光とともにめくる（ガチャ）
    setCap('✦ カードが開かれます ✦');
    for (let i = 0; i < slots.length; i++) {
      slots[i].classList.add('revealed', 'pop');
      if (!reduceMotion) setTimeout(() => sparkleBurst(slots[i]), 380);
      scroll();
      if (!reduceMotion) await wait(count > 3 ? 400 : 680);
    }
    await wait(reduceMotion ? 0 : 560);
    stage.classList.add('settled'); // エフェクトを静める
    caption.classList.add('hide');

    await wait(reduceMotion ? 0 : 420);
    renderResult(data);
    offerRestart();
  }

  async function goCheckout() {
    state.stage = 'reading';
    input.disabled = true; clearQuick();
    const price = state.div.price;
    await botSay(`総合鑑定は <b>¥${price.toLocaleString()}</b> の有料鑑定です。<br>お支払いページ（Stripe）に移動します…`, 500);
    const t = typing();
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: state.answers, anonId }),
      });
      const data = await r.json();
      t.remove();
      if (!r.ok || !data.url) {
        await botSay(`決済ページを開けませんでした。${esc(data.error || data.message || '')}`); offerRestart(); return;
      }
      sessionStorage.setItem('sv_pending', '1');
      location.href = data.url; // Stripe Checkout へ
    } catch {
      t.remove(); await botSay('決済サーバーに接続できませんでした。少し時間をおいて再度お試しください。'); offerRestart();
    }
  }

  // 決済成功後の戻り（?paid=<session>&order=...）で鑑定を実行
  async function runPaidReading(sessionId) {
    await botSay('お支払いありがとうございます。鑑定を進めます…🔮', 400);
    const t = typing();
    try {
      const r = await fetch('/api/reading', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ divination: 'comprehensive_plus', paidSession: sessionId, anonId }),
      });
      const data = await r.json();
      t.remove();
      if (!r.ok || data.error) {
        await botSay(`鑑定の実行でエラーが出ました。${esc(data.message || data.error || '')}<br>お手数ですがサポートへお知らせください。`);
        offerRestart(); return;
      }
      renderResult(data);
    } catch {
      t.remove(); await botSay('鑑定の取得に失敗しました。もう一度お試しください。');
    }
    offerRestart();
  }

  function renderResult(data) {
    const panel = renderData(data);
    const isTarot = data.divination === 'tarot';
    const wrap = document.createElement('div');
    wrap.className = 'msg bot';
    const readingBlock = isTarot
      ? `<div class="scroll-wrap"><div class="scroll-paper"><div class="scroll-grain" aria-hidden="true"></div><div class="rbody scroll-text">${formatReading(data.reading)}</div></div><div class="scroll-roll l" aria-hidden="true"></div><div class="scroll-roll r" aria-hidden="true"></div></div>`
      : `<div class="rbody">${formatReading(data.reading)}</div>`;
    wrap.innerHTML = `<div class="avatar">${SIGIL}</div><div class="bubble" style="width:100%;padding:0;background:transparent;border:none;box-shadow:none">
      <div class="result${isTarot ? ' tarot-result' : ''}">
        <div class="rhead">${esc(data.title)}の鑑定</div>
        ${panel}
        ${readingBlock}
        <div class="disc">${esc(data.disclaimer)}</div>
        ${data.readingId ? `<div class="fb" data-rid="${esc(data.readingId)}">
          <span class="fb-q">この鑑定はしっくりきましたか？</span>
          <button class="fb-btn" data-v="1">当たっている</button>
          <button class="fb-btn" data-v="0">ちがう</button>
        </div>` : ''}
      </div></div>`;
    chat.appendChild(wrap); scroll();
    const fb = wrap.querySelector('.fb');
    if (fb) wireFeedback(fb);
    // 古代紙の本文を1文字ずつ、ランダムな順に約2秒かけて炙り出す
    const scrollText = wrap.querySelector('.scroll-text');
    if (scrollText && !reduceMotion) scorchReveal(scrollText, 2500, 2000);
  }

  // テキストを1文字ずつ span 化し、ランダムな遅延で浮かび上がらせる
  function scorchReveal(root, startMs, spanMs) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue;
      if (!text || !text.trim()) continue;
      const frag = document.createDocumentFragment();
      for (const ch of text) {
        if (ch === ' ' || ch === '\n' || ch === '　' || ch === '\t') { frag.appendChild(document.createTextNode(ch)); continue; }
        const s = document.createElement('span');
        s.className = 'ch'; s.textContent = ch;
        s.style.animationDelay = Math.round(startMs + Math.random() * spanMs) + 'ms';
        frag.appendChild(s);
      }
      node.parentNode.replaceChild(frag, node);
    }
  }

  function wireFeedback(fb) {
    const rid = fb.dataset.rid;
    fb.querySelectorAll('.fb-btn').forEach((b) => b.onclick = async () => {
      const accurate = b.dataset.v === '1';
      fb.innerHTML = '<span class="fb-q">フィードバックありがとうございます。今後の精度向上に役立てます。</span>';
      try {
        await fetch('/api/feedback', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reading_id: rid, anon_id: anonId, accurate }),
        });
      } catch {}
    });
  }

  function formatReading(txt) {
    return esc(txt)
      .replace(/^[\s　]*[■◾▪◼]\s*(.+?)[\s　]*$/gm, '<h3 class="r-head">$1</h3>')
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
      // 大運タイムライン
      let dayun = '';
      if (d.daYun) {
        const items = d.daYun.pillars.map((p) =>
          `<div class="tl-item${p.note ? ' turn' : ''}"><span class="tl-age">${p.ageStart}〜${p.ageEnd}歳</span><span class="tl-k">${esc(p.kanshi)}</span><span class="tl-g">${esc(p.tenGod)}</span>${p.note ? `<span class="tl-note">${esc(p.note)}</span>` : ''}</div>`
        ).join('');
        dayun = `<h4>大運（10年ごとの運気）</h4><div class="timeline">${items}</div>`;
      }
      // 流年（注目年のみ強調）
      let liunian = '';
      if (d.liuNian) {
        const items = d.liuNian.map((y) =>
          `<div class="tl-item${y.note ? ' turn' : ''}"><span class="tl-age">${y.year}年</span><span class="tl-g">${esc(y.tenGod)}</span>${y.note ? `<span class="tl-note">${esc(y.note)}</span>` : ''}</div>`
        ).join('');
        liunian = `<h4>流年（今後の各年）</h4><div class="timeline">${items}</div>`;
      }
      return `<div class="rbody" style="border-bottom:1px solid var(--line)">
        <h4 style="margin-top:0">命式</h4><div class="pillars">${pillars}</div>
        <div class="balance">五行バランス ${bal}</div>
        <div style="margin-top:6px;font-size:12.5px;color:var(--muted)">日主（あなたの核）：<b style="color:var(--gold)">${esc(d.dayMaster.stem)}（${esc(d.dayMaster.element)}）</b>　${esc(str)}</div>
        ${dayun}${liunian}
      </div>`;
    }
    if (data.divination === 'astrology') {
      const main = d.planets.slice(0, 3).map((p) => cell(p.ja, p.position)).join('');
      const ang = (d.ascendant ? cell('アセンダント', d.ascendant.label) : '') + (d.mc ? cell('MC', d.mc.label) : '');
      const rest = d.planets.slice(3).map((p) => cell(p.ja, p.position + (p.retrograde ? ' ℞' : ''))).join('');
      let transits = '';
      if (d.transits && d.transits.length) {
        const items = d.transits.map((h) =>
          `<div class="tl-item turn"><span class="tl-age">${esc(h.ym)}</span><span class="tl-g">${esc(h.transit)}→${esc(h.natal)} ${esc(h.aspect)}</span><span class="tl-note">${esc(h.theme)}</span></div>`
        ).join('');
        transits = `<h4>この先の転機（トランジット）</h4><div class="timeline">${items}</div>`;
      }
      return `<div class="rbody" style="border-bottom:1px solid var(--line)">
        <h4 style="margin-top:0">ホロスコープ</h4><div class="data-grid">${main}${ang}${rest}</div>
        ${d.notice ? `<div style="font-size:12px;color:var(--muted);margin-top:6px">${esc(d.notice)}</div>` : ''}
        ${transits}
      </div>`;
    }
    if (data.divination === 'seimei') return renderSeimei(d);

    if (data.divination === 'numerology') {
      return `<div class="rbody" style="border-bottom:1px solid var(--line)">
        <div class="data-grid">${cell('ライフパス', d.lifePath.number + '・' + d.lifePath.title)}${cell('誕生数', d.birthDay.number + '・' + d.birthDay.title)}</div></div>`;
    }

    if (data.divination === 'comprehensive' || data.divination === 'comprehensive_plus') {
      const a = d.astrology, fp = d.fourpillars, num = d.numerology;
      const head = [
        cell('太陽星座', a.planets[0].sign),
        cell('日主', fp.dayMaster.stem + '（' + fp.dayMaster.element + '）'),
        cell('ライフパス', num.lifePath.number + '・' + num.lifePath.title),
      ];
      if (d.seimei && !d.seimei.error) head.push(cell('姓名・総格', d.seimei.kaku.総格.stroke + '画 ' + d.seimei.kaku.総格.luck));
      if (d.fengshui) head.push(cell('本命卦', d.fengshui.kua + '・' + d.fengshui.gua + '（' + d.fengshui.group + '）'));
      // 風水 吉方位
      let fs = '';
      if (d.fengshui) {
        const L = d.fengshui.lucky;
        fs = `<div class="balance" style="margin-top:8px">吉方位 <span class="bchip">発展 ${esc(L.生気)}</span><span class="bchip">健康 ${esc(L.天医)}</span><span class="bchip">人間関係 ${esc(L.延年)}</span><span class="bchip">安定 ${esc(L.伏位)}</span></div>`;
      }
      // 統計リスク スコア
      let rk = '';
      if (d.risk && d.risk.hasInput && d.risk.fired.length) {
        const chips = Object.entries(d.risk.scores).map(([dom, v]) =>
          `<span class="bchip${v < 0 ? ' risk-neg' : v > 0 ? ' risk-pos' : ''}">${dom} ${v > 0 ? '+' : ''}${v}</span>`
        ).join('');
        rk = `<h4>統計リスク傾向（目安）</h4><div class="balance">${chips}</div><div style="font-size:11.5px;color:var(--muted);margin-top:5px">※一般的な傾向にもとづく目安（実測確率ではありません）</div>`;
      }
      // 分野別の偏差（統計＋占いの合算）
      let dev = '';
      if (d.profile) {
        const p = d.profile;
        const rows = Object.keys(p.net).map((dom) => {
          const n = p.net[dom];
          return `<div class="dev-row"><span class="dev-dom">${dom}</span><span class="dev-net ${n < 0 ? 'neg' : n > 0 ? 'pos' : ''}">${n > 0 ? '+' : ''}${n}</span><span class="dev-brk">統計${p.statistical[dom] > 0 ? '+' : ''}${p.statistical[dom]}・占い${p.occult[dom] > 0 ? '+' : ''}${p.occult[dom]}</span></div>`;
        }).join('');
        dev = `<h4>分野別の偏差（平均0からのズレ ＝ 統計＋占い）</h4><div class="devtable">${rows}</div>`;
      }
      const tl = renderForesight(d.foresight);
      return `<div class="rbody" style="border-bottom:1px solid var(--line)">
        <h4 style="margin-top:0">総合プロフィール</h4><div class="data-grid">${head.join('')}</div>${fs}${rk}${dev}${tl}</div>`;
    }

    if (data.divination === 'tarot') {
      const cards = d.cards.map((c) => {
        const id = cardImgId(c);
        const rev = c.orientation === '逆位置';
        const bg = id
          ? `<div class="tcard-img${rev ? ' rev' : ''}" style="background-image:url('/cards/${id}.webp')"></div>`
          : `<div class="tcard-art${rev ? ' rev' : ''}">${(window.SVTarotArt && SVTarotArt.cardArt) ? SVTarotArt.cardArt(c) : ''}</div>`;
        return `<div class="tcard">
          ${bg}<div class="tcard-ov"></div>
          <div class="tcard-body">
            <div class="pos">${esc(c.position)}</div>
            <div class="nm">${esc(c.name)}</div>
            <div class="or ${rev ? 'rev' : ''}">${esc(c.orientation)}</div>
            <div class="kw">${esc(c.keywords.join('・'))}</div>
          </div></div>`;
      }).join('');
      return `<div class="rbody" style="border-bottom:1px solid var(--line)">
        <h4 style="margin-top:0">${esc(d.spread)}</h4><div class="cards">${cards}</div></div>`;
    }
    return '';
  }

  function renderForesight(f) {
    if (!f) return '';
    // 運気ヒートマップ（今後6年）
    const col = (s) => s >= 2 ? '#7fe0a0' : s === 1 ? '#bfe8c8' : s === 0 ? 'rgba(150,160,220,.25)' : s === -1 ? '#e8c07f' : '#ff9b9b';
    const heat = f.trend.map((t) =>
      `<div class="heat-cell"><div class="heat-box" style="background:${col(t.score)}"></div><div class="heat-y">${String(t.year).slice(2)}</div></div>`
    ).join('');
    // 合致点（確度・高/中を強調）
    const conv = f.convergence.filter((c) => c.srcCount > 0).map((c) => {
      const cls = c.level === '高' ? 'conf-hi' : c.level === '中' ? 'conf-mid' : 'conf-lo';
      return `<div class="tl-item ${c.level !== '低' ? 'turn' : ''}"><span class="tl-age">${c.year}年</span><span class="conf ${cls}">確度${c.level}</span><span class="tl-note">${esc(c.signals.map((s) => s.src).filter((v, i, a) => a.indexOf(v) === i).join('・'))}が示唆</span></div>`;
    }).join('');
    // 流月（今後6ヶ月）
    const mon = f.months.slice(0, 6).map((m) =>
      `<div class="tl-item ${m.clash ? 'turn' : ''}"><span class="tl-age">${esc(m.ym)}</span><span class="tl-k">${esc(m.kanshi)}</span><span class="tl-note">${esc(m.theme)}${m.clash ? '・変化' : ''}</span></div>`
    ).join('');
    // 節目
    const ms = (f.milestones || []).map((x) =>
      `<div class="tl-item turn"><span class="tl-age">${x.year}年</span><span class="tl-g">${esc(x.name)}</span><span class="tl-note">${esc(x.note)}</span></div>`
    ).join('');
    return `
      <h4>運気ヒートマップ（今後6年）</h4><div class="heatmap">${heat}</div>
      <h4>合致点（複数の占術が同じ年を指す＝確度）</h4><div class="timeline">${conv || '<div class="tl-item"><span class="tl-note">目立った合致はありません</span></div>'}</div>
      ${ms ? `<h4>人生の節目</h4><div class="timeline">${ms}</div>` : ''}
      <h4>流月（今後6ヶ月の運気）</h4><div class="timeline">${mon}</div>`;
  }

  function renderSeimei(d) {
    if (d.error) return `<div class="rbody" style="border-bottom:1px solid var(--line)"><div style="color:var(--muted);font-size:13px">${esc(d.error)}</div></div>`;
    const cells = Object.entries(d.kaku).map(([k, v]) =>
      `<div class="data-cell"><b>${esc(k)}（${esc(v.luck)}）</b>${v.stroke}画 ${esc(v.meaning)}</div>`
    ).join('');
    return `<div class="rbody" style="border-bottom:1px solid var(--line)">
      <h4 style="margin-top:0">五格（${esc(d.sei)} ${esc(d.mei)}）</h4><div class="data-grid">${cells}</div>
      <div style="margin-top:8px;font-size:12.5px;color:var(--muted)">三才配置：天${esc(d.sancai.天)}・人${esc(d.sancai.人)}・地${esc(d.sancai.地)}（${esc(d.sancai.harmony)}）</div></div>`;
  }

  function offerRestart() {
    state.stage = 'done'; input.disabled = true; input.placeholder = 'もう一度占う場合は下のボタンから';
    setQuick([{ label: 'もう一度占う', onClick: () => { clearQuick(); showPicker(); } }]);
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
