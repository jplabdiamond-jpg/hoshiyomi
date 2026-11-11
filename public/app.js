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
    palm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11V5.3a1.3 1.3 0 0 1 2.6 0V10M10.6 10V4.3a1.3 1.3 0 0 1 2.6 0V10M13.2 10V5.1a1.3 1.3 0 0 1 2.6 0V12"/><path d="M8 11V8.2a1.3 1.3 0 0 0-2.6 0v5.3c0 3.3 2.2 6 5.6 6 3.1 0 5.5-2.1 5.5-5.4V9.2a1.3 1.3 0 0 0-2.6 0"/></svg>`,
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
  // フッター（入力欄・クイックボタン）の高さが変わった後に確実に最下部へ寄せる
  function scrollSoon() { requestAnimationFrame(() => requestAnimationFrame(scroll)); }
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
  // 画像を端末内で縮小し JPEG dataURL にする（アップロード容量を抑える）
  // 鮮明度の目安：縮小グレースケール上でラプラシアン応答の分散を取る（大きいほどシャープ）。
  // 解像度非依存にするため固定の解析サイズ（長辺560px）で評価する。
  function sharpnessScore(im, srcW, srcH) {
    try {
      const A = 560, s = Math.min(1, A / Math.max(srcW, srcH));
      const w = Math.max(1, Math.round(srcW * s)), h = Math.max(1, Math.round(srcH * s));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, w, h);
      const d = cx.getImageData(0, 0, w, h).data;
      const g = new Float32Array(w * h);
      for (let i = 0, p = 0; i < d.length; i += 4, p++) g[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let sum = 0, sum2 = 0, n = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        const lap = 4 * g[p] - g[p - 1] - g[p + 1] - g[p - w] - g[p + w];
        sum += lap; sum2 += lap * lap; n++;
      }
      if (!n) return 0;
      const mean = sum / n;
      return sum2 / n - mean * mean; // variance
    } catch { return null; } // 計測不能時はnull（＝警告しない）
  }
  function downscaleImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        let w = im.naturalWidth, h = im.naturalHeight;
        const sharp = sharpnessScore(im, w, h);
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve({ dataUrl: cv.toDataURL('image/jpeg', quality), sharpness: sharp, w, h });
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')); };
      im.src = url;
    });
  }
  var BLUR_THRESHOLD = 90; // これ未満はブレ/ピンボケの疑い（撮り直しを推奨）
  async function botSay(html, delay = 500) {
    const t = typing(); await wait(delay); t.remove(); return bubble('bot', html);
  }
  function setQuick(items) {
    quick.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (it.ghost ? ' ghost' : '') + (it.gold ? ' chip-gold' : '');
      b.textContent = it.label; b.onclick = () => it.onClick();
      quick.appendChild(b);
    }
    scrollSoon(); // ボタンが増えてフッターが高くなった分、最新コメントを隠さないよう再スクロール
  }
  function clearQuick() { quick.innerHTML = ''; scrollSoon(); }
  // テキスト入力が必要なときだけ入力欄を表示する
  function showInput(on) {
    form.classList.toggle('no-input', !on);
    scrollSoon(); // 入力欄の出し入れで高さが変わるたびに最下部へ寄せ直す
  }
  // モバイルでキーボードが開閉してビューポートが変わったときも最新コメントを見せ続ける
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (chat.scrollHeight - chat.scrollTop - chat.clientHeight < 160) scroll();
    });
  }
  form.classList.add('no-input');

  // ---------- 会話フロー ----------
  async function start() {
    try {
      const r = await fetch('/api/divinations'); DIVS = (await r.json()).divinations;
    } catch { DIVS = []; }
    const params = new URLSearchParams(location.search);
    const paid = params.get('paid');
    const canceled = params.get('canceled');
    const welcome = params.get('welcome');
    const loggedin = params.get('loggedin');
    const subErr = params.get('sub_error');
    const loginErr = params.get('login_error');
    const subCanceled = params.get('sub_canceled');
    // URLのクエリを消す（二重実行防止）
    if (paid || canceled || welcome || loggedin || subErr || loginErr || subCanceled) history.replaceState({}, '', location.pathname);
    if (paid) {
      await botSay('Sibylla Vision へお帰りなさい。', 300);
      await runPaidReading(paid);
      return;
    }
    if (welcome === 'sub') { await showMyPage({ welcome: true }); return; }
    if (loggedin) { await botSay('ログインしました。', 200); await showMyPage(); return; }
    if (subErr) await botSay('お申込みの確認でエラーが発生しました。お支払いが完了している場合はサポートへご連絡ください。', 300);
    if (loginErr) await botSay('ログインリンクが無効か期限切れです。もう一度お試しください。', 300);
    if (subCanceled) await botSay('継続鑑定のお申込みはキャンセルされました。', 300);
    await botSay('Sibylla Vision へようこそ。<br>星の配置・生まれ持った命式に、統計と風水を重ねて、これからの流れをお読みします。<br>まずは占いたいものをお選びください。', 300);
    if (canceled) await botSay('お支払いはキャンセルされました。いつでもまたどうぞ。', 300);
    showPicker();
    checkReturning();
  }

  // 継続プランにログイン済み（Cookie有効）なら、マイページへの導線を出す
  async function checkReturning() {
    try {
      const me = await (await fetch('/api/me')).json();
      if (me && me.loggedIn) {
        setQuick([{ label: '継続鑑定のマイページを開く', gold: true, onClick: () => showMyPage() }]);
      }
    } catch { /* 未ログインは何もしない */ }
  }

  function showPicker() {
    state.stage = 'picking'; clearQuick(); showInput(false);
    const wrap = document.createElement('div');
    wrap.className = 'msg bot';
    const cards = DIVS.map((d) =>
      `<button class="pick" data-key="${d.key}"><span class="ic">${ICONS[d.key] || ''}</span>
        <span><span class="ttl">${esc(d.ja)}${d.price ? `<em class="price">¥${d.price.toLocaleString()}</em>` : ''}</span><span class="tag">${esc(d.tagline)}</span></span></button>`
    ).join('');
    const subCta = `<div class="sub-cta">
        <button class="pick pick-sub" data-key="subscribe"><span class="ic">${SIGIL}</span>
          <span><span class="ttl">継続鑑定<em class="price">¥980／月</em></span>
          <span class="tag">毎月あなたの星回りで鑑定を更新。予測の“答え合わせ”であなた専用に精度が育つ継続プラン。</span></span></button>
        <button class="sub-login ghost" type="button">継続プランにログイン</button>
      </div>`;
    wrap.innerHTML = `<div class="avatar">${SIGIL}</div><div class="bubble" style="width:100%"><div class="picker">${cards}</div>${subCta}</div>`;
    chat.appendChild(wrap); scroll();
    wrap.querySelectorAll('.pick').forEach((b) => b.onclick = () => chooseDivination(b.dataset.key));
    const lg = wrap.querySelector('.sub-login'); if (lg) lg.onclick = () => promptLogin();
  }

  function showInfoPopup(text) {
    return new Promise((res) => {
      const ov = document.createElement('div');
      ov.className = 'sv-modal-ov';
      ov.innerHTML = `<div class="sv-modal" role="dialog" aria-modal="true">
        <div class="sv-modal-ic">${SIGIL}</div>
        <div class="sv-modal-body">${esc(text)}</div>
        <button class="sv-modal-ok" type="button">始める</button></div>`;
      document.body.appendChild(ov);
      const close = () => { ov.remove(); res(); };
      ov.querySelector('.sv-modal-ok').onclick = close;
      ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    });
  }

  async function chooseDivination(key) {
    if (key === 'subscribe') return startSubscribe();
    const d = DIVS.find((x) => x.key === key); if (!d) return;
    state.subscribe = false;
    state.div = d; state.fields = d.fields; state.idx = 0; state.answers = {}; state.stage = 'collecting';
    bubble('user', esc(d.ja));
    // 詳細プラン（有料）は入力の価値を先に伝える
    if (d.price) await showInfoPopup('項目を埋めるほど精度の高い鑑定が可能です。');
    await botSay(`承知しました。<b>${esc(d.ja)}</b>で占います。<br>いくつか教えてくださいね。`, 500);
    if (d.privacyNote) await botSay(`<span style="font-size:13px;color:var(--muted)">🔒 ${esc(d.privacyNote)}</span>`, 400);
    askNext();
  }

  async function askNext() {
    if (state.idx >= state.fields.length) return runReading();
    const f = state.fields[state.idx];
    let msg = `<b>${esc(f.label)}</b>を教えてください。`;
    if (f.notice) msg += `<div class="field-notice"><span class="fn-ic">⚠</span><span>${esc(f.notice)}</span></div>`;
    if (f.help) msg += `<br><span style="color:var(--muted);font-size:13px">${esc(f.help)}</span>`;
    await botSay(msg, 450);

    if (f.type === 'select' && f.options.some((o) => o.desc)) {
      // 説明つきの選択肢（スプレッドなど）はカード形式で提示
      input.disabled = true; input.placeholder = '下から選んでください'; clearQuick(); showInput(false);
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
    } else if (f.type === 'image') {
      // 写真アップロード（手相など）。端末内で縮小してからdataURLで送る
      input.disabled = true; input.placeholder = '写真を選んでください'; clearQuick(); showInput(false);
      const wrap = document.createElement('div'); wrap.className = 'msg bot';
      wrap.innerHTML = `<div class="avatar">${SIGIL}</div><div class="bubble" style="width:100%">
        <div class="img-box">
          <div class="img-guide">
            <div class="img-guide-ttl">📸 きれいに撮るコツ</div>
            <ul>
              <li>手のひら全体（指先〜手首まで）を枠いっぱいに</li>
              <li>明るい場所で、影が入らないように</li>
              <li>手を少し反らし気味に広げ、線をはっきりと</li>
              <li>ピントを合わせ、ブレないように固定して撮影</li>
            </ul>
          </div>
          <label class="img-pick">
            <input type="file" accept="image/*" capture="environment" hidden>
            <span class="img-pick-ic">📷</span><span>写真を撮る / 選ぶ</span>
          </label>
          <div class="img-preview" hidden><img alt="プレビュー"><button type="button" class="img-redo ghost">選び直す</button></div>
          <div class="img-warn" hidden></div>
          <div class="img-actions" hidden><button type="button" class="img-go">この写真で占う</button></div>
          <div class="img-err" hidden></div>
        </div></div>`;
      chat.appendChild(wrap); scroll();
      const fileEl = wrap.querySelector('input[type=file]');
      const prev = wrap.querySelector('.img-preview'), prevImg = prev.querySelector('img');
      const actions = wrap.querySelector('.img-actions'), errEl = wrap.querySelector('.img-err');
      const warnEl = wrap.querySelector('.img-warn');
      const pick = wrap.querySelector('.img-pick');
      const guide = wrap.querySelector('.img-guide');
      let dataUrl = null;
      const showErr = (m) => { errEl.textContent = m; errEl.hidden = false; };
      fileEl.onchange = async () => {
        errEl.hidden = true; warnEl.hidden = true;
        const file = fileEl.files && fileEl.files[0]; if (!file) return;
        if (!/^image\//.test(file.type)) { showErr('画像ファイルを選んでください。'); return; }
        try {
          const r = await downscaleImage(file, 1600, 0.9);
          dataUrl = r.dataUrl;
          prevImg.src = dataUrl; prev.hidden = false; actions.hidden = false; pick.style.display = 'none'; if (guide) guide.hidden = true;
          // ブレ・ピンボケの疑いがあれば、撮り直しを“推奨”（ブロックはしない）
          if (typeof r.sharpness === 'number' && r.sharpness < BLUR_THRESHOLD) {
            warnEl.innerHTML = '⚠ ピントが甘い／ブレている可能性があります。手相の細い線が読み取りにくくなります。明るい場所でピントを合わせて撮り直すのがおすすめです（このまま進むこともできます）。';
            warnEl.hidden = false;
          }
          scrollSoon();
        } catch { showErr('この画像を読み込めませんでした。別の写真でお試しください。'); }
      };
      wrap.querySelector('.img-redo').onclick = () => { dataUrl = null; prev.hidden = true; actions.hidden = true; warnEl.hidden = true; pick.style.display = ''; if (guide) guide.hidden = false; fileEl.value = ''; scrollSoon(); };
      wrap.querySelector('.img-go').onclick = () => {
        if (!dataUrl) return;
        actions.hidden = true; pick.style.display = 'none';
        input.disabled = false; input.placeholder = 'メッセージを入力…';
        bubble('user', '<img class="up-thumb" alt="アップロードした写真" src="' + dataUrl + '">');
        state.answers[f.key] = dataUrl; state.idx++; clearQuick(); askNext();
      };
      if (!f.required) {
        setQuick([{ label: '写真なしで進む', ghost: true, onClick: () => {
          input.disabled = false; input.placeholder = 'メッセージを入力…';
          bubble('user', '写真なし'); state.answers[f.key] = ''; state.idx++; clearQuick(); askNext();
        } }]);
      }
    } else if (f.type === 'events') {
      // 過去の転機：カテゴリ＋年（月は任意）を最大 maxItems 件。答え合わせで本人較正に使う
      input.disabled = true; input.placeholder = '下のフォームで入力してください'; clearQuick(); showInput(false);
      const max = f.maxItems || 3;
      const yearNow = new Date().getFullYear();
      const collected = [];
      const labelOf = (v) => (f.options.find((o) => o.value === v) || {}).label || v;
      const wrap = document.createElement('div'); wrap.className = 'msg bot';
      const optsHtml = f.options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
      const monHtml = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}月</option>`).join('');
      wrap.innerHTML = `<div class="avatar">${SIGIL}</div><div class="bubble" style="width:100%">
        <div class="events-box">
          <div class="ev-list"></div>
          <div class="ev-form">
            <select class="ev-cat">${optsHtml}</select>
            <div class="ev-when">
              <input class="ev-year" type="number" inputmode="numeric" placeholder="年（例 2019）" min="1900" max="${yearNow}">
              <select class="ev-month"><option value="">月（任意）</option>${monHtml}</select>
            </div>
            <button class="ev-add" type="button">＋ この転機を追加</button>
          </div>
          <div class="ev-actions">
            <button class="ev-done" type="button">この内容で進む</button>
            <button class="ev-skip ghost" type="button">入力せずに進む</button>
          </div>
        </div></div>`;
      chat.appendChild(wrap); scroll();
      const listEl = wrap.querySelector('.ev-list');
      const catEl = wrap.querySelector('.ev-cat'), yearEl = wrap.querySelector('.ev-year'), monEl = wrap.querySelector('.ev-month');
      const addBtn = wrap.querySelector('.ev-add');
      const render = () => {
        listEl.innerHTML = collected.map((e, i) =>
          `<div class="ev-item"><span>${esc(labelOf(e.cat))}／${e.year}年${e.month ? e.month + '月' : ''}</span><button type="button" class="ev-del" data-i="${i}">×</button></div>`
        ).join('');
        listEl.querySelectorAll('.ev-del').forEach((b) => b.onclick = () => { collected.splice(+b.dataset.i, 1); render(); });
        addBtn.disabled = collected.length >= max;
        addBtn.textContent = collected.length >= max ? `上限 ${max} 件です` : '＋ この転機を追加';
      };
      addBtn.onclick = () => {
        const y = parseInt(yearEl.value, 10);
        if (!y || y < 1900 || y > yearNow) { yearEl.classList.add('err'); yearEl.focus(); return; }
        yearEl.classList.remove('err');
        if (collected.length >= max) return;
        collected.push({ cat: catEl.value, year: y, month: monEl.value ? +monEl.value : null });
        yearEl.value = ''; monEl.value = ''; render();
      };
      const finish = (arr) => {
        wrap.querySelector('.ev-form').style.display = 'none';
        wrap.querySelector('.ev-actions').style.display = 'none';
        input.disabled = false; input.placeholder = 'メッセージを入力…';
        const disp = arr.length ? arr.map((e) => `${labelOf(e.cat)}(${e.year}年${e.month ? e.month + '月' : ''})`).join('、') : 'スキップ';
        answerField(arr, disp);
      };
      wrap.querySelector('.ev-done').onclick = () => finish(collected.slice());
      wrap.querySelector('.ev-skip').onclick = () => finish([]);
      render();
    } else if (f.type === 'select') {
      input.disabled = true; input.placeholder = '下から選んでください'; showInput(false);
      const chips = f.options.map((o) => ({
        label: o.label, onClick: () => { input.disabled = false; input.placeholder = 'メッセージを入力…'; answerField(o.value, o.label); },
      }));
      if (!f.required) chips.push({ label: 'スキップ', ghost: true, onClick: () => { input.disabled = false; input.placeholder = 'メッセージを入力…'; answerField('', 'スキップ'); } });
      setQuick(chips);
    } else {
      input.disabled = false; input.placeholder = f.help ? f.help.replace(/^例）/, '例: ') : 'メッセージを入力…'; showInput(true);
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
    // 継続鑑定（サブスク）の申込みへ
    if (state.subscribe) return goSubCheckout();
    // 有料モードは決済へ
    if (state.div && state.div.price) return goCheckout();
    // タロットは演出（シャッフル→配布→めくり）を挟む
    if (state.div && state.div.key === 'tarot') return runTarotReading();
    state.stage = 'reading';
    input.disabled = true; input.placeholder = '鑑定中…'; clearQuick(); showInput(false);
    // 動画演出のある占術（占星術・四柱推命）は動画をフェードインで差し込み、結果直前にフェードアウト
    const vid = state.div && READING_VIDEOS[state.div.key];
    const stage = vid ? videoStage(vid.src, vid.cap) : null;
    const t = stage ? null : typing();
    const started = Date.now();
    try {
      const r = await fetch('/api/reading', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ divination: state.div.key, answers: state.answers, anonId }),
      });
      const data = await r.json();
      if (stage) {
        const MIN = reduceMotion ? 0 : 4200; const el = Date.now() - started;
        if (el < MIN) await wait(MIN - el);
        await fadeRemove(stage);
      } else { t.remove(); }
      if (!r.ok || data.error) { await botSay(`うまく鑑定できませんでした。${esc(data.error || '')}<br>もう一度お試しください。`); offerRestart(); return; }
      renderResult(data);
    } catch (e) {
      if (stage) stage.remove(); if (t) t.remove();
      await botSay('通信に失敗しました。少し時間をおいて再度お試しください。');
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

  // カードのレアリティ（演出の強さ）: 大アルカナ > 宮廷札 > 数札
  function cardRarity(c) {
    if (!c) return 'pip';
    if (c.arcana === '大アルカナ') return 'major';
    if (typeof c.number === 'number' && c.number >= 11) return 'court';
    return 'pip';
  }

  // 光の粒子が爆発的に弾け飛ぶ
  function burstParticles(tz, n, rare) {
    const burst = document.createElement('div'); burst.className = 'fx-spark';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 360 + (Math.random() * 30 - 15);
      const dist = 60 + Math.random() * (rare === 'major' ? 130 : 85);
      const s = document.createElement('i');
      s.style.setProperty('--tx', (Math.cos(a * Math.PI / 180) * dist).toFixed(1) + 'px');
      s.style.setProperty('--ty', (Math.sin(a * Math.PI / 180) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dl', (Math.random() * 0.14).toFixed(2) + 's');
      s.style.setProperty('--sz', (3.5 + Math.random() * (rare === 'major' ? 6 : 4)).toFixed(1) + 'px');
      burst.appendChild(s);
    }
    tz.appendChild(burst);
    setTimeout(() => burst.remove(), 1500);
  }

  // ド派手なガチャ出現演出（衝撃波・光条・光柱・粒子・レア表示・画面フラッシュ）
  function gachaReveal(slot, card) {
    const tz = slot.querySelector('.tz'); if (!tz) return;
    const r = cardRarity(card); slot.classList.add('rare-' + r);
    const rings = r === 'major' ? 3 : r === 'court' ? 2 : 1;
    for (let k = 0; k < rings; k++) {
      const sh = document.createElement('div'); sh.className = 'fx-shock';
      sh.style.animationDelay = (k * 0.11).toFixed(2) + 's';
      tz.appendChild(sh);
    }
    const rays = document.createElement('div'); rays.className = 'fx-rays-burst'; tz.appendChild(rays);
    burstParticles(tz, r === 'major' ? 30 : r === 'court' ? 20 : 13, r);
    if (r === 'major') {
      const beam = document.createElement('div'); beam.className = 'fx-beam'; tz.appendChild(beam);
      const stage = slot.closest('.tarot-stage');
      if (stage) { const fl = document.createElement('div'); fl.className = 'fx-flash'; stage.appendChild(fl); setTimeout(() => fl.remove(), 700); }
    }
    setTimeout(() => {
      tz.querySelectorAll('.fx-shock,.fx-rays-burst,.fx-beam,.fx-spark').forEach((e) => e.remove());
    }, 1900);
  }

  async function runTarotReading() {
    state.stage = 'reading';
    input.disabled = true; input.placeholder = '鑑定中…'; clearQuick(); showInput(false);
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
      if (!reduceMotion) { slots[i].classList.add('charging'); await wait(count > 3 ? 120 : 180); slots[i].classList.remove('charging'); }
      slots[i].classList.add('revealed', 'pop');
      if (!reduceMotion) setTimeout(() => gachaReveal(slots[i], cards[i]), 470);
      scroll();
      if (!reduceMotion) await wait(count > 3 ? 430 : 650);
    }
    await wait(reduceMotion ? 0 : 560);
    stage.classList.add('settled'); // エフェクトを静める
    caption.classList.add('hide');

    await wait(reduceMotion ? 0 : 420);
    renderResult(data);
    offerRestart();
  }

  // 手相スキャン演出：手のひらが光でスキャンされる動画をフェードインでループ再生
  function palmScanStage() {
    const wrap = document.createElement('div');
    wrap.className = 'msg bot stagemsg fade-stage';
    wrap.innerHTML = `<div class="bubble" style="width:100%;padding:0;background:transparent;border:none;box-shadow:none">
        <div class="pscan">
          <video class="pscan-vid" src="/palm-scan.mp4" autoplay muted loop playsinline preload="auto" aria-label="手のひらを読み取っています"></video>
          <div class="pscan-cap">手のひらを読み取っています…</div>
        </div></div>`;
    chat.appendChild(wrap); scroll();
    const v = wrap.querySelector('video');
    if (v) { v.muted = true; const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('in')));
    return wrap;
  }

  // 鑑定待ちに動画をフェードインで差し込む（占星術・四柱推命など）
  const READING_VIDEOS = {
    astrology: { src: '/astro-scan.mp4', cap: '星の配置を読み解いています…' },
    fourpillars: { src: '/bazi-scan.mp4', cap: '四柱を読み解いています…' },
    seimei: { src: '/seimei-scan.mp4', cap: 'お名前の画数を読み解いています…' },
    numerology: { src: '/numerology-scan.mp4', cap: '運命数を読み解いています…' },
  };
  function videoStage(src, cap) {
    const wrap = document.createElement('div');
    wrap.className = 'msg bot stagemsg fade-stage';
    wrap.innerHTML = `<div class="bubble" style="width:100%;padding:0;background:transparent;border:none;box-shadow:none">
        <div class="astro-wrap">
          <video class="astro-vid" src="${src}" autoplay muted loop playsinline preload="auto" aria-label="${cap}"></video>
          <div class="pscan-cap">${cap}</div>
        </div></div>`;
    chat.appendChild(wrap); scroll();
    const v = wrap.querySelector('video');
    if (v) { v.muted = true; const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('in')));
    return wrap;
  }
  // フェードアウトしてから要素を除去
  function fadeRemove(el) {
    return new Promise((res) => {
      if (!el) return res();
      el.classList.remove('in'); el.classList.add('out');
      setTimeout(() => { el.remove(); res(); }, reduceMotion ? 0 : 650);
    });
  }

  async function goCheckout() {
    state.stage = 'reading';
    input.disabled = true; clearQuick(); showInput(false);
    const price = state.div.price;
    const usesPalm = !!(state.answers.palmImage || state.answers.palmImage2);
    const prep = usesPalm ? '手相を読み取り、お支払いページ（Stripe）を準備しています…（少々お待ちください）' : 'お支払いページ（Stripe）に移動します…';
    await botSay(`${esc(state.div.ja)}は <b>¥${price.toLocaleString()}</b> の有料鑑定です。<br>${prep}`, 500);
    const scan = usesPalm ? palmScanStage() : null;
    const t = scan ? null : typing();
    const started = Date.now();
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ divination: state.div.key, answers: state.answers, anonId }),
      });
      const data = await r.json();
      if (t) t.remove();
      if (scan) { const MIN = reduceMotion ? 0 : 1400; const el = Date.now() - started; if (el < MIN) await wait(MIN - el); await fadeRemove(scan); }
      if (r.status === 422 && data.error === 'palm_retake') {
        await botSay(esc(data.message || '手のひらの写真をうまく読み取れませんでした。明るい場所で撮り直してください。')); offerRestart(); return;
      }
      if (!r.ok || !data.url) {
        await botSay(`決済ページを開けませんでした。${esc(data.error || data.message || '')}`); offerRestart(); return;
      }
      sessionStorage.setItem('sv_pending', '1');
      location.href = data.url; // Stripe Checkout へ
    } catch {
      if (t) t.remove(); if (scan) await fadeRemove(scan);
      await botSay('決済サーバーに接続できませんでした。少し時間をおいて再度お試しください。'); offerRestart();
    }
  }

  // ── ③ 継続鑑定（サブスク） ──
  async function startSubscribe() {
    const base = DIVS.find((x) => x.key === 'comprehensive_plus');
    if (!base) { await botSay('継続プランの準備中です。少し時間をおいてお試しください。'); return; }
    state.subscribe = true;
    state.div = { ...base, key: 'comprehensive_plus', ja: '継続鑑定（月額）' };
    state.fields = base.fields; state.idx = 0; state.answers = {}; state.stage = 'collecting';
    bubble('user', '継続鑑定（¥980／月）');
    await botSay('継続鑑定（<b>¥980／月</b>）ですね。毎月あなたの星回りで鑑定を更新し、予測の“答え合わせ”を続けるほどあなた専用に精度が育ちます。<br>まず鑑定の基礎情報をうかがいます（初回のみ・以降は自動で引き継ぎます）。', 600);
    await botSay('項目を埋めるほど精度が上がります。答えたくない任意項目はスキップできます。', 400);
    askNext();
  }

  async function goSubCheckout() {
    state.stage = 'reading';
    input.disabled = true; clearQuick(); showInput(false);
    const usesPalm = !!(state.answers.palmImage || state.answers.palmImage2);
    const prep = usesPalm ? '手相を読み取り、お支払いページ（Stripe）を準備しています…' : 'お支払いページ（Stripe）に移動します…';
    await botSay(`継続鑑定は <b>¥980／月</b> です。${prep}`, 500);
    const t = typing();
    try {
      const r = await fetch('/api/sub/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: state.answers, anonId }),
      });
      const data = await r.json();
      t.remove();
      if (!r.ok || !data.url) { await botSay(`お申込みページを開けませんでした。${esc(data.error || data.message || '')}`); offerRestart(); return; }
      location.href = data.url;
    } catch {
      t.remove(); await botSay('サーバーに接続できませんでした。少し時間をおいて再度お試しください。'); offerRestart();
    }
  }

  function promptLogin() {
    const ov = document.createElement('div');
    ov.className = 'sv-modal-ov';
    ov.innerHTML = `<div class="sv-modal" role="dialog" aria-modal="true">
      <div class="sv-modal-ic">${SIGIL}</div>
      <div class="sv-modal-body">継続プランのメールアドレスを入力してください。ログイン用のリンクをお送りします。</div>
      <input class="sv-mail" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email" />
      <button class="sv-modal-ok" type="button">ログインリンクを送る</button>
      <button class="sv-modal-cancel ghost" type="button">閉じる</button></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('.sv-modal-cancel').onclick = close;
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    ov.querySelector('.sv-modal-ok').onclick = async () => {
      const email = (ov.querySelector('.sv-mail').value || '').trim();
      if (!email) return;
      ov.querySelector('.sv-modal-ok').disabled = true;
      try {
        const r = await fetch('/api/auth/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
        const data = await r.json();
        close();
        await botSay(esc(data.message || 'ログインリンクをお送りしました。メールをご確認ください。'), 300);
      } catch { close(); await botSay('送信に失敗しました。少し時間をおいてお試しください。'); }
    };
  }

  // マイページ（ログイン済み）: サブスク状態・今月の鑑定・答え合わせ・推移
  async function showMyPage(opts = {}) {
    clearQuick(); showInput(false);
    const t = typing();
    let me;
    try { me = await (await fetch('/api/me')).json(); } catch { me = { loggedIn: false }; }
    t.remove();
    if (!me.loggedIn) { await botSay('ログイン情報が確認できませんでした。もう一度ログインしてください。', 300); showPicker(); return; }
    if (opts.welcome) await botSay('ご登録ありがとうございます。継続鑑定へようこそ。', 300);

    const periodTxt = me.periodEnd ? new Date(me.periodEnd * 1000).toLocaleDateString('ja-JP') : '—';
    const statusTxt = me.active ? `有効（次回更新 ${periodTxt}）` : '停止中';
    const wrap = document.createElement('div');
    wrap.className = 'msg bot';
    const pend = (me.pending || []).map((p) => `
      <div class="pc-item" data-id="${p.id}">
        <div class="pc-q">${esc(p.label)}<span class="pc-due">（${esc(p.due_ym)}の予測）</span></div>
        <div class="pc-btns">
          <button class="pc-b" data-o="hit">当たった</button>
          <button class="pc-b" data-o="partial">半分</button>
          <button class="pc-b" data-o="miss">外れた</button>
        </div></div>`).join('');
    wrap.innerHTML = `<div class="avatar">${SIGIL}</div><div class="bubble" style="width:100%">
      <div class="mypage">
        <div class="mp-head">マイページ <span class="mp-mail">${esc(me.email)}</span></div>
        <div class="mp-status">サブスク: <b>${statusTxt}</b></div>
        ${me.pending && me.pending.length ? `<div class="mp-sec"><div class="mp-sec-t">予測の答え合わせ（続けるほど精度が上がります）</div>${pend}</div>` : ''}
        <div class="mp-actions">
          <button class="mp-refresh gold">${me.dueThisMonth ? '今月の鑑定を受け取る' : '最新の鑑定を見る'}</button>
          <button class="mp-portal ghost">お支払い・解約</button>
          <button class="mp-logout ghost">ログアウト</button>
        </div>
        <div class="mp-reading"></div>
      </div></div>`;
    chat.appendChild(wrap); scroll();

    wrap.querySelectorAll('.pc-item').forEach((it) => {
      it.querySelectorAll('.pc-b').forEach((b) => b.onclick = async () => {
        it.querySelectorAll('.pc-b').forEach((x) => x.disabled = true);
        try {
          await fetch('/api/predictions/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: it.dataset.id, outcome: b.dataset.o }) });
          it.innerHTML = '<div class="pc-done">✓ 記録しました。ありがとうございます（次回の鑑定に反映されます）。</div>';
        } catch { it.querySelectorAll('.pc-b').forEach((x) => x.disabled = false); }
      });
    });
    wrap.querySelector('.mp-logout').onclick = async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {} location.href = '/'; };
    wrap.querySelector('.mp-portal').onclick = async () => {
      try { const d = await (await fetch('/api/sub/portal', { method: 'POST' })).json(); if (d.url) location.href = d.url; else await botSay(esc(d.error || 'ポータルを開けませんでした。')); } catch { await botSay('接続に失敗しました。'); }
    };
    const rd = wrap.querySelector('.mp-reading');
    wrap.querySelector('.mp-refresh').onclick = async () => {
      const btn = wrap.querySelector('.mp-refresh'); btn.disabled = true; btn.textContent = '鑑定中…';
      rd.innerHTML = '<div class="mp-loading">星を読み解いています…</div>';
      try {
        const d = await (await fetch('/api/sub/refresh', { method: 'POST' })).json();
        if (d.error) { rd.innerHTML = `<div class="mp-err">${esc(d.message || d.error)}</div>`; btn.disabled = false; btn.textContent = '再試行'; return; }
        let diffHtml = '';
        if (d.diff && (d.diff.added?.length || d.diff.gone?.length)) {
          const add = (d.diff.added || []).map((x) => `<li class="d-add">新たに浮上：${esc(x.label)}（確度${esc(x.level)}）</li>`).join('');
          const gone = (d.diff.gone || []).map((x) => `<li class="d-gone">収束：${esc(x.label)}</li>`).join('');
          diffHtml = `<div class="mp-diff"><div class="mp-sec-t">前回からの変化（推移）</div><ul>${add}${gone}</ul></div>`;
        }
        rd.innerHTML = `${diffHtml}<div class="result"><div class="rbody">${formatReading(d.reading)}</div><div class="disc">${esc(d.disclaimer || '')}</div></div>`;
        btn.textContent = '最新の鑑定を見る'; btn.disabled = false;
        rd.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } catch { rd.innerHTML = '<div class="mp-err">接続に失敗しました。</div>'; btn.disabled = false; btn.textContent = '再試行'; }
    };
    // 初回ウェルカム時は自動で今月分を生成
    if (opts.welcome && me.dueThisMonth) wrap.querySelector('.mp-refresh').click();
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

  const fbBlock = (rid) => rid ? `<div class="fb" data-rid="${esc(rid)}">
    <span class="fb-q">この鑑定はしっくりきましたか？</span>
    <button class="fb-btn" data-v="1">当たっている</button>
    <button class="fb-btn" data-v="0">ちがう</button>
  </div>` : '';

  // タロット1枚ぶんのタイル（画像＋暗幕＋テキスト。画像が無ければSVG絵柄）
  function tarotTile(c) {
    const id = cardImgId(c);
    const rev = c.orientation === '逆位置';
    const art = (window.SVTarotArt && SVTarotArt.cardArt) ? SVTarotArt.cardArt(c) : '';
    const kw = Array.isArray(c.keywords) ? esc(c.keywords.join('・')) : '';
    const img = id ? `<img class="tcard-img${rev ? ' rev' : ''}" src="/cards/${id}.webp" alt="">` : '';
    return `<div class="tcard">
      <div class="tcard-card"><div class="tcard-art${rev ? ' rev' : ''}">${art}</div>${img}</div>
      <div class="tcard-body"><div class="pos">${esc(c.position)}</div><div class="nm">${esc(c.name)}</div>
      <div class="or ${rev ? 'rev' : ''}">${esc(c.orientation)}</div><div class="kw">${kw}</div></div></div>`;
  }

  // 全幅で左へ流れループするカード列
  // 少数枚（1〜3枚）はループ・スクロールせず、全カードを画面内に静的配置する
  function tarotStatic(cards) {
    if (!cards.length) return '';
    return `<div class="card-row" data-count="${cards.length}">${cards.map(tarotTile).join('')}</div>`;
  }
  function tarotMarquee(cards) {
    if (!cards.length) return '';
    const tiles = cards.map(tarotTile);
    const tileW = 188; // タイル幅＋間隔の目安
    const vw = window.innerWidth || 1200;
    const reps = Math.max(1, Math.ceil((vw * 1.15) / (cards.length * tileW)));
    const oneSet = Array.from({ length: reps }, () => tiles.join('')).join('');
    const copyW = cards.length * reps * tileW;
    const dur = Math.max(20, Math.round(copyW / 42)); // 約42px/秒
    return `<div class="card-marquee"><div class="cm-track" style="animation-duration:${dur}s">${oneSet}${oneSet}</div></div>`;
  }

  function renderResult(data) {
    const isTarot = data.divination === 'tarot';
    const wrap = document.createElement('div');
    if (isTarot) {
      const cards = (data.data && data.data.cards) || [];
      wrap.className = 'msg bot stagemsg';
      wrap.innerHTML = `<div class="bubble" style="width:100%;padding:0;background:transparent;border:none;box-shadow:none">
        <div class="result tarot-result">
          <div class="rhead">${esc(data.title)}の鑑定</div>
          ${cards.length <= 3 ? tarotStatic(cards) : tarotMarquee(cards)}
          <div class="scroll-wrap">
            <div class="scroll-paper"><div class="rbody scroll-text">${formatReading(data.reading)}</div></div>
          </div>
          <div class="disc">${esc(data.disclaimer)}</div>
          ${fbBlock(data.readingId)}
        </div></div>`;
    } else {
      wrap.className = 'msg bot';
      wrap.innerHTML = `<div class="avatar">${SIGIL}</div><div class="bubble" style="width:100%;padding:0;background:transparent;border:none;box-shadow:none">
        <div class="result">
          <div class="rhead">${esc(data.title)}の鑑定</div>
          ${renderData(data)}
          <div class="rbody">${formatReading(data.reading)}</div>
          <div class="disc">${esc(data.disclaimer)}</div>
          ${fbBlock(data.readingId)}
        </div></div>`;
    }
    chat.appendChild(wrap);
    if (isTarot) {
      // 結果はタイトル（上端）から見えるようにスクロール
      requestAnimationFrame(() => setTimeout(() => wrap.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60));
    } else {
      scroll();
    }
    const fb = wrap.querySelector('.fb');
    if (fb) wireFeedback(fb);
    // 画像の無い札はSVG絵柄にフォールバック
    wrap.querySelectorAll('.tcard-img').forEach((im) => im.addEventListener('error', () => im.remove()));
    // 古代紙の本文を1文字ずつ、ランダムな順に約2秒かけて炙り出す
    const scrollText = wrap.querySelector('.scroll-text');
    if (scrollText && !reduceMotion) scorchReveal(scrollText, 2900, 2000);
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

  const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
  const circledToNum = (ch) => { const i = CIRCLED.indexOf(ch); return i >= 0 ? i + 1 : ch; };
  // 鑑定文を「見出し・チェックリスト・段落」の構造に整形して読みやすくする
  function formatReading(txt) {
    if (!txt) return '';
    const lines = String(txt).replace(/\r/g, '').split('\n');
    let html = ''; let buf = []; let type = null;
    const flush = () => {
      if (!buf.length) return;
      html += `<${type} class="${type === 'ol' ? 'read-ol' : 'read-ul'}">${buf.join('')}</${type}>`;
      buf = []; type = null;
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flush(); continue; }
      let m;
      if ((m = line.match(/^[■◾▪◼]\s*(.+?)$/))) { flush(); html += `<h3 class="r-head">${esc(m[1])}</h3>`; continue; }
      if ((m = line.match(/^【(.+?)】\s*(.*)$/))) { flush(); html += `<h4 class="r-sub">${esc(m[1])}</h4>`; if (m[2]) html += `<p class="r-p">${esc(m[2])}</p>`; continue; }
      // 番号つき項目（1. / 1） / ①）
      if ((m = line.match(/^(?:(\d{1,2})[.．、）)]|([①-⑳]))\s*(.+)$/))) {
        if (type && type !== 'ol') flush();
        type = 'ol';
        const num = m[1] || circledToNum(m[2]);
        buf.push(`<li><span class="li-num">${esc(String(num))}</span><span class="li-txt">${esc(m[3])}</span></li>`);
        continue;
      }
      // 箇条書き（・ • ◦ - – ＊ *）→ チェックマーク
      if ((m = line.match(/^[・•◦\-–＊*]\s*(.+)$/))) {
        if (type && type !== 'ul') flush();
        type = 'ul';
        buf.push(`<li><span class="li-chk">✓</span><span class="li-txt">${esc(m[1])}</span></li>`);
        continue;
      }
      flush();
      html += `<p class="r-p">${esc(line)}</p>`;
    }
    flush();
    return html;
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
    const confCls = (lv) => (lv === '高' ? 'conf-hi' : lv === '中' ? 'conf-mid' : 'conf-lo');
    const domChip = (d) => {
      const arrow = d.pol > 0 ? '↑' : d.pol < 0 ? '↑↓' : '→';
      const warn = (d.net < 0 && d.pol < 0) ? ' dom-overlap' : '';
      return `<span class="dom-chip${warn}">${esc(d.domain)}${arrow}</span>`;
    };
    // 合致窓（月解像度・日付レンジ＋確度＋領域）＝未来視の核
    const wins = (f.windows || []).filter((w) => w.systems && w.systems.length).map((w) => {
      const peak = w.peakLabel ? `<span class="win-peak">${esc(w.peakLabel)}</span>` : '';
      const doms = (w.domains || []).map(domChip).join('');
      return `<div class="tl-item ${w.level !== '低' ? 'turn' : ''}">
        <span class="tl-age">${esc(w.label)}</span>
        <span class="conf ${confCls(w.level)}">確度${w.level}</span>
        <span class="tl-note">${esc(w.systems.join('＋'))}（${w.systems.length}系統）が重なる${peak}${doms ? `<span class="win-doms">${doms}</span>` : ''}</span>
      </div>`;
    }).join('');
    // 年単位の合致点（中長期）
    const conv = f.convergence.filter((c) => c.srcCount > 0).map((c) => {
      return `<div class="tl-item ${c.level !== '低' ? 'turn' : ''}"><span class="tl-age">${c.year}年</span><span class="conf ${confCls(c.level)}">確度${c.level}</span><span class="tl-note">${esc(c.signals.map((s) => s.src).filter((v, i, a) => a.indexOf(v) === i).join('・'))}が示唆</span></div>`;
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
      <h4>合致窓（複数の占術が同じ時期を指す「転機の窓」）</h4><div class="timeline">${wins || '<div class="tl-item"><span class="tl-note">今後24ヶ月で強く重なる窓は見当たりません</span></div>'}</div>
      <h4>運気ヒートマップ（今後6年）</h4><div class="heatmap">${heat}</div>
      ${conv ? `<h4>年単位の合致点（中長期）</h4><div class="timeline">${conv}</div>` : ''}
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
    state.stage = 'done'; input.disabled = true; showInput(false);
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
