/* Chạy đủ 66 cặp đấu (55 cặp khác nhau + 11 trận gương) song song, xem có trận nào
   ném lỗi trang không và các cơ chế lớn có thật sự nổ ra không.
   Chạy: node tools/t_reg.js */
const { build, playwright } = require('./probe');

const K = ['kono', 'chichi', 'tsubasa', 'shika', 'suzune', 'ginyu', 'dora', 'superman', 'beatrice', 'tanjiro', 'sakura'];
const MOC = 60;          // giây trong trận, đủ để một trận ngã ngũ

(async () => {
  const file = build();
  const { chromium } = playwright();
  const browser = await chromium.launch();

  const pairs = [];
  for (let i = 0; i < K.length; i++) for (let j = i; j < K.length; j++) pairs.push([K[i], K[j]]);

  const run = async ([a, c]) => {
    const page = await browser.newPage({ viewport: { width: 700, height: 960 } });
    await page.route('**://fonts.*/**', r => r.abort());
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + file, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.click(`#listA .cTile[data-key="${a}"]`);
    await page.click(`#listB .cTile[data-key="${c}"]`);
    await page.click('#cselGo');
    await page.selectOption('#speed', '1');       // chạy nhanh cho đỡ tốn thời gian thật
    await page.click('#play');

    const r = await page.evaluate(moc => new Promise(res => {
      const G = window.__G(), t0 = G.t, seen = new Set();
      const xong = () => res({ over: G.over, t: +(G.t - t0).toFixed(0), seen: [...seen] });
      /* Đánh tự nhiên thì hiếm khi kịp tụt xuống máu thấp trong lúc chạy headless,
         mà mấy cơ chế dễ vỡ nhất lại nằm hết ở đó. Nên ép máu xuống theo hai chặng:
         18% để gọi Pre-Wings / viện binh / lãnh địa, rồi 8% để gọi Wings of the Eagle. */
      let chang = 0;
      const id = setInterval(() => {
        const troi = G.t - t0;
        if (chang === 0 && troi > 8) { chang = 1; for (const f of G.fighters) f.hp = Math.min(f.hp, f.maxHp * .18); }
        if (chang === 1 && troi > 16) { chang = 2; for (const f of G.fighters) f.hp = Math.min(f.hp, f.maxHp * .08); }
        /* Chặng thứ ba, chỉ dành cho Captain Ginyu: chiêu 4 của anh chỉ nổ khi máu chạm 0,
           mà ép máu theo tỉ lệ thì không bao giờ tới. Đánh thẳng một đòn chí mạng vào anh. */
        if (chang === 2 && troi > 22) {
          chang = 3;
          const g = G.fighters.find(f => f.key === 'ginyu' && !f.summon && !f.swapAs && !f.gnChangeDone);
          if (g) window.__hurt(g, 99999, G.fighters.find(f => f !== g && f.team !== g.team));
          const dd = G.fighters.find(f => f.key === 'dora' && !f.summon && !f.tmDone);
          if (dd) { dd.edCd = 999; window.__hurt(dd, 99999, G.fighters.find(f => f !== dd && f.team !== dd.team)); }
        }
        for (const f of G.fighters) {
          if (f.lazy) seen.add('lazy');
          if (f.bind) seen.add('bind');
          if (f.domain) seen.add('forest');
          if (f.weak) seen.add('weak');
          if (f.dash && f.dash.kind === 'stab') seen.add('stab');
          if (f.eagle) seen.add('eagle');
          if (f.prewing) seen.add('prewing');
          if (f.summon) seen.add('summon');
          if (f.exhaust > 0) seen.add('exhaust');
          if (f.ayaG) seen.add('aya-guard');
          if (f.ally) seen.add('aya-ally');
          if (f.key === 'suzune' && f.form >= 2) seen.add('suz-f2');
          if (f.key === 'suzune' && f.form >= 3) seen.add('suz-f3');
          if (f.decT > 0) seen.add('decision');
          if (f.gnEntry) seen.add('ginyu-entry');
          if (f.gnState === 'atk') seen.add('ginyu-excited');
          if (f.gnState === 'def') seen.add('ginyu-probing');
          if (f.gnDaze > 0) seen.add('ginyu-daze');
          if (f.gnRage > 0) seen.add('ginyu-rage');
          if (f.gnTired > 0) seen.add('ginyu-tired');
          if (f.gnFlash) seen.add('ginyu-flash');
          if (f.gnChange) seen.add('ginyu-change');
          if (f.gnPanic) seen.add('ginyu-panic');
          if (f.swapAs === 'ginyu') seen.add('ginyu-swap');
          if (f.drEntry) seen.add('dora-entry');
          if (f.copter > 0) seen.add('dora-copter');
          if (f.edT > 0) seen.add('dora-door');
          if (f.dis > 0) seen.add('dora-disoriented');
          if (f.shrunk > 0) seen.add('dora-shrunk');
          if (f.drAim) seen.add('dora-aim');
          if (f.drCombo) seen.add('dora-combo');
          if (f.tm) seen.add('dora-time');
          if (f.fk > 0) seen.add('dora-future');
          if (f.supEntry) seen.add('sup-entry');
          if (f.supFly > 0) seen.add('sup-flight');
          if (f.lsr > 0) seen.add('sup-resolve');
          if (f.fatigue > 0) seen.add('sup-fatigue');
          if (f.supHv) seen.add('sup-heat');
          if (f.supFb) seen.add('sup-freeze');
          if (f.supMs) seen.add('sup-meteor');
          if (f.supMsDown > 0) seen.add('sup-down');
          if (f.supCombo) seen.add('sup-combo');
          if (f.frozen > 0) seen.add('frozen');
          if (f.chill > 0) seen.add('chilled');
          if (f.beaEntry) seen.add('bea-entry');
          if (f.beaShamac) seen.add('bea-shamac');
          if (f.beaWarp) seen.add('bea-warp');
          if (f.beaWeak > 0) seen.add('bea-weak');
          if (f.beaMurak > 0) seen.add('bea-murak');
          if (f.beaEmt > 0) seen.add('bea-emt');
          if (f.beaUlt) seen.add('bea-ult');
          if (f.beaSlow > 0) seen.add('bea-slow');
          if (f.dots && f.dots.some(d => d && d.bea)) seen.add('bea-erosion');
          if (f.tanEntry) seen.add('tan-entry');
          if (f.tanMarked) seen.add('tan-mark');
          if (f.key === 'sakura' && !f.swapAs) {
            if (f.sakCrack) seen.add('sak-burst');
            if (f.dash && f.dash.kind === 'sakcharge') seen.add('sak-charge');
            if (f.sakHeal) seen.add('sak-heal');
            if (f.sakSeal > 0) seen.add('sak-byakugo');
          }
          if (f.sakHamper > 0) seen.add('sak-hampered');
          if (f.sakDisrupt > 0) seen.add('sak-disruption');
          if (f.katsuyu > 0) seen.add('sak-katsuyu');
          if (f.dots && f.dots.some(d => d && d.sakIb)) seen.add('sak-internal-bleeding');
          if (f.tanAct && f.tanAct.kind === 'ultimate') seen.add('tan-ultimate');
          if (f.tanRed > 0) seen.add('tan-red-blade');
          if (f.regenSupp > 0) seen.add('tan-regen-suppression');
        }
        if (G.over || G.t - t0 > moc) { clearInterval(id); xong(); }
      }, 60);
      setTimeout(() => { clearInterval(id); xong(); }, 45000);   // chặn treo
    }), MOC);

    await page.close();
    return { a, c, ...r, errors };
  };

  /* Chạy theo từng đợt chứ đừng mở cả 55 trang một lúc: máy test không có GPU, mở hết
     cùng lúc thì mỗi trận chỉ trôi được 1~2 giây trong trận và mấy cơ chế máu thấp không
     kịp nổ ra — nhìn thì vẫn "sạch lỗi" nhưng chẳng kiểm được gì. */
  const LO = 5;
  const out = [];
  for (let i = 0; i < pairs.length; i += LO) {
    out.push(...await Promise.all(pairs.slice(i, i + LO).map(run)));
  }
  let hong = 0;
  for (const r of out) {
    if (r.errors.length) hong++;
    console.log(
      `${(r.a + ' vs ' + r.c).padEnd(20)} ` +
      `${r.over ? 'ket thuc' : 'con danh'} ${String(r.t).padStart(3)}s | ` +
      `${r.seen.join(',') || '-'} | ` +
      `${r.errors.length ? 'LOI: ' + r.errors[0] : 'khong loi'}`
    );
  }
  await browser.close();
  console.log(hong ? `HONG: ${hong}/${out.length} tran co loi trang` : `DAT: ${out.length}/${out.length} tran sach loi`);
  process.exit(hong ? 1 : 0);
})();
