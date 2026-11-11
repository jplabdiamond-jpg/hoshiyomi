(() => {
  'use strict';
  const SIG = `<svg class="sig" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="0.8" opacity="0.5"/><path d="M6 24C12 16 18 14 24 14C30 14 36 16 42 24C36 32 30 34 24 34C18 34 12 32 6 24Z" stroke="currentColor" stroke-width="1.1"/><circle cx="24" cy="24" r="5.4" stroke="currentColor" stroke-width="1.1"/><path d="M24 17.2L25.4 22.6L30.8 24L25.4 25.4L24 30.8L22.6 25.4L17.2 24L22.6 22.6L24 17.2Z" fill="currentColor"/></svg>`;
  const ICON = {
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const app = document.getElementById('app');

  const state = { me: null, divs: [], clients: [], client: null, reading: null, animate: true, customer: false };

  async function api(path, opts = {}) {
    const r = await fetch(path, { headers: { 'content-type': 'application/json' }, ...opts });
    let data = {};
    try { data = await r.json(); } catch { /* */ }
    return { ok: r.ok, status: r.status, data };
  }
  function toast(msg) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function applyTheme(color) {
    if (/^#[0-9a-fA-F]{6}$/.test(color || '')) {
      document.documentElement.style.setProperty('--accent', color);
      const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
      document.documentElement.style.setProperty('--accent-soft', `rgba(${r},${g},${b},.16)`);
    }
  }

  // ---- image downscale ----
  function downscale(file, maxDim = 1500, quality = 0.88) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        let w = im.naturalWidth, h = im.naturalHeight;
        const s = Math.min(1, maxDim / Math.max(w, h));
        w = Math.round(w * s); h = Math.round(h * s);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')); };
      im.src = url;
    });
  }

  // ---- starfield ----
  function starfield() {
    const canvas = document.createElement('canvas'); canvas.id = 'stars';
    const host = document.querySelector('.sky'); if (!host) return; host.innerHTML = ''; host.appendChild(canvas);
    const ctx = canvas.getContext('2d'); let stars = [];
    function init() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      stars = Array.from({ length: 90 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.1 * dpr + .3, a: Math.random() * 6.28, s: Math.random() * .02 + .003 }));
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const st of stars) { st.a += st.s; const o = (Math.sin(st.a) + 1) / 2; ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.28); ctx.fillStyle = `rgba(227,210,170,${.15 + o * .5})`; ctx.fill(); }
      requestAnimationFrame(draw);
    }
    init(); draw(); addEventListener('resize', init);
  }

  // ================= boot =================
  async function boot() {
    starfield();
    const [me, divs] = await Promise.all([
      api('/api/pro/me'),
      api('/api/divinations'),
    ]);
    state.me = me.data || {};
    state.divs = (divs.data && divs.data.divinations) || [];
    if (state.me.settings) { applyTheme(state.me.settings.themeColor); state.animate = state.me.settings.animate !== false; }
    route();
  }

  function route() {
    const me = state.me;
    if (me && me.isPro) return renderConsole();
    if (me && me.flagged) return renderInactive();
    return renderLanding();
  }

  // ================= landing (未加入 + ログイン) =================
  function renderLanding() {
    app.innerHTML = `
    <div class="landing">
      <div class="mark">${SIG}<div><h1>SIBYLLA <span>VISION</span></h1></div></div>
      <p class="lead">占い師のための鑑定ツール ― 占星術・四柱推命・タロット・姓名判断・数秘術・手相・総合鑑定を、お客様の前でそのまま使う。</p>

      <div class="card">
        <h2>占い師プラン</h2>
        <div class="price-tag">¥2,000<small>/月</small></div>
        <p class="sub" style="color:var(--muted);font-size:13px">どの鑑定も回数無制限で使い放題。お客様への鑑定を、あなたの屋号で。</p>
        <ul class="feat">
          <li>全7種の鑑定が回数無制限（都度課金なし）</li>
          <li>顧客カルテ ― 生年月日などを保存、リピーターは再入力ゼロ</li>
          <li>鑑定書PDF出力 ― あなたの屋号・ロゴ入りでお客様へお渡し</li>
          <li>ホワイトラベル ― 屋号・ロゴ・テーマ色。Sibylla表記を隠せる</li>
          <li>お客様向け表示＆全画面演出モード（結果アニメ ON/OFF）</li>
        </ul>
        <button class="btn primary" id="subBtn" style="width:100%;padding:13px">占い師プランを始める（¥2,000/月）</button>
        <div class="msg-line" id="subMsg"></div>
        <p class="fineprint">決済はStripeの安全な画面で行われます。メールアドレスで登録され、次回からはそのメールでログインできます。いつでも解約できます。</p>
      </div>

      <div class="divider"><span></span>すでにご契約の方<span></span></div>
      <div class="card">
        <h2 style="font-size:16px">ログイン</h2>
        <p class="sub" style="color:var(--muted);font-size:12.5px;margin-bottom:14px">ご登録のメールアドレスにログインリンクを送ります。</p>
        <div class="row" style="align-items:flex-end">
          <label class="fld" style="margin:0"><span>メールアドレス</span><input type="email" id="loginEmail" placeholder="you@example.com" /></label>
          <button class="btn" id="loginBtn" style="flex:0 0 auto">リンクを送る</button>
        </div>
        <div class="msg-line" id="loginMsg"></div>
      </div>
    </div>`;

    $('#subBtn').onclick = startCheckout;
    $('#loginBtn').onclick = sendLogin;
    $('#loginEmail').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendLogin(); });
    handleReturnParams();
  }

  function renderInactive() {
    app.innerHTML = `
    <div class="landing">
      <div class="mark">${SIG}<div><h1>SIBYLLA <span>VISION</span></h1></div></div>
      <div class="card" style="text-align:center">
        <h2>プランが停止中です</h2>
        <p class="sub" style="color:var(--muted);font-size:13.5px;margin:10px 0 18px">${esc(state.me.email || '')} のお支払いが確認できませんでした。再開するとカルテと履歴はそのまま使えます。</p>
        <button class="btn primary" id="subBtn" style="padding:12px 26px">プランを再開する（¥2,000/月）</button>
        <div class="msg-line" id="subMsg"></div>
        <div style="margin-top:14px"><button class="btn ghost sm" id="logoutBtn">ログアウト</button></div>
      </div>
    </div>`;
    $('#subBtn').onclick = startCheckout;
    $('#logoutBtn').onclick = logout;
  }

  async function startCheckout() {
    const btn = $('#subBtn'); const msg = $('#subMsg');
    btn.disabled = true; msg.className = 'msg-line'; msg.textContent = '決済ページを準備しています…';
    const r = await api('/api/pro/checkout', { method: 'POST', body: '{}' });
    if (r.ok && r.data.url) { location.href = r.data.url; return; }
    btn.disabled = false; msg.className = 'msg-line err'; msg.textContent = r.data.error || '準備に失敗しました。時間をおいて再度お試しください。';
  }
  async function sendLogin() {
    const email = ($('#loginEmail').value || '').trim(); const msg = $('#loginMsg');
    if (!email) { msg.className = 'msg-line err'; msg.textContent = 'メールアドレスを入力してください。'; return; }
    $('#loginBtn').disabled = true; msg.className = 'msg-line'; msg.textContent = '送信中…';
    const r = await api('/api/auth/request', { method: 'POST', body: JSON.stringify({ email, next: '/pro/' }) });
    $('#loginBtn').disabled = false;
    msg.className = 'msg-line ok';
    msg.textContent = r.data.message || 'ログインリンクを送信しました。メールをご確認ください。';
  }
  function handleReturnParams() {
    const p = new URLSearchParams(location.search);
    if (p.get('canceled')) toast('決済はキャンセルされました。');
    if (p.get('error')) toast('手続きでエラーが発生しました。もう一度お試しください。');
    if (location.search) history.replaceState(null, '', '/pro/');
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
    location.href = '/pro/';
  }

  // ================= console =================
  async function renderConsole() {
    const s = state.me.settings || {};
    const brand = s.hideBranding
      ? (s.logoData ? `<img src="${esc(s.logoData)}" alt="">` : '') + `<div><div class="nm">${esc(s.shopName || '鑑定コンソール')}</div>${s.operatorName ? `<div class="op">${esc(s.operatorName)}</div>` : ''}</div>`
      : `${s.logoData ? `<img src="${esc(s.logoData)}" alt="">` : SIG}<div><div class="nm">${esc(s.shopName || 'Sibylla Vision')}</div><div class="op">${esc(s.operatorName || '占い師コンソール')}</div></div>`;

    app.innerHTML = `
    <div class="topbar">
      <div class="wl">${brand}</div>
      <div class="spacer"></div>
      <span class="plan">占い師プラン · 使い放題</span>
      <button class="iconbtn" id="setBtn" title="設定・ホワイトラベル">${ICON.gear}</button>
      <button class="iconbtn" id="logoutBtn" title="ログアウト">${ICON.out}</button>
    </div>
    <div class="layout">
      <aside class="side">
        <div class="shead"><h3>顧客カルテ</h3><button class="btn sm primary" id="newClient">＋ 新規</button></div>
        <div class="search"><input id="cSearch" placeholder="名前で検索…" /></div>
        <div class="clist" id="clist"></div>
      </aside>
      <section class="main" id="main"></section>
    </div>
    <div class="present" id="present"></div>`;

    $('#setBtn').onclick = openSettings;
    $('#logoutBtn').onclick = logout;
    $('#newClient').onclick = () => openClientModal(null);
    $('#cSearch').addEventListener('input', renderClientList);

    await loadClients();
    renderMain();

    const p = new URLSearchParams(location.search);
    if (p.get('welcome')) toast('ようこそ！占い師プランが有効になりました。');
    if (location.search) history.replaceState(null, '', '/pro/');
  }

  async function loadClients() {
    const r = await api('/api/pro/clients');
    state.clients = (r.ok && r.data.clients) || [];
    renderClientList();
  }
  function renderClientList() {
    const q = ($('#cSearch') && $('#cSearch').value || '').trim().toLowerCase();
    const list = $('#clist'); if (!list) return;
    const items = state.clients.filter((c) => !q || (c.name + ' ' + (c.kana || '')).toLowerCase().includes(q));
    if (!items.length) {
      list.innerHTML = `<div class="cempty">${state.clients.length ? '該当なし' : 'まだカルテがありません。<br>「＋ 新規」から登録できます。'}</div>`;
      return;
    }
    list.innerHTML = items.map((c) => `
      <button class="citem ${state.client && state.client.id === c.id ? 'active' : ''}" data-id="${esc(c.id)}">
        <div class="cn">${esc(c.name || c.kana || '（無名）')}</div>
        <div class="cm">${c.birthDate ? `<span>${esc(c.birthDate)}</span>` : ''}${c.readingCount ? `<span>鑑定 ${c.readingCount}回</span>` : '<span>未鑑定</span>'}</div>
      </button>`).join('');
    list.querySelectorAll('.citem').forEach((b) => b.onclick = () => selectClient(b.dataset.id));
  }

  async function selectClient(id) {
    const r = await api('/api/pro/client?id=' + encodeURIComponent(id));
    if (!r.ok) { toast('カルテを開けませんでした'); return; }
    state.client = r.data.client; state.client.readings = r.data.readings || [];
    state.reading = null; state.customer = false;
    renderClientList(); renderMain();
  }

  function renderMain() {
    const main = $('#main'); if (!main) return;
    if (!state.client) {
      main.innerHTML = `
      <div class="panel welcome">
        ${SIG}
        <h2>鑑定をはじめましょう</h2>
        <p>左の「顧客カルテ」からお客様を選ぶと、保存した生年月日などを使ってすぐに鑑定できます。初めてのお客様は新規登録を。登録せずその場で占うこともできます。</p>
        <div class="actions">
          <button class="btn primary" id="wNew">＋ 新規クライアント</button>
          <button class="btn" id="wGuest">登録せず鑑定する</button>
        </div>
      </div>`;
      $('#wNew').onclick = () => openClientModal(null);
      $('#wGuest').onclick = () => { state.client = { id: null, name: 'ゲスト', guest: true, readings: [] }; renderMain(); };
      return;
    }
    const c = state.client;
    const metaBits = [];
    if (c.birthDate) metaBits.push(`<span>生年月日 <b>${esc(c.birthDate)}</b></span>`);
    if (c.birthTime) metaBits.push(`<span>出生時刻 <b>${esc(c.birthTime)}</b></span>`);
    if (c.birthPlace) metaBits.push(`<span>出生地 <b>${esc(c.birthPlace)}</b></span>`);
    if (c.gender) metaBits.push(`<span>性別 <b>${c.gender === 'male' ? '男性' : c.gender === 'female' ? '女性' : esc(c.gender)}</b></span>`);

    main.innerHTML = `
      <div class="panel no-print">
        <div class="chead">
          <div class="who">
            <div class="nm">${esc(c.name || 'ゲスト')}</div>
            ${c.kana ? `<div class="kn">${esc(c.kana)}</div>` : ''}
            <div class="meta">${metaBits.join('') || '<span style="color:var(--faint)">生年月日などは未登録</span>'}</div>
          </div>
          <div class="ops">
            ${c.guest ? '' : `<button class="btn sm" id="editC">カルテ編集</button>`}
            ${c.guest ? '' : `<button class="btn sm danger" id="delC">削除</button>`}
          </div>
        </div>
        ${c.guest ? '' : `<div style="margin-top:14px"><label class="fld" style="margin:0"><span>占い師メモ（お客様には表示されません）</span><textarea id="memo" placeholder="前回の相談内容、印象、次回の宿題など…">${esc(c.memo || '')}</textarea></label><div style="text-align:right;margin-top:6px"><button class="btn sm" id="saveMemo">メモを保存</button></div></div>`}
      </div>

      <div class="panel no-print" id="controls">
        <h2>鑑定する</h2>
        <div class="sub">占術を選んでください。保存済みの情報は自動で入ります。</div>
        <div class="chips" id="divChips"></div>
        <div id="formArea"></div>
      </div>

      <div id="readingArea"></div>

      ${(c.readings && c.readings.length) ? `
      <div class="panel no-print">
        <h2>鑑定履歴 <span class="sub" style="margin:0 0 0 8px">${c.readings.length}件</span></h2>
        <div class="hist" id="hist"></div>
      </div>` : ''}
    `;

    if ($('#editC')) $('#editC').onclick = () => openClientModal(c);
    if ($('#delC')) $('#delC').onclick = () => deleteClient(c);
    if ($('#saveMemo')) $('#saveMemo').onclick = saveMemo;
    renderDivChips();
    renderHistory();
    if (state.reading) renderReading();
  }

  function renderDivChips() {
    const wrap = $('#divChips'); if (!wrap) return;
    wrap.innerHTML = state.divs.map((d) => `<button class="chip" data-key="${esc(d.key)}">${esc(d.icon || '✦')} ${esc(d.ja)}</button>`).join('');
    wrap.querySelectorAll('.chip').forEach((b) => b.onclick = () => {
      wrap.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      b.classList.add('on'); buildForm(b.dataset.key);
    });
  }

  // ---- reading form ----
  function buildForm(key) {
    const d = state.divs.find((x) => x.key === key); if (!d) return;
    const c = state.client || {};
    const saved = c.answersSaved || {};
    const prefill = {
      birthDate: c.birthDate, birthTime: c.birthTime, birthPlace: c.birthPlace,
      gender: c.gender, hand: c.hand, sei: c.sei, mei: c.mei,
    };
    const area = $('#formArea');
    const req = d.fields.filter((f) => f.required || ['birthDate', 'birthTime', 'birthPlace', 'gender', 'hand', 'sei', 'mei'].includes(f.key));
    const opt = d.fields.filter((f) => !req.includes(f));
    area.innerHTML = `
      <div style="margin-top:14px">
        ${req.map((f) => fieldHTML(f, prefill[f.key] ?? saved[f.key])).join('')}
        ${opt.length ? `<details style="margin:4px 0 10px"><summary style="cursor:pointer;color:var(--muted);font-size:12.5px;margin-bottom:8px">詳細項目（任意）を開く</summary>${opt.map((f) => fieldHTML(f, prefill[f.key] ?? saved[f.key])).join('')}</details>` : ''}
        <button class="btn primary" id="genBtn" style="margin-top:6px">${esc(d.ja)}で鑑定する</button>
        <span class="msg-line err" id="formErr" style="margin-left:10px"></span>
      </div>`;
    wireImages();
    $('#genBtn').onclick = () => runReading(key, d);
  }

  function fieldHTML(f, val) {
    val = val == null ? '' : val;
    const help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
    const notice = f.notice ? `<span class="help" style="color:var(--gold-deep)">${esc(f.notice)}</span>` : '';
    if (f.type === 'image') {
      return `<label class="fld" data-img="${esc(f.key)}"><span>${esc(f.label)}${f.required ? ' <em style="color:var(--gold-deep);font-style:normal">*</em>' : ''}</span>
        <input type="file" accept="image/*" class="imgfile" data-key="${esc(f.key)}" />
        <div class="imgprev" data-key="${esc(f.key)}" hidden style="margin-top:8px"><img style="max-width:150px;border-radius:6px" /></div>${help}</label>`;
    }
    if (f.type === 'select') {
      const opts = (f.options || []).map((o) => `<option value="${esc(o.value)}" ${val === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      return `<label class="fld"><span>${esc(f.label)}${f.required ? ' *' : ''}</span><select data-key="${esc(f.key)}"><option value="">選択してください</option>${opts}</select>${help}</label>`;
    }
    if (f.type === 'events') {
      return `<label class="fld"><span>${esc(f.label)}</span><textarea data-key="${esc(f.key)}" placeholder="例）2018年 転職 / 2021年 結婚 など（任意・自由記述）"></textarea>${help}</label>`;
    }
    const type = f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text';
    return `<label class="fld"><span>${esc(f.label)}${f.required ? ' *' : ''}</span><input type="${type}" data-key="${esc(f.key)}" value="${esc(val)}" />${help}${notice}</label>`;
  }

  function wireImages() {
    document.querySelectorAll('.imgfile').forEach((inp) => {
      inp.onchange = async () => {
        const file = inp.files && inp.files[0]; if (!file) return;
        const prev = document.querySelector(`.imgprev[data-key="${inp.dataset.key}"]`);
        try {
          const durl = await downscale(file);
          inp._data = durl;
          if (prev) { prev.hidden = false; prev.querySelector('img').src = durl; }
        } catch { toast('画像を読み込めませんでした'); }
      };
    });
  }

  function collectForm() {
    const ans = {};
    document.querySelectorAll('#formArea [data-key]').forEach((el) => {
      if (el.classList.contains('imgprev')) return;
      const k = el.dataset.key;
      if (el.classList.contains('imgfile')) { if (el._data) ans[k] = el._data; }
      else { const v = (el.value || '').trim(); if (v) ans[k] = v; }
    });
    // pastEvents 自由記述 → events 構造は engine 任意なので文字列のまま渡さない（optionalなので省略可）
    if (typeof ans.pastEvents === 'string') delete ans.pastEvents;
    // image field names: palmImage/palmImage2 are already keys
    return ans;
  }

  async function runReading(key, d) {
    const err = $('#formErr'); err.textContent = '';
    const answers = collectForm();
    // 必須チェック
    for (const f of d.fields) {
      if (!f.required) continue;
      if (f.type === 'image') { if (!answers[f.key]) { err.textContent = `${f.label}の写真を選んでください`; return; } }
      else if (!answers[f.key]) { err.textContent = `${f.label}を入力してください`; return; }
    }
    const btn = $('#genBtn'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 鑑定中…';
    const body = { divination: key, answers };
    if (state.client && state.client.id) body.clientId = state.client.id;
    const r = await api('/api/pro/reading', { method: 'POST', body: JSON.stringify(body) });
    btn.disabled = false; btn.textContent = `${d.ja}で鑑定する`;
    if (!r.ok) { err.textContent = r.data.message || r.data.error || '鑑定に失敗しました'; return; }
    state.reading = { ...r.data, divKey: key, divJa: d.ja, at: new Date() };
    renderReading(true);
    // カルテ側の履歴を更新
    if (state.client && state.client.id) selectClientQuiet(state.client.id);
  }

  async function selectClientQuiet(id) {
    const r = await api('/api/pro/client?id=' + encodeURIComponent(id));
    if (r.ok) { const keepReading = state.reading; state.client = r.data.client; state.client.readings = r.data.readings || []; state.reading = keepReading; renderHistoryOnly(); renderClientList2(); }
  }
  function renderClientList2() { loadClients().catch(() => {}); }
  function renderHistoryOnly() {
    // re-render main keeps reading; simplest: if hist exists update it
    renderMain();
  }

  function readingDocHTML(r, forPrint) {
    const s = state.me.settings || {};
    const name = s.shopName || (s.hideBranding ? '鑑定書' : 'Sibylla Vision');
    const op = s.operatorName || '';
    const logo = s.logoData ? `<img src="${esc(s.logoData)}" alt="">` : (s.hideBranding ? '' : SIG);
    const forWhom = (state.client && !state.client.guest) ? state.client.name : '';
    const windows = (r.data && r.data.foresight && r.data.foresight.windows) || [];
    const winHTML = windows.length ? `<div class="windows">${windows.slice(0, 5).map((w) => `<div class="win"><span class="lvl">${esc(w.level || '—')}</span><span>${esc(w.label || '')}</span>${w.conf ? `<span class="cf">${w.conf}%</span>` : ''}</div>`).join('')}</div>` : '';
    const d = new Date(r.at || Date.now());
    const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    return `
      <div class="reading-doc">
        <div class="dochd">
          ${logo}
          <div style="flex:1">
            <div class="t">${esc(name)}</div>
            <div class="s">${op ? esc(op) + ' · ' : ''}${esc(dateStr)}</div>
          </div>
        </div>
        ${forWhom ? `<div class="rtitle">${esc(forWhom)} 様 — ${esc(r.title || r.divJa)}</div>` : `<div class="rtitle">${esc(r.title || r.divJa)}</div>`}
        <div class="reveal ${state.animate && !forPrint ? 'run' : ''}">
          <div class="reading-body">${esc(r.reading)}</div>
          ${winHTML}
        </div>
        <div class="foot">${esc(r.disclaimer || '鑑定は自己理解のための参考です。大切な判断はご自身で。')}</div>
      </div>`;
  }

  function renderReading(fresh) {
    const area = $('#readingArea'); if (!area) return;
    const r = state.reading; if (!r) { area.innerHTML = ''; return; }
    area.innerHTML = `
      <div class="panel reading-panel">
        <div class="toolbar no-print">
          <span style="font-family:var(--mincho);font-weight:600;font-size:15px">鑑定結果</span>
          <div class="spacer" style="flex:1"></div>
          <span class="tgl" id="tAnim"><span class="switch ${state.animate ? 'on' : ''}"></span>アニメ</span>
          <button class="btn sm" id="presentBtn">▣ 演出モード</button>
          <button class="btn sm primary" id="pdfBtn">鑑定書PDF</button>
        </div>
        <div id="docHost">${readingDocHTML(r, false)}</div>
      </div>`;
    document.body.classList.toggle('noanim', !state.animate);
    $('#tAnim').onclick = () => {
      state.animate = !state.animate;
      $('#tAnim .switch').classList.toggle('on', state.animate);
      document.body.classList.toggle('noanim', !state.animate);
      $('#docHost').innerHTML = readingDocHTML(r, false);
    };
    $('#presentBtn').onclick = openPresent;
    $('#pdfBtn').onclick = () => window.print();
    if (fresh) area.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- history ----
  function renderHistory() {
    const host = $('#hist'); if (!host) return;
    const rs = (state.client && state.client.readings) || [];
    host.innerHTML = rs.map((h) => {
      const d = new Date(String(h.createdAt).replace(' ', 'T') + 'Z');
      const dt = isNaN(d) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
      return `<div class="hrow" data-id="${esc(h.id)}">
        <div class="ht">${esc(h.title || h.divination)}<span class="dt">${dt}</span></div>
        <div class="hp"><div class="full">${esc(h.summary || '')}</div></div>
      </div>`;
    }).join('');
    host.querySelectorAll('.hrow').forEach((row) => row.onclick = () => row.classList.toggle('open'));
  }

  // ---- present / customer fullscreen ----
  function openPresent() {
    const r = state.reading; if (!r) return;
    const s = state.me.settings || {};
    const name = s.shopName || (s.hideBranding ? '' : 'SIBYLLA VISION');
    const logo = s.logoData ? `<img src="${esc(s.logoData)}" alt="">` : (s.hideBranding ? '' : SIG);
    const forWhom = (state.client && !state.client.guest) ? state.client.name : '';
    const windows = (r.data && r.data.foresight && r.data.foresight.windows) || [];
    const winHTML = windows.length ? `<div class="windows" style="max-width:520px;margin:22px auto 0">${windows.slice(0, 5).map((w) => `<div class="win"><span class="lvl">${esc(w.level || '—')}</span><span>${esc(w.label || '')}</span>${w.conf ? `<span class="cf">${w.conf}%</span>` : ''}</div>`).join('')}</div>` : '';
    const host = $('#present');
    host.innerHTML = `
      <button class="btn ghost pclose" id="pClose">閉じる ✕</button>
      <div class="pinner">
        <div class="phd">${logo}${name ? `<div class="nm">${esc(name)}</div>` : ''}${s.operatorName ? `<div class="op">${esc(s.operatorName)}</div>` : ''}</div>
        ${forWhom ? `<div class="pfor">${esc(forWhom)} 様へ</div>` : ''}
        <div class="ptitle">${esc(r.title || r.divJa)}</div>
        <div class="rule"><span></span><i>✦</i><span></span></div>
        <div class="reveal ${state.animate ? 'run' : ''}">
          <div class="pbody">${esc(r.reading)}</div>
          ${winHTML}
        </div>
        <div class="pfoot">${esc(r.disclaimer || '鑑定は自己理解のための参考です。大切な判断はご自身で。')}</div>
      </div>`;
    host.classList.add('show');
    $('#pClose').onclick = () => host.classList.remove('show');
    host.scrollTop = 0;
  }

  // ---- memo ----
  async function saveMemo() {
    const c = state.client; if (!c || c.guest) return;
    const memo = ($('#memo').value || '').trim();
    const r = await api('/api/pro/clients', { method: 'POST', body: JSON.stringify({ action: 'update', id: c.id, name: c.name, kana: c.kana, birthDate: c.birthDate, birthTime: c.birthTime, birthPlace: c.birthPlace, gender: c.gender, hand: c.hand, sei: c.sei, mei: c.mei, memo }) });
    if (r.ok) { c.memo = memo; toast('メモを保存しました'); } else toast(r.data.error || '保存に失敗しました');
  }

  async function deleteClient(c) {
    if (!confirm(`「${c.name || c.kana}」のカルテと鑑定履歴を削除します。よろしいですか？`)) return;
    const r = await api('/api/pro/clients', { method: 'POST', body: JSON.stringify({ action: 'delete', id: c.id }) });
    if (r.ok) { state.client = null; state.reading = null; await loadClients(); renderMain(); toast('削除しました'); }
    else toast(r.data.error || '削除に失敗しました');
  }

  // ---- client modal ----
  function openClientModal(c) {
    const edit = !!c;
    const v = c || {};
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `
      <div class="modal">
        <button class="mclose">×</button>
        <h2>${edit ? 'カルテを編集' : '新規クライアント'}</h2>
        <p class="sub" style="color:var(--muted);font-size:12.5px;margin:4px 0 16px">お客様の基本情報。登録しておくと次回から入力不要です。</p>
        <div class="grid2">
          <label class="fld"><span>お名前</span><input id="m_name" value="${esc(v.name)}" placeholder="山田 花子" /></label>
          <label class="fld"><span>フリガナ（任意）</span><input id="m_kana" value="${esc(v.kana)}" placeholder="ヤマダ ハナコ" /></label>
        </div>
        <div class="grid2">
          <label class="fld"><span>生年月日</span><input id="m_bd" type="date" value="${esc(v.birthDate)}" /></label>
          <label class="fld"><span>出生時刻（任意）</span><input id="m_bt" type="time" value="${esc(v.birthTime)}" /></label>
        </div>
        <div class="grid2">
          <label class="fld"><span>出生地（任意）</span><input id="m_bp" value="${esc(v.birthPlace)}" placeholder="東京都" /></label>
          <label class="fld"><span>性別</span><select id="m_g"><option value="">—</option><option value="female" ${v.gender === 'female' ? 'selected' : ''}>女性</option><option value="male" ${v.gender === 'male' ? 'selected' : ''}>男性</option></select></label>
        </div>
        <div class="grid2">
          <label class="fld"><span>利き手</span><select id="m_hand"><option value="">—</option><option value="right" ${v.hand === 'right' ? 'selected' : ''}>右利き</option><option value="left" ${v.hand === 'left' ? 'selected' : ''}>左利き</option></select></label>
          <div></div>
        </div>
        <div class="grid2">
          <label class="fld"><span>姓（漢字・姓名判断用／任意）</span><input id="m_sei" value="${esc(v.sei)}" placeholder="山田" /></label>
          <label class="fld"><span>名（漢字／任意）</span><input id="m_mei" value="${esc(v.mei)}" placeholder="花子" /></label>
        </div>
        <div class="msg-line err" id="m_err"></div>
        <div class="mact">
          <button class="btn ghost" id="m_cancel">キャンセル</button>
          <button class="btn primary" id="m_save">${edit ? '保存' : '登録'}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('.mclose').onclick = close;
    ov.querySelector('#m_cancel').onclick = close;
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    ov.querySelector('#m_save').onclick = async () => {
      const payload = {
        action: edit ? 'update' : 'create', id: v.id,
        name: $('#m_name', ov).value.trim(), kana: $('#m_kana', ov).value.trim(),
        birthDate: $('#m_bd', ov).value, birthTime: $('#m_bt', ov).value, birthPlace: $('#m_bp', ov).value.trim(),
        gender: $('#m_g', ov).value, hand: $('#m_hand', ov).value,
        sei: $('#m_sei', ov).value.trim(), mei: $('#m_mei', ov).value.trim(),
        memo: v.memo || '',
      };
      if (!payload.name && !payload.kana) { $('#m_err', ov).textContent = 'お名前（またはフリガナ）を入力してください'; return; }
      const r = await api('/api/pro/clients', { method: 'POST', body: JSON.stringify(payload) });
      if (!r.ok) { $('#m_err', ov).textContent = r.data.error || '保存に失敗しました'; return; }
      close(); await loadClients();
      const id = edit ? v.id : r.data.id;
      await selectClient(id); toast(edit ? '保存しました' : '登録しました');
    };
  }

  // ---- settings (white-label) modal ----
  function openSettings() {
    const s = state.me.settings || {};
    const swatches = ['#c9a24b', '#b0484f', '#5b6ea8', '#4f8a6b', '#8a5bb0', '#b07a3a', '#3a8aa8', '#9a9aa8'];
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `
      <div class="modal">
        <button class="mclose">×</button>
        <h2>設定 · ブランディング</h2>
        <p class="sub" style="color:var(--muted);font-size:12.5px;margin:4px 0 18px">お客様に見せる表示（屋号・ロゴ・色）と鑑定書の見た目を整えます。</p>
        <div class="logo-pick">
          <div class="prev" id="logoPrev">${s.logoData ? `<img src="${esc(s.logoData)}">` : 'ロゴ'}</div>
          <div><input type="file" id="logoFile" accept="image/*" /><div class="help" style="color:var(--faint);font-size:11px;margin-top:4px">正方形推奨・自動で縮小します。<button class="btn ghost sm" id="logoClear" style="margin-top:6px">ロゴを削除</button></div></div>
        </div>
        <div class="grid2">
          <label class="fld"><span>屋号・お店の名前</span><input id="s_shop" value="${esc(s.shopName)}" placeholder="○○占い館" /></label>
          <label class="fld"><span>占い師名（任意）</span><input id="s_op" value="${esc(s.operatorName)}" placeholder="鑑定士 ○○" /></label>
        </div>
        <label class="fld"><span>ひとこと・肩書き（任意）</span><input id="s_tag" value="${esc(s.tagline)}" placeholder="西洋占星術・タロット鑑定" /></label>
        <label class="fld" style="margin-bottom:8px"><span>テーマ色（アクセント）</span></label>
        <div class="colorpick" id="colorPick">${swatches.map((c) => `<span class="sw ${s.themeColor === c ? 'on' : ''}" data-c="${c}" style="background:${c}"></span>`).join('')}</div>
        <div class="mrow"><div class="lbl">Sibylla Vision 表記を隠す<small>お客様向け表示・鑑定書をあなたの屋号だけにします</small></div><span class="switch ${s.hideBranding ? 'on' : ''}" id="s_hide"></span></div>
        <div class="mrow"><div class="lbl">結果アニメーション（既定）<small>鑑定結果を1つずつ浮かび上がらせる演出</small></div><span class="switch ${s.animate !== false ? 'on' : ''}" id="s_anim"></span></div>
        <div class="msg-line err" id="s_err"></div>
        <div class="mact">
          <button class="btn ghost" id="s_cancel">閉じる</button>
          <button class="btn primary" id="s_save">保存</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    const st = { logoData: s.logoData || '', themeColor: s.themeColor || '#c9a24b', hideBranding: !!s.hideBranding, animate: s.animate !== false };
    ov.querySelector('.mclose').onclick = close;
    ov.querySelector('#s_cancel').onclick = close;
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    $('#logoFile', ov).onchange = async () => {
      const f = $('#logoFile', ov).files[0]; if (!f) return;
      try { st.logoData = await downscale(f, 320, 0.85); $('#logoPrev', ov).innerHTML = `<img src="${st.logoData}">`; } catch { toast('ロゴを読み込めませんでした'); }
    };
    $('#logoClear', ov).onclick = () => { st.logoData = ''; $('#logoPrev', ov).innerHTML = 'ロゴ'; $('#logoFile', ov).value = ''; };
    ov.querySelectorAll('.sw').forEach((x) => x.onclick = () => { ov.querySelectorAll('.sw').forEach((y) => y.classList.remove('on')); x.classList.add('on'); st.themeColor = x.dataset.c; applyTheme(st.themeColor); });
    $('#s_hide', ov).onclick = () => { st.hideBranding = !st.hideBranding; $('#s_hide', ov).classList.toggle('on', st.hideBranding); };
    $('#s_anim', ov).onclick = () => { st.animate = !st.animate; $('#s_anim', ov).classList.toggle('on', st.animate); };
    $('#s_save', ov).onclick = async () => {
      const payload = { shopName: $('#s_shop', ov).value.trim(), operatorName: $('#s_op', ov).value.trim(), tagline: $('#s_tag', ov).value.trim(), logoData: st.logoData, themeColor: st.themeColor, hideBranding: st.hideBranding, animate: st.animate };
      $('#s_save', ov).disabled = true;
      const r = await api('/api/pro/settings', { method: 'POST', body: JSON.stringify(payload) });
      $('#s_save', ov).disabled = false;
      if (!r.ok) { $('#s_err', ov).textContent = r.data.error || '保存に失敗しました'; return; }
      state.me.settings = r.data.settings; state.animate = r.data.settings.animate !== false;
      applyTheme(r.data.settings.themeColor);
      close(); renderConsole(); toast('設定を保存しました');
    };
  }

  boot();
})();
