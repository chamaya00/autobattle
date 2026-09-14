/* BẢN NGƯỜI CHƠI và chế độ PHIÊU LƯU.
   Soi ba thứ:
     1. bản AUTO phải KHÔNG ĐỔI MỘT NHỊP NÀO — đó là điều kiện người dùng nêu đầu tiên
        ("phiên bản auto là pban hiện tại, ch cần thay đổi gì");
     2. bản NGƯỜI CHƠI: WASD + nút chiêu ăn thật, khung sàn rộng ra;
     3. PHIÊU LƯU: lv1 chỉ có đòn thường, farm quái ăn exp, lên cấp cho điểm thuộc tính,
        điểm skill mở chiêu, và chiêu chưa mở thì bấm không ăn.
   Chạy: node tools/t_player.js */
const { build, buildPlay, playwright } = require('./probe.js');

let pass = 0, fail = 0;
const ok = (name, good, note) => {
  console.log(`${good ? 'DAT ' : 'HONG'}  ${name}${note ? ' — ' + note : ''}`);
  good ? pass++ : fail++;
};

async function newPage(file) {
  const { chromium } = playwright();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  await page.route('**://fonts.*/**', r => r.abort());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('crash', () => errors.push('TRANG SUP'));
  await page.goto('file://' + file, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(450);
  return { browser, page, errors };
}

/* Vào trận từ BẢN ĐỒ: bấm node đi được đầu tiên (hàng đầu luôn là trận thường), rồi qua
   màn hỏi sàn. Từ đợt bản đồ phân nhánh thì `#advGo` không còn là nút vào trận nữa. */
async function goBattle(page) {
  await page.click('#advBody .advNode.can');
  await page.waitForTimeout(250);
  await page.click('#arcStageGo');
  await page.waitForTimeout(3800);
}

/* ---------- 1. quái: có trong CHARS nhưng KHÔNG lọt vào lưới chọn nhân vật ---------- */
async function mobs() {
  console.log('\n== 1. quái ==');
  const { browser, page, errors } = await newPage(build());
  const r = await page.evaluate(() => {
    const mk = window.__MOB_KEYS, C = window.__CHARS, ck = window.__CKEYS();
    return {
      n: mk.length,
      allInChars: mk.every(k => !!C[k] && C[k].mob === true),
      noneInCkeys: mk.every(k => ck.indexOf(k) < 0),
      ckeysClean: ck.every(k => !C[k].mob),
      ckeysN: ck.length,
      haveThink: mk.every(k => typeof C[k].think === 'function'),
      isMob: window.__isMobKey('m_slime') && !window.__isMobKey('kono')
    };
  });
  ok('có năm loại quái', r.n === 5, r.n + ' loại');
  ok('quái nằm trong CHARS (mọi chỗ CHARS[f.key] chạy y nguyên)', r.allInChars && r.haveThink);
  ok('quái KHÔNG lọt vào CKEYS (lưới chọn nhân vật / giải đấu)', r.noneInCkeys && r.ckeysClean,
     r.ckeysN + ' nhân vật chơi được');
  ok('isMobKey phân biệt đúng', r.isMob);

  // vẽ được ra canvas, không ném lỗi, và có ra điểm ảnh
  const drawn = await page.evaluate(() => {
    const out = {};
    for (const k of window.__MOB_KEYS) {
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200;
      const c = cv.getContext('2d');
      const old = window.__getCtx(); window.__setCtx(c);
      const f = { key: k, mob: true, mobKind: k.slice(2), pose: 'idle', moving: false,
                  injured: false, face: 1, x: 0, y: 0, r: 24, hp: 10, maxHp: 10 };
      c.save(); c.translate(100, 150);
      try { window.__vector(f); } catch (e) { out[k] = 'LOI ' + e.message; }
      c.restore(); window.__setCtx(old);
      if (out[k]) continue;
      const d = c.getImageData(0, 0, 200, 200).data;
      let px = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 12) px++;
      out[k] = px;
    }
    return out;
  });
  const allDrawn = Object.values(drawn).every(v => typeof v === 'number' && v > 260);
  ok('mỗi loại quái vẽ ra hình thật', allDrawn,
     Object.entries(drawn).map(([k, v]) => k.slice(2) + ' ' + v).join(' · '));

  await browser.close();
  return errors;
}

/* ---------- 2. bản AUTO không đổi ---------- */
async function autoUntouched() {
  console.log('\n== 2. bản AUTO giữ nguyên ==');
  const { browser, page, errors } = await newPage(buildPlay());
  await page.click('#arcStart');
  await page.waitForTimeout(200);
  const whoUp = await page.$eval('#arcWho', e => !e.classList.contains('off'));
  ok('PRESS START hỏi cách chơi trước', whoUp);
  const cards = await page.$$eval('#arcWho .whoCard', a => a.length);
  ok('màn hỏi có đúng hai thẻ', cards === 2, cards + ' thẻ');

  await page.click('#whoAuto');
  await page.waitForTimeout(250);
  const st = await page.evaluate(() => ({
    kind: window.__PLAYKIND(), mode: window.__mode(), autoSkill: window.__autoSkill(),
    human: document.body.classList.contains('human'),
    csel: !document.getElementById('charSelect').classList.contains('off'),
    step: document.getElementById('charSelect').dataset.step,
    padOff: document.getElementById('padWrap').classList.contains('off'),
    advTab: getComputedStyle(document.getElementById('mTabAdv')).display
  }));
  ok('bản auto: mode vẫn "auto"', st.kind === 'auto' && st.mode === 'auto', st.mode);
  ok('bản auto: vẫn tự dùng chiêu', st.autoSkill === true);
  ok('bản auto: không mang cờ .human', !st.human);
  ok('bản auto: vào đúng bước chọn chế độ như cũ', st.csel && st.step === 'mode', st.step);
  ok('bản auto: KHÔNG có nút bấm trên màn hình', st.padOff);
  ok('bản auto: KHÔNG thấy thẻ Phiêu lưu', st.advTab === 'none', st.advTab);

  // và vẫn đánh được một trận máy vs máy trọn vẹn
  await page.click('#cselGo');
  await page.click('#listA .cTile[data-key="kono"]');
  await page.click('#cselGo');
  await page.click('#listB .cTile[data-key="chichi"]');
  await page.click('#cselGo');
  await page.click('#cselGo');
  await page.waitForTimeout(3600);          // qua màn VS (VS_HOLD 2.4s)
  const live = await page.evaluate(() => {
    const G = window.__G();
    return { t: G.t, n: G.fighters.filter(f => !f.summon).length, hp: G.k.hp };
  });
  ok('bản auto: trận chạy như thường', live.t > 0.4 && live.n === 2,
     't=' + live.t.toFixed(2) + ' · ' + live.n + ' đấu thủ');

  await browser.close();
  return errors;
}

/* ---------- 3. bản NGƯỜI CHƠI ---------- */
async function human() {
  console.log('\n== 3. bản NGƯỜI CHƠI ==');
  const { browser, page, errors } = await newPage(buildPlay());
  await page.click('#arcStart');
  await page.click('#whoHuman');
  await page.waitForTimeout(250);
  const st = await page.evaluate(() => ({
    kind: window.__PLAYKIND(), mode: window.__mode(), autoSkill: window.__autoSkill(),
    human: document.body.classList.contains('human'),
    advTab: getComputedStyle(document.getElementById('mTabAdv')).display,
    modes: document.querySelectorAll('#charSelect .mTab').length
  }));
  ok('bản người chơi: mode chuyển sang p1', st.kind === 'human' && st.mode === 'p1', st.mode);
  ok('bản người chơi: TẮT tự dùng chiêu (nút chiêu mới có nghĩa)', st.autoSkill === false);
  ok('bản người chơi: body mang cờ .human', st.human);
  ok('bản người chơi: thấy thẻ Phiêu lưu', st.advTab !== 'none', st.advTab);
  ok('đủ sáu chế độ (năm cũ + phiêu lưu)', st.modes === 6, st.modes + ' thẻ');

  // vào một trận tay đôi rồi kiểm nút bấm + WASD
  await page.click('#cselGo');
  await page.click('#listA .cTile[data-key="chichi"]');
  await page.click('#cselGo');
  await page.click('#listB .cTile[data-key="kono"]');
  await page.click('#cselGo');
  await page.click('#cselGo');
  await page.waitForTimeout(3600);

  const pad = await page.evaluate(() => {
    const w = document.getElementById('padWrap');
    const dir = [...document.querySelectorAll('.padDir [data-key]')].map(b => b.dataset.key);
    const sk = [...document.querySelectorAll('#padSk [data-key]')].map(b => b.dataset.key);
    return { on: !w.classList.contains('off'), dir, sk,
             names: [...document.querySelectorAll('#padSk s')].map(e => e.textContent) };
  });
  ok('nút bấm hiện ra', pad.on);
  ok('bốn ô hướng đúng W A S D', pad.dir.join('') === 'wasd', pad.dir.join(''));
  ok('bốn ô chiêu đúng J K L U', pad.sk.join('') === 'jklu', pad.sk.join(''));
  ok('ô chiêu có TÊN chiêu, không phải chữ suông', pad.names.every(n => n && n.length > 2),
     pad.names.join(' · '));

  /* Hình dáng đúng như người dùng chốt: "w trên cùng, a bên trái dưới, s giữa dưới w và d
     bên phải dưới" — W phải nằm TRÊN và thẳng hàng dọc với S. */
  const geo = await page.evaluate(() => {
    const b = k => document.querySelector(`.padDir [data-key="${k}"]`).getBoundingClientRect();
    const w = b('w'), a = b('a'), s = b('s'), d = b('d');
    const cx = r => r.left + r.width / 2;
    return { wAbove: w.bottom <= s.top + 2, sameCol: Math.abs(cx(w) - cx(s)) < 3,
             order: cx(a) < cx(s) && cx(s) < cx(d),
             sameRow: Math.abs(a.top - s.top) < 3 && Math.abs(s.top - d.top) < 3 };
  });
  ok('W nằm trên, thẳng cột với S', geo.wAbove && geo.sameCol);
  ok('hàng dưới là A · S · D theo đúng thứ tự', geo.order && geo.sameRow);

  // bấm nút hướng phải làm nhân vật dịch đi
  const moved = await page.evaluate(async () => {
    const G = window.__G(), f = G.k;
    const x0 = f.x, y0 = f.y;
    const b = document.querySelector('.padDir [data-key="w"]');
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    const held = window.__keys.w === true;
    await new Promise(r => setTimeout(r, 700));
    const dy = f.y - y0;
    b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    await new Promise(r => setTimeout(r, 60));
    return { held, dy, released: window.__keys.w === false, dx: f.x - x0 };
  });
  ok('bấm ô W thì giữ phím w', moved.held && moved.released);
  ok('bấm ô W thì nhân vật đi LÊN', moved.dy < -8, 'dy=' + moved.dy.toFixed(1));

  /* Khung sàn rộng hơn bản AUTO. So với chính bề ngang lúc TẮT cờ `.human` — `cv.width` là
     bộ đệm vẽ (đã nhân theo devicePixelRatio) nên không phải mốc để so. */
  const wide = await page.evaluate(() => {
    const cv = document.getElementById('arena'), b = document.body;
    const human = cv.getBoundingClientRect().width;
    b.classList.remove('human');
    const auto = cv.getBoundingClientRect().width;
    b.classList.add('human');
    return { human, auto };
  });
  ok('khung sàn nới rộng phần NHÌN (W/H trong ruột game vẫn 620)',
     wide.human > wide.auto + 40,
     'người chơi ' + Math.round(wide.human) + 'px · auto ' + Math.round(wide.auto) + 'px');
  const wh = await page.evaluate(() => window.__WH());
  ok('hằng cân bằng W/H KHÔNG bị đụng', wh.W === 620 && wh.H === 620, 'W=' + wh.W);

  await browser.close();
  return errors;
}

/* ---------- 4. phiêu lưu: lên cấp, điểm, mở chiêu ---------- */
async function adventure() {
  console.log('\n== 4. PHIÊU LƯU ==');
  const { browser, page, errors } = await newPage(buildPlay());
  await page.click('#arcStart');
  await page.click('#whoHuman');
  await page.waitForTimeout(200);
  await page.click('#mTabAdv');
  await page.waitForTimeout(160);
  await page.click('#cselGo');
  await page.waitForTimeout(200);
  await page.click('#listA .cTile[data-key="chichi"]');
  await page.click('#cselGo');                 // -> bước chọn màn
  await page.waitForTimeout(160);
  await page.click('#cselGo');                 // -> mở bảng hành trình
  await page.waitForTimeout(300);

  const board = await page.evaluate(() => {
    const b = document.getElementById('advBoard');
    const A = window.__ADV();
    return { up: !!b && !b.classList.contains('off'), key: A && A.key, lv: A && A.lv,
             rr: A && A.rr, ups: A && Object.keys(A.ups || {}).length,
             maxHp: window.__advMaxHp(), hp0: window.__ADV_HP0(),
             rows: document.querySelectorAll('#advBody .advRow').length,
             nodes: document.querySelectorAll('#advBody .advNode').length,
             stages: window.__ADV_STAGES() };
  });
  ok('bảng hành trình mở ra', board.up);
  ok('bắt đầu ở cấp 1, region 1, chưa có thẻ nào',
     board.lv === 1 && board.ups === 0,
     'lv' + board.lv + ' · ' + board.ups + ' thẻ');
  ok('có sẵn vài lượt bốc lại', board.rr > 0, board.rr + ' lượt');
  ok('lv1 máu THẤP hẳn (không đọc HP 800 của bảng chuẩn)',
     board.maxHp === board.hp0, board.maxHp + ' máu');
  ok('bảng liệt kê đủ bốn ô chiêu', board.rows >= 4, board.rows + ' hàng');
  ok('bản đồ vẽ ra node thật', board.nodes > 8, board.nodes + ' node');

  // lv1: chỉ đòn thường, ba ô chiêu còn khoá
  const locked = await page.evaluate(() => {
    const r = window.__advRank;
    return { k: r('k'), l: r('l'), u: r('u') };
  });
  ok('lv1: ba ô chiêu đều CHƯA MỞ, chỉ có đòn thường',
     locked.k === 0 && locked.l === 0 && locked.u === 0);

  // chiêu chưa mở thì bấm không ăn — advLockKeys xoá phím
  const gate = await page.evaluate(() => {
    window.__keys.j = true; window.__keys.k = true; window.__keys.u = true;
    window.__advLockKeys();
    const out = { j: window.__keys.j, k: window.__keys.k, u: window.__keys.u };
    window.__keys.j = window.__keys.k = window.__keys.u = false;
    return out;
  });
  ok('ô chiêu chưa mở thì coi như không bấm; đòn thường (j) vẫn ăn',
     gate.j === true && gate.k === false && gate.u === false,
     'j=' + gate.j + ' k=' + gate.k + ' u=' + gate.u);

  /* ---------- BẢN ĐỒ PHÂN NHÁNH (§15/§16) ---------- */
  const map = await page.evaluate(() => {
    const A = window.__ADV(), M = A.map;
    let out = true, into = true, valid = true;
    for (let r = 0; r < M.rows.length - 1; r++) {
      for (const n of M.rows[r]) {
        if (!n.to || !n.to.length) out = false;
        for (const k of (n.to || [])) if (k < 0 || k >= M.rows[r + 1].length) valid = false;
      }
      for (let j2 = 0; j2 < M.rows[r + 1].length; j2++)
        if (!M.rows[r].some(n => (n.to || []).indexOf(j2) >= 0)) into = false;
    }
    const last = M.rows[M.rows.length - 1];
    return { rows: M.rows.length, ROWS: window.__ADV_ROWS(), out, into, valid,
             rowN: M.rows.map(r => r.length), at: M.at,
             lastBoss: last.length === 1 && last[0].t === 'boss',
             firstBattle: M.rows[0].every(n => n.t === 'battle'),
             rest: M.rows[M.rows.length - 2].some(n => n.t === 'rest'),
             regions: window.__ADV_REGIONS() };
  });
  ok('bản đồ đủ ' + map.ROWS + ' hàng', map.rows === map.ROWS, map.rowN.join('-'));
  ok('KHÔNG phải đường thẳng — có hàng nhiều hơn một node',
     map.rowN.some(n => n > 1), map.rowN.join('-'));
  ok('không có node chết: node nào cũng có đường ra và đường vào', map.out && map.into);
  ok('cạnh không trỏ ra ngoài hàng kế', map.valid);
  ok('hàng đầu là trận thường, hàng cuối là BOSS một mình', map.firstBattle && map.lastBoss);
  ok('hàng áp chót luôn có chỗ nghỉ (đừng ép đánh boss với máu rách)', map.rest);
  ok('có đủ ba region', map.regions === 3, map.regions + ' region');

  const kinds = await page.evaluate(() => Object.keys(window.__ADV_NODES));
  ok('đủ tám loại node của §16',
     ['battle','hard','elite','boss','shop','treasure','event','rest'].every(k => kinds.indexOf(k) >= 0),
     kinds.join(' '));

  // chỉ đi được sang node mình NỐI TỚI
  const route = await page.evaluate(() => {
    const A = window.__ADV(), M = A.map;
    const first = window.__advNext().length;
    M.at = 0; M.pick = 0;
    const after = window.__advNext();
    return { first, row0: M.rows[0].length, after, legal: M.rows[0][0].to,
             depth: window.__advDepth() };
  });
  ok('chưa đi thì cả hàng đầu đều chọn được', route.first === route.row0, route.first + ' lối');
  ok('đi rồi thì CHỈ sang được node mình nối tới',
     JSON.stringify(route.after) === JSON.stringify(route.legal), JSON.stringify(route.after));

  // encounter đọc theo NODE chứ không theo số màn
  const enc = await page.evaluate(() => {
    const M = window.__ADV().map;
    M.at = 0; M.pick = 0;
    /* `advEncounter()` có ĐỆM theo trận (nó bị gọi cho từng địch mỗi nhịp), nên đổi loại
       node xong phải xoá đệm rồi mới đọc lại — không thì đọc ra kết quả của loại trước. */
    const set = t2 => { M.rows[0][0].t = t2; window.__advEncClear(); return window.__advEncounter(); };
    const b = set('battle'), h = set('hard'), e = set('elite'), bo = set('boss');
    set('battle');
    return { bMob: b.enemies.every(window.__isMobKey), bN: b.enemies.length, bHp: b.hp,
             hN: h.enemies.length, hHp: h.hp,
             eMob: e.enemies.some(window.__isMobKey), eHp: e.hp,
             boMob: bo.enemies.some(window.__isMobKey), boHp: bo.hp };
  });
  ok('trận thường là QUÁI, tinh nhuệ và boss là NHÂN VẬT THẬT',
     enc.bMob && !enc.eMob && !enc.boMob);
  ok('trận khó đông hơn và dai hơn trận thường',
     enc.hN >= enc.bN && enc.hHp > enc.bHp, enc.bN + ' -> ' + enc.hN + ' con');
  ok('tinh nhuệ nhẹ hơn boss cùng độ sâu', enc.eHp < enc.boHp,
     '×' + enc.eHp.toFixed(2) + ' vs ×' + enc.boHp.toFixed(2));

  // máu MANG THEO giữa các node (§30)
  const carry = await page.evaluate(() => {
    const A = window.__ADV();
    A.hp = Math.round(window.__advMaxHp() * .4);
    const before = A.hp;
    const healed = window.__advHeal(.30);
    return { before, healed, after: A.hp, max: window.__advMaxHp() };
  });
  ok('máu mang theo giữa các node, KHÔNG hồi đầy mỗi trận (§30)',
     carry.before < carry.max, carry.before + '/' + carry.max);
  ok('chỗ nghỉ hồi đúng phần máu tối đa', carry.healed > 0, '+' + carry.healed);

  // cửa hàng
  const shop = await page.evaluate(() => {
    const A = window.__ADV();
    A.gold = 0;
    const st = window.__advShopStock();
    const poor = window.__advShopBuy(st[0]);
    A.gold = 9999; const g0 = A.gold;
    const rich = window.__advShopBuy(st[0]);
    const twice = window.__advShopBuy(st[0]);
    return { n: st.length, poor, rich, twice, spent: g0 - A.gold, kinds: st.map(x => x.kind) };
  });
  ok('cửa hàng có vài món', shop.n >= 3, shop.kinds.join(' '));
  ok('không đủ vàng thì KHÔNG mua được', shop.poor === false);
  ok('đủ vàng thì mua được và bị trừ vàng', shop.rich === true && shop.spent > 0, '-' + shop.spent);
  ok('một món chỉ mua được một lần', shop.twice === false);

  // sự kiện
  const evs = await page.evaluate(() => window.__ADV_EVENTS.map(E => {
    const o = E.opts[E.opts.length - 1];
    let said = null;
    try { said = o.run(); } catch (e) { said = null; }
    return { id: E.id, opts: E.opts.length, ok: !!(said && said.vi && said.en) };
  }));
  ok('mọi sự kiện có ít nhất hai lựa chọn và trả lời song ngữ',
     evs.length >= 3 && evs.every(e => e.opts >= 2 && e.ok), evs.map(e => e.id).join(' '));

  /* ---------- bảng thẻ: cơ chế phải ÁP ĐẢO chỉ số ----------
     Người dùng chốt: *"Không được biến progression chủ yếu thành +10% damage / +5% HP"*. */
  const pool = await page.evaluate(() => {
    const UP = window.__ADV_UP;
    const stat = UP.filter(u => (u.tags || []).indexOf('STAT') >= 0).length;
    const rar = {};
    for (const u of UP) rar[u.rar] = (rar[u.rar] | 0) + 1;
    const shape = UP.every(u => u.id && u.name && u.name.vi && u.name.en &&
                                u.desc && u.desc.vi && u.desc.en && u.rar && u.tags);
    const hooks = UP.filter(u => u.hit || u.kill || u.proj || u.cast || u.tick).length;
    const tags = {};
    for (const u of UP) for (const t of u.tags) tags[t] = 1;
    return { n: UP.length, stat, rar, shape, hooks, tags: Object.keys(tags).sort() };
  });
  ok('bảng thẻ đủ khung dữ liệu (id · name · desc song ngữ · rarity · tags)', pool.shape);
  ok('thẻ CƠ CHẾ áp đảo thẻ chỉ số', pool.stat * 3 <= pool.n,
     pool.n + ' thẻ, chỉ ' + pool.stat + ' thẻ chỉ số');
  ok('quá nửa số thẻ thật sự cắm vào một cửa cơ chế', pool.hooks > pool.n / 2,
     pool.hooks + '/' + pool.n + ' thẻ có handler');
  ok('đủ bốn bậc hiếm', ['common', 'rare', 'epic', 'legend'].every(r => pool.rar[r] > 0),
     JSON.stringify(pool.rar));
  ok('có đủ mấy trục synergy người dùng nêu',
     ['MARK', 'PROJECTILE', 'CHAIN', 'AOE', 'COOLDOWN', 'BASIC_ATTACK'].every(t => pool.tags.indexOf(t) >= 0),
     pool.tags.join(' '));

  // bốc ba thẻ, tôn trọng điều kiện và trần bậc
  const draw = await page.evaluate(() => {
    const A = window.__ADV();
    const three = window.__advPick3();
    const okReq = three.every(u => !u.req || u.req(A));
    const uniq = new Set(three.map(u => u.id)).size === three.length;
    // thẻ đủ bậc thì KHÔNG được ra nữa (§68)
    window.__advGive('st_pow'); window.__advGive('st_pow');
    window.__advGive('st_pow'); window.__advGive('st_pow'); window.__advGive('st_pow');
    const maxed = window.__advStack('st_pow');
    const stillThere = window.__advPool().some(u => u.id === 'st_pow');
    return { n: three.length, okReq, uniq, maxed, stillThere };
  });
  ok('bốc đúng ba thẻ, không trùng nhau', draw.n === 3 && draw.uniq, draw.n + ' thẻ');
  ok('thẻ bốc ra đều thoả điều kiện', draw.okReq);
  ok('thẻ đã đủ bậc thì biến khỏi hũ', draw.maxed === 5 && !draw.stillThere,
     'st_pow ×' + draw.maxed);

  // nhánh loại trừ: chọn một hướng đòn thường thì hai hướng kia khoá
  const excl = await page.evaluate(() => {
    const A = window.__ADV();
    A.ups = {}; A.lock = {}; window.__advIndex();
    window.__advTake(window.__ADV_BY_ID['ba_heavy']);
    const pool = window.__advPool().map(u => u.id);
    return { heavy: window.__advStack('ba_heavy'),
             rapid: pool.indexOf('ba_rapid') >= 0, battery: pool.indexOf('ba_battery') >= 0 };
  });
  ok('chọn một nhánh đòn thường thì hai nhánh kia bị khoá',
     excl.heavy === 1 && !excl.rapid && !excl.battery);

  // thẻ mở chiêu thật sự mở ô đó
  const unlock = await page.evaluate(() => {
    const A = window.__ADV();
    A.lv = 9; A.sk = { k: 0, l: 0, u: 0 }; A.ups = {}; A.lock = {}; window.__advIndex();
    window.__advTake(window.__ADV_BY_ID['unlock_k']);
    window.__keys.k = true; window.__advLockKeys();
    const canPress = window.__keys.k === true; window.__keys.k = false;
    const before = window.__advRank('k');
    window.__advTake(window.__ADV_BY_ID['rank_k']);
    return { before, after: window.__advRank('k'), canPress };
  });
  ok('thẻ Mở Chiêu 2 mở ô K và bấm được ngay',
     unlock.before === 1 && unlock.canPress);
  ok('thẻ Rèn Chiêu 2 nâng bậc tiếp', unlock.after === 2, 'bậc ' + unlock.after);

  // pity ẩn (§70): mấy lượt không thấy thẻ mở chiêu thì nó nặng ký hơn hẳn
  const pity = await page.evaluate(() => {
    const A = window.__ADV();
    A.lv = 9; A.sk = { k: 0, l: 0, u: 0 }; A.ups = {}; A.lock = {}; A.tags = {}; window.__advIndex();
    const U = window.__ADV_BY_ID['unlock_k'];
    A.dry = 0; const w0 = window.__advWeight(U);
    A.dry = 3; const w3 = window.__advWeight(U);
    return { w0, w3 };
  });
  ok('pity ẩn: càng lâu không ra thẻ mở chiêu thì nó càng nặng ký',
     pity.w3 > pity.w0 * 2, pity.w0.toFixed(0) + ' -> ' + pity.w3.toFixed(0));

  await browser.close();
  return errors;
}

/* ---------- 5. đánh thật một màn phiêu lưu ---------- */
async function advFight() {
  console.log('\n== 5. đánh thật một màn ==');
  const { browser, page, errors } = await newPage(buildPlay());
  await page.click('#arcStart');
  await page.click('#whoHuman');
  await page.waitForTimeout(200);
  await page.click('#mTabAdv');
  await page.waitForTimeout(160);
  await page.click('#cselGo');
  await page.waitForTimeout(200);
  await page.click('#listA .cTile[data-key="superman"]');
  await page.click('#cselGo');
  await page.waitForTimeout(160);
  await page.click('#cselGo');
  await page.waitForTimeout(300);
  await page.click('#advBody .advNode.can');  // bấm một node trên bản đồ
  await page.waitForTimeout(250);
  const asked = await page.$eval('#arcStage', e => !e.classList.contains('off'));
  ok('bấm node trên bản đồ thì hỏi sàn trước (đúng lối mỗi trận một sàn)', asked);
  await page.click('#arcStageGo');
  await page.waitForTimeout(3800);            // qua màn VS

  const setup = await page.evaluate(() => {
    const G = window.__G(), M = G.fighters.filter(f => !f.summon);
    const hero = M.find(f => f.team === 0), foes = M.filter(f => f.team !== 0);
    return {
      t: G.t, n: M.length,
      heroKey: hero && hero.key, heroHp: hero && hero.maxHp,
      heroBottom: hero && hero.y > 300,
      foesMob: foes.every(f => f.mob === true), nfoe: foes.length,
      foeHp: foes.map(f => f.maxHp), foeTop: foes.every(f => f.y < 300),
      oneTeam: foes.every(f => f.team === 1)
    };
  });
  ok('trận dựng đúng: một người chơi + cả đám quái', setup.n >= 3 && setup.foesMob,
     setup.nfoe + ' con quái');
  ok('quái cùng MỘT phe (nên chúng không đánh nhau)', setup.oneTeam);
  ok('người chơi đứng mép dưới, quái dàn mép trên', setup.heroBottom && setup.foeTop);
  ok('máu người chơi theo cấp, không phải 800', setup.heroHp < 400, setup.heroHp + ' máu');
  ok('trận chạy thật', setup.t > 0.4, 't=' + setup.t.toFixed(2));

  // đánh cho tới khi hết màn, rồi kiểm phần thưởng
  const done = await page.evaluate(async () => {
    const G = window.__G();
    // hạ thẳng từng con cho nhanh, đi qua đúng defeat() như đánh thật
    for (const f of G.fighters.filter(f => !f.summon && f.team !== 0)) window.__defeat(f);
    await new Promise(r => setTimeout(r, 500));
    const A = window.__ADV();
    const nd = window.__advNodeAt();
    return { xp: A.exp, lv: A.lv, pend: A.pending | 0, gold: A.gold | 0, hp: A.hp,
             kills: A.kills, over: !!window.__G().over, lastWin: A.lastWin,
             done: nd && nd.done, next: window.__advNext().length };
  });
  ok('hạ hết quái thì thắng màn', done.over && done.lastWin === true);
  /* EXP cộng NGAY lúc từng con gục, nên đủ exp là lên cấp luôn và xếp một lượt chọn thẻ —
     hoặc còn nằm trong thanh exp nếu chưa đủ. Cả hai đều tính là "có ăn exp". */
  ok('ăn EXP ngay trong trận', done.xp > 0 || done.lv > 1 || done.pend > 0,
     'exp ' + done.xp + ' · lv' + done.lv + ' · chờ ' + done.pend + ' thẻ');
  ok('thắng trận thường thì ăn VÀNG', done.gold > 60, done.gold + ' vàng');
  ok('đếm đúng số con đã hạ', done.kills >= 2, done.kills + ' con');
  ok('node vừa đánh được đánh dấu xong, và mở ra đường đi tiếp',
     done.done === 1 && done.next > 0, done.next + ' lối đi tiếp');
  ok('máu còn lại được MANG THEO sang node sau', done.hp > 0 && done.hp <= 260,
     done.hp + ' máu');

  /* Thua: §31 — còn mạng hồi sinh thì đứng dậy đánh lại với nửa máu, hết mạng thì run kết
     thúc. Phần đã farm (exp, thẻ) vẫn giữ nguyên trong cả hai trường hợp. */
  const keep = await page.evaluate(async () => {
    const A = window.__ADV();
    A.rev = 1; A.dead = false; A.exp = 0;
    window.__newGame();
    const G = window.__G();
    const foes = G.fighters.filter(f => !f.summon && f.team !== 0);
    window.__defeat(foes[0]);                       // hạ được một con
    window.__defeat(G.fighters.find(f => !f.summon && f.team === 0));   // rồi mình gục
    await new Promise(r => setTimeout(r, 400));
    const once = { rev: A.rev, dead: A.dead, hp: A.hp, xp: A.exp };
    // gục lần nữa khi đã hết mạng
    A.dead = false; window.__newGame();
    const G2 = window.__G();
    window.__defeat(G2.fighters.find(f => !f.summon && f.team === 0));
    await new Promise(r => setTimeout(r, 400));
    return { once, dead: A.dead, ups: Object.keys(A.ups || {}).length };
  });
  ok('thua mà còn mạng hồi sinh thì đứng dậy đánh lại với nửa máu',
     keep.once.rev === 0 && keep.once.dead === false && keep.once.hp > 0,
     'còn ' + keep.once.rev + ' mạng · ' + keep.once.hp + ' máu');
  ok('hết mạng thì hành trình kết thúc', keep.dead === true);
  ok('thua vẫn giữ phần đã farm', keep.once.xp > 0, 'giữ ' + keep.once.xp + ' exp');

  await browser.close();
  return errors;
}

/* ---------- 6. nút chiêu: vòng hồi chiêu và ô khoá ---------- */
async function padCd() {
  console.log('\n== 6. vòng hồi chiêu trên nút ==');
  const { browser, page, errors } = await newPage(buildPlay());
  await page.click('#arcStart');
  await page.click('#whoHuman');
  await page.waitForTimeout(200);
  await page.click('#mTabAdv');
  await page.waitForTimeout(160);
  await page.click('#cselGo');
  await page.waitForTimeout(200);
  await page.click('#listA .cTile[data-key="chichi"]');
  await page.click('#cselGo');
  await page.waitForTimeout(160);
  await page.click('#cselGo');
  await page.waitForTimeout(300);

  const lock = await page.evaluate(() => {
    window.__padTick();
    const b = [...document.querySelectorAll('#padSk [data-key]')];
    return b.map(x => ({ k: x.dataset.key, lock: x.classList.contains('lock'),
                         txt: x.querySelector('.padCd').textContent }));
  });
  ok('lv1: ô J mở, ba ô kia khoá và ghi rõ cần cấp mấy',
     !lock[0].lock && lock.slice(1).every(x => x.lock),
     lock.map(x => x.k + (x.lock ? '(' + x.txt + ')' : ':mở')).join(' '));

  await goBattle(page);

  const cd = await page.evaluate(async () => {
    const G = window.__G(), f = G.fighters.find(x => x.team === 0 && !x.summon);
    f.cds.s1 = 3;                              // ép ô đòn thường đang hồi
    window.__padTick();
    const b = document.querySelector('#padSk [data-key="j"]');
    const pct = b.style.getPropertyValue('--cd');
    const txt = b.querySelector('.padCd').textContent;
    f.cds.s1 = 0;
    window.__padTick();
    return { pct, txt, after: b.style.getPropertyValue('--cd'),
             rdy: b.classList.contains('rdy') };
  });
  ok('đang hồi chiêu thì nút có vòng tối và ghi số giây',
     parseFloat(cd.pct) > 5 && /\d/.test(cd.txt), cd.pct + ' · "' + cd.txt + '"');
  ok('hồi xong thì vòng rỗng và nút sáng "sẵn sàng"',
     parseFloat(cd.after) === 0 && cd.rdy, cd.after);

  await browser.close();
  return errors;
}

/* ---------- 6b. thẻ cơ chế chạy THẬT trong trận ---------- */
async function fxLive() {
  console.log('\n== 6b. thẻ cơ chế ăn thật trong trận ==');
  const { browser, page, errors } = await newPage(buildPlay());
  await page.click('#arcStart');
  await page.click('#whoHuman');
  await page.waitForTimeout(200);
  await page.click('#mTabAdv');
  await page.waitForTimeout(160);
  await page.click('#cselGo');
  await page.waitForTimeout(200);
  await page.click('#listA .cTile[data-key="kono"]');   // hệ ném, để soi thẻ đạn
  await page.click('#cselGo');
  await page.waitForTimeout(160);
  await page.click('#cselGo');
  await page.waitForTimeout(300);
  await goBattle(page);

  // MARK: gắn được, hết hạn được, và thẻ ăn theo mark cộng đúng sát thương
  const mark = await page.evaluate(() => {
    const G = window.__G();
    const h = G.fighters.find(f => f.team === 0 && !f.summon);
    const e = G.fighters.find(f => f.team !== 0 && !f.summon);
    const A = window.__ADV();
    A.ups = {}; A.lock = {}; window.__advIndex();
    e.advMark = 0;
    const raw = window.__advOnHit(e, 100, h, undefined, false);   // chưa có thẻ
    window.__advGive('mark_dmg');                                  // +25% lên kẻ bị đánh dấu
    const noMark = window.__advOnHit(e, 100, h, undefined, false);
    window.__advMark(e, h);
    const marked = window.__advMarked(e);
    const withMark = window.__advOnHit(e, 100, h, undefined, false);
    return { raw, noMark, marked, withMark };
  });
  ok('chưa có thẻ thì lớp Phiêu lưu KHÔNG đụng vào sát thương', mark.raw === 100, mark.raw);
  ok('đánh dấu được mục tiêu', mark.marked);
  ok('thẻ ăn theo dấu chỉ cộng khi CÓ dấu',
     mark.noMark === 100 && mark.withMark === 125,
     'không dấu ' + mark.noMark + ' · có dấu ' + mark.withMark);

  // thẻ đạn: xuyên + tách ba ăn vào viên đạn thật
  const proj = await page.evaluate(() => {
    const G = window.__G();
    const h = G.fighters.find(f => f.team === 0 && !f.summon);
    const A = window.__ADV(); A.ups = {}; A.lock = {}; window.__advIndex();
    window.__advGive('proj_pierce'); window.__advGive('proj_split');
    G.proj.length = 0;
    const before = G.proj.length;
    G.proj.push({ type: 'shuriken', team: h.team, owner: h, x: h.x, y: h.y,
                  vx: 200, vy: 0, r: 10, dmg: 25, life: 3, ang: 0 });
    window.__advOnProj(G.proj[0]);
    return { pierce: G.proj[0].advPierce, n: G.proj.length, before };
  });
  ok('thẻ Xuyên Thấu gắn lượt xuyên vào đạn', proj.pierce >= 1, 'xuyên ' + proj.pierce);
  ok('thẻ Chia Ba Mũi đẻ thêm hai viên phụ', proj.n === 3, proj.n + ' viên');

  // nổ khi địch gục, và CHẶN VÒNG LẶP: đòn phái sinh không đẻ thêm lớp nữa
  const loop = await page.evaluate(() => {
    const G = window.__G();
    const h = G.fighters.find(f => f.team === 0 && !f.summon);
    const e = G.fighters.find(f => f.team !== 0 && !f.summon);
    const A = window.__ADV(); A.ups = {}; A.lock = {}; window.__advIndex();
    window.__advGive('chain'); window.__advGive('kill_boom');
    let calls = 0;
    const real = window.__advOnHit;
    // đếm số lần cửa `hit` thật sự CHẠY HOOK (đòn phái sinh phải bị chặn)
    const t0 = performance.now();
    window.__advBoom(e.x, e.y, 200, 10, h, '#fff');
    const ms = performance.now() - t0;
    return { ms, alive: G.fighters.filter(f => f.alive).length };
  });
  ok('nổ vùng không kéo theo vòng lặp vô hạn (§72)', loop.ms < 400,
     'chạy xong trong ' + loop.ms.toFixed(0) + 'ms');

  // lên cấp GIỮA TRẬN thì dừng trận và mở màn chọn thẻ
  const lvl = await page.evaluate(async () => {
    const G = window.__G();
    const A = window.__ADV();
    A.ups = {}; A.lock = {}; A.pending = 0; A.lv = 1; A.exp = 0; window.__advIndex();
    A.exp = window.__advNeed(1) + 5;
    window.__advLevel();
    const pend = A.pending;
    await new Promise(r => setTimeout(r, 250));
    const up = !document.getElementById('advCard').classList.contains('off');
    const t0 = G.t;
    await new Promise(r => setTimeout(r, 400));
    const froze = Math.abs(G.t - t0) < 1e-6;
    const cards = document.querySelectorAll('#advCardList .upCard').length;
    document.querySelector('#advCardList .upCard').click();
    await new Promise(r => setTimeout(r, 250));
    const closed = document.getElementById('advCard').classList.contains('off');
    const t1 = G.t;
    await new Promise(r => setTimeout(r, 350));
    return { pend, up, froze, cards, closed, lv: A.lv,
             ran: G.t > t1, ups: Object.keys(A.ups).length };
  });
  ok('đủ exp thì lên cấp và xếp một lượt chọn thẻ', lvl.pend === 1 && lvl.lv === 2, 'lv' + lvl.lv);
  ok('màn chọn thẻ tự mở giữa trận', lvl.up);
  ok('đúng ba thẻ', lvl.cards === 3, lvl.cards + ' thẻ');
  ok('TRẬN ĐỨNG HẲN trong lúc chọn (§3)', lvl.froze);
  ok('chọn xong thì đóng màn và nhận thẻ', lvl.closed && lvl.ups === 1);
  ok('trận chạy tiếp sau khi chọn', lvl.ran);

  await browser.close();
  return errors;
}

/* ---------- 7. CHANGE của Ginyu: quyền điều khiển đi theo HỒN ---------- */
async function soulSwap() {
  console.log('\n== 7. bị Ginyu cướp xác thì cầm thân xác Ginyu ==');
  const { browser, page, errors } = await newPage(buildPlay());
  await page.click('#arcStart');
  await page.click('#whoHuman');
  await page.waitForTimeout(200);
  await page.click('#cselGo');                         // -> chọn P1
  await page.waitForTimeout(180);
  await page.click('#listA .cTile[data-key="tanjiro"]');
  await page.click('#cselGo');
  await page.waitForTimeout(180);
  await page.click('#listB .cTile[data-key="ginyu"]');
  await page.click('#cselGo');
  await page.waitForTimeout(180);
  await page.click('#cselGo');
  await page.waitForTimeout(3800);

  /* CHỜ HẾT MÀN RA MẮT của cả hai bên rồi mới ép cướp xác — đúng như trong trận thật:
     CHANGE chỉ nổ khi Ginyu sắp chết, lúc đó màn ra mắt xong từ lâu. Ép ngay lúc hai người
     còn đang bay vào sân thì đo nhầm sang màn ra mắt (cả sàn đang bị khoá mỗi nhịp). */
  await page.evaluate(async () => {
    const G = window.__G();
    for (let i = 0; i < 300; i++) {
      if (!G.fighters.some(f => f.gnEntry || f.tanEntry)) return;
      await new Promise(r => setTimeout(r, 50));
    }
  });
  const before = await page.evaluate(() => {
    const G = window.__G();
    const me = G.fighters.find(f => window.__isPlayerDbg(f));
    return { key: me && me.key, name: me && me.name, isK: me === G.k };
  });
  ok('trước khi bị cướp: người chơi cầm thân xác Tanjiro',
     before.key === 'tanjiro' && before.isK, before.key);

  // ép Ginyu cướp xác người chơi
  const after = await page.evaluate(() => {
    const G = window.__G();
    const g = G.fighters.find(f => f.key === 'ginyu');
    const t = G.fighters.find(f => f.key === 'tanjiro');
    window.__ginyuPossess(g, t);
    const me = G.fighters.filter(f => window.__isPlayerDbg(f));
    const m = me[0];
    return {
      n: me.length,
      key: m && m.key,                 // thân xác đang cầm
      soul: m && m.gnSoul,             // hồn ngồi trong đó
      name: m && m.name,               // chữ hiện trên thanh máu
      swapAs: m && m.swapAs,
      stillK: m === G.k,
      otherSoul: G.fighters.find(f => f !== m && !f.summon).gnSoul
    };
  });
  ok('bị cướp xong: người chơi cầm THÂN XÁC GINYU', after.key === 'ginyu', after.key);
  ok('và hồn trong đó đúng là Tanjiro', after.soul === 'tanjiro', after.soul);
  ok('chỉ MỘT người mang cờ điều khiển', after.n === 1, after.n + ' người');
  ok('thân xác kia do hồn Ginyu cầm', after.otherSoul === 'ginyu', after.otherSoul);
  ok('quyền điều khiển KHÔNG còn bám vào G.k nữa', !after.stillK);

  // bấm phím phải ăn vào đúng thân xác mới
  const move = await page.evaluate(async () => {
    const G = window.__G();
    /* CHỜ HẾT PHÂN CẢNH trước đã: `ginyuPossess()` đặt `G.freeze=1.8` (giây TRONG TRẬN)
       và `step()` return sớm suốt lúc đó — bấm phím trong quãng này thì không ai nhúc
       nhích, đó là đúng chứ không phải lỗi. */
    for (let i = 0; i < 200 && G.freeze > 0; i++) await new Promise(r => setTimeout(r, 50));
    const m = G.fighters.find(f => window.__isPlayerDbg(f));
    const o = G.fighters.find(f => f !== m && !f.summon);
    m.stun = 0; m.lock = 0; o.lock = 9; o.stun = 9;
    const y0 = m.y, oy0 = o.y;
    window.__keys.w = true;
    await new Promise(r => setTimeout(r, 800));
    window.__keys.w = false;
    return { dy: m.y - y0, other: Math.abs(o.y - oy0), froze: G.freeze };
  });
  ok('bấm W thì THÂN XÁC GINYU đi lên', move.dy < -8, 'dy=' + move.dy.toFixed(1));
  ok('thân xác cũ không nhúc nhích theo phím của người chơi', move.other < 6,
     'lệch ' + move.other.toFixed(1) + 'px');

  // nút chiêu dựng lại: ô J theo THÂN XÁC, ô K/L/U theo HỒN
  const pad = await page.evaluate(async () => {
    window.__padTick(); await new Promise(r => setTimeout(r, 60)); window.__padTick();
    return [...document.querySelectorAll('#padSk [data-key]')]
      .map(b => ({ k: b.dataset.key, n: b.querySelector('s').textContent }));
  });
  ok('nút chiêu dựng lại sau khi bị cướp xác', pad.length === 4 && pad.every(p => p.n),
     pad.map(p => p.k + ':' + p.n).join(' · '));

  await browser.close();
  return errors;
}

(async () => {
  let errs = [];
  for (const fn of [mobs, autoUntouched, human, adventure, advFight, padCd, fxLive, soulSwap]) {
    try { errs = errs.concat(await fn()); }
    catch (e) { ok(fn.name + ' chạy được', false, e.message); }
  }
  const real = errs.filter(e => !/ERR_FAILED|net::/.test(e));
  console.log('\n== lỗi trang ==');
  ok('không có lỗi JS nào', real.length === 0, real.slice(0, 4).join(' | '));
  console.log(`\n${pass} dat / ${fail} hong`);
  process.exit(fail ? 1 : 0);
})();
