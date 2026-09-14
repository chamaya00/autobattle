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
             stage: A && A.stage, sp: A && A.sp, sxp: A && A.sxp,
             maxHp: window.__advMaxHp(), hp0: window.__ADV_HP0(),
             rows: document.querySelectorAll('#advBody .advRow').length,
             cells: document.querySelectorAll('#advBody .advCell').length,
             stages: window.__ADV_STAGES() };
  });
  ok('bảng hành trình mở ra', board.up);
  ok('bắt đầu ở cấp 1, màn 1, chưa có điểm nào',
     board.lv === 1 && board.stage === 1 && board.sp === 0 && board.sxp === 0,
     'lv' + board.lv + ' màn' + board.stage);
  ok('lv1 máu THẤP hẳn (không đọc HP 800 của bảng chuẩn)',
     board.maxHp === board.hp0, board.maxHp + ' máu');
  ok('bảng có đủ hàng thuộc tính + chiêu', board.rows >= 8, board.rows + ' hàng');
  ok('dải màn đủ ' + board.stages + ' ô', board.cells === board.stages, board.cells + ' ô');

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

  // bảng màn: cứ màn thứ 4 là boss, còn lại là quái
  const road = await page.evaluate(() => {
    const out = [];
    for (let i = 1; i <= window.__ADV_STAGES(); i++) {
      const d = window.__advStageDef(i);
      out.push({ i, boss: d.boss, n: d.enemies.length, mob: d.enemies.every(window.__isMobKey) });
    }
    return out;
  });
  const bossAt = road.filter(r => r.boss).map(r => r.i);
  ok('boss đúng ở mỗi màn thứ 4', bossAt.join(',') === '4,8,12,16,20,24', bossAt.join(','));
  ok('màn thường toàn QUÁI, màn boss là NHÂN VẬT',
     road.every(r => r.boss ? !r.mob && r.n === 1 : r.mob && r.n >= 2));
  const grow = road.filter(r => !r.boss).map(r => r.n);
  ok('càng về sau càng đông quái', grow[grow.length - 1] > grow[0],
     grow[0] + ' -> ' + grow[grow.length - 1] + ' con');

  // quái và boss mạnh dần
  const scale = await page.evaluate(() => ({
    hp1: window.__advMobHp(1), hp10: window.__advMobHp(10),
    dmg1: window.__advMobDmg(1), dmg10: window.__advMobDmg(10),
    b4: window.__advBossHp(4), b24: window.__advBossHp(24)
  }));
  ok('quái mạnh dần theo màn', scale.hp10 > scale.hp1 * 2 && scale.dmg10 > scale.dmg1,
     'máu ×' + scale.hp1 + ' -> ×' + scale.hp10.toFixed(2));
  ok('boss đầu nhẹ hơn boss cuối', scale.b4 < scale.b24 && scale.b24 <= 1,
     '×' + scale.b4.toFixed(2) + ' -> ×' + scale.b24.toFixed(2));

  /* SÁT THƯƠNG của boss cũng phải lên dần, không chỉ máu. Boss là nhân vật thật nên bộ chiêu
     của họ cân theo 800 máu, trong khi người chơi ở màn 4 mới có ~370 — hạ máu boss mà để
     nguyên sát thương thì họ vẫn ba đòn là xong. Đo được trước khi sửa: ChiChi thua liền ba
     boss ở màn 4 · 8 · 12; sau khi cắt còn 10/11 thắng. */
  const bd = await page.evaluate(() => {
    const A = window.__ADV(); A.stage = 4;
    const f = { team: 1, summon: false, mob: false, moveMul: 1, castMul: 1, dmgOut: 1 };
    window.__advStatTick(f);
    const boss4 = f.dmgOut;
    A.stage = 24;
    const g = { team: 1, summon: false, mob: false, moveMul: 1, castMul: 1, dmgOut: 1 };
    window.__advStatTick(g);
    // viện binh của boss (Goku / Gohan) phải chịu ĐÚNG phần cắt đó qua master
    A.stage = 8;
    const m = { team: 1, summon: false, mob: false };
    const sm = { team: 1, summon: true, master: m, dmgOut: 1 };
    window.__advStatTick(sm);
    // quái thì KHÔNG bị cắt (máu/dmg của chúng đã scale riêng qua advMobDmg)
    A.stage = 4;
    const mob = { team: 1, summon: false, mob: true, dmgOut: 1 };
    window.__advStatTick(mob);
    A.stage = 1;
    return { boss4, boss24: g.dmgOut, summon: sm.dmgOut, mob: mob.dmgOut,
             want4: window.__advBossDmg(4), want8: window.__advBossDmg(8) };
  });
  ok('boss ăn đúng phần cắt sát thương theo màn',
     Math.abs(bd.boss4 - bd.want4) < 1e-9 && bd.boss4 < bd.boss24 && bd.boss24 <= 1.0001,
     '×' + bd.boss4.toFixed(2) + ' -> ×' + bd.boss24.toFixed(2));
  ok('viện binh của boss (Goku / Gohan) cũng bị cắt qua master',
     Math.abs(bd.summon - bd.want8) < 1e-9, '×' + bd.summon.toFixed(2));
  ok('quái KHÔNG bị cắt hai lần (dmg của chúng đã scale riêng)', bd.mob === 1, '×' + bd.mob);

  // ăn exp -> lên cấp -> có điểm thuộc tính
  const lvUp = await page.evaluate(() => {
    const A = window.__ADV();
    A.exp = window.__advNeed(1) + window.__advNeed(2);
    const ups = window.__advLevel();
    return { ups, lv: A.lv, sp: A.sp, per: window.__ADV_SP() };
  });
  ok('đủ exp thì lên NHIỀU cấp một lượt', lvUp.ups === 2 && lvUp.lv === 3, '+' + lvUp.ups + ' cấp');
  ok('mỗi cấp cho ' + lvUp.per + ' điểm thuộc tính', lvUp.sp === lvUp.ups * lvUp.per, lvUp.sp + ' điểm');

  // tiêu điểm thuộc tính -> ăn vào hệ số thật
  const stat = await page.evaluate(() => {
    const A = window.__ADV();
    const before = A.sp;
    const okBuy = window.__advBuyStat('pow');
    const f = { team: 0, summon: false, moveMul: 1, castMul: 1, dmgOut: 1 };
    window.__advStatTick(f);
    return { okBuy, spent: before - A.sp, pow: A.st.pow, dmgOut: f.dmgOut,
             maxBefore: window.__advMaxHp() };
  });
  ok('mua điểm thuộc tính trừ đúng một điểm', stat.okBuy && stat.spent === 1 && stat.pow === 1);
  ok('điểm Sức mạnh ăn vào sát thương thật', stat.dmgOut > 1.01, 'dmgOut=' + stat.dmgOut.toFixed(3));

  const vit = await page.evaluate(() => {
    const A = window.__ADV(), b = window.__advMaxHp();
    A.sp += 3; window.__advBuyStat('vit');
    return { b, a: window.__advMaxHp() };
  });
  ok('điểm Thể lực nâng máu tối đa', vit.a > vit.b, vit.b + ' -> ' + vit.a);

  // điểm skill -> mở chiêu -> bấm được
  const sk = await page.evaluate(() => {
    const A = window.__ADV();
    A.lv = 9; A.sxp = 0;
    const poor = window.__advBuySkill('k');       // chưa có điểm thì không mua được
    A.sxp = 40;
    const buy = window.__advBuySkill('k');
    const r1 = window.__advRank('k');
    window.__keys.k = true; window.__advLockKeys();
    const pressOk = window.__keys.k === true; window.__keys.k = false;
    const up = window.__advBuySkill('k');
    return { poor, buy, r1, r2: window.__advRank('k'), pressOk, up, sxp: A.sxp };
  });
  ok('không đủ điểm skill thì không mở được', sk.poor === false);
  ok('mở chiêu bằng điểm skill', sk.buy === true && sk.r1 === 1);
  ok('mở rồi thì bấm ăn ngay', sk.pressOk);
  ok('nâng bậc tiếp được', sk.up === true && sk.r2 === 2, 'bậc ' + sk.r2);

  // bậc chiêu làm ô đó hồi nhanh hơn, và KHÔNG ăn sang ô khác
  const rate = await page.evaluate(() => {
    const f = { team: 0, summon: false };
    return { s2: window.__advSlotRate(f, 's2'), s3: window.__advSlotRate(f, 's3'),
             s1: window.__advSlotRate(f, 's1'), cut: window.__ADV_RANKCD() };
  });
  ok('bậc chiêu làm ĐÚNG ô đó hồi nhanh hơn', rate.s2 > 1 && rate.s3 === 1 && rate.s1 === 1,
     's2=' + rate.s2.toFixed(2) + ' s3=' + rate.s3 + ' s1(đòn thường)=' + rate.s1);

  // chưa đủ cấp thì không mở được ô cao
  const gateLv = await page.evaluate(() => {
    const A = window.__ADV();
    A.lv = 1; A.sxp = 99; A.sk.u = 0;
    const no = window.__advBuySkill('u');
    A.lv = 9;
    const yes = window.__advBuySkill('u');
    return { no, yes };
  });
  ok('chưa đủ cấp thì ô chiêu cao vẫn khoá dù thừa điểm', gateLv.no === false && gateLv.yes === true);

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
  await page.click('#advGo');                 // -> hỏi sàn
  await page.waitForTimeout(250);
  const asked = await page.$eval('#arcStage', e => !e.classList.contains('off'));
  ok('vào màn thì hỏi sàn trước (đúng lối mỗi trận một sàn)', asked);
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
    return { xp: A.exp, sxp: A.sxp, stage: A.stage, kills: A.kills,
             over: !!window.__G().over, lastWin: A.lastWin };
  });
  ok('hạ hết quái thì thắng màn', done.over && done.lastWin === true);
  ok('ăn EXP và điểm skill', done.xp > 0 && done.sxp > 0, 'exp ' + done.xp + ' · skill ' + done.sxp);
  ok('đếm đúng số con đã hạ', done.kills >= 2, done.kills + ' con');
  ok('thắng thì sang màn kế tiếp', done.stage === 2, 'màn ' + done.stage);

  // thua vẫn giữ phần đã farm
  const keep = await page.evaluate(async () => {
    const A = window.__ADV();
    A.stage = 5; A.exp = 0; A.sxp = 0;
    window.__newGame();
    const G = window.__G();
    const foes = G.fighters.filter(f => !f.summon && f.team !== 0);
    window.__defeat(foes[0]);                       // hạ được một con
    const mid = { xp: G.advXp, sxp: G.advSxp };
    window.__defeat(G.fighters.find(f => !f.summon && f.team === 0));   // rồi mình gục
    await new Promise(r => setTimeout(r, 400));
    return { mid, xp: A.exp, sxp: A.sxp, stage: A.stage, win: A.lastWin };
  });
  ok('thua thì KHÔNG sang màn mới', keep.win === false && keep.stage === 5, 'màn ' + keep.stage);
  ok('nhưng vẫn giữ phần đã farm', keep.xp > 0, 'giữ ' + keep.xp + ' exp');

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

  await page.click('#advGo');
  await page.waitForTimeout(220);
  await page.click('#arcStageGo');
  await page.waitForTimeout(3800);

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

(async () => {
  let errs = [];
  for (const fn of [mobs, autoUntouched, human, adventure, advFight, padCd]) {
    try { errs = errs.concat(await fn()); }
    catch (e) { ok(fn.name + ' chạy được', false, e.message); }
  }
  const real = errs.filter(e => !/ERR_FAILED|net::/.test(e));
  console.log('\n== lỗi trang ==');
  ok('không có lỗi JS nào', real.length === 0, real.slice(0, 4).join(' | '));
  console.log(`\n${pass} dat / ${fail} hong`);
  process.exit(fail ? 1 : 0);
})();
