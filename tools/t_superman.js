/* Superman — soi đủ năm mảng làm nên nhân vật:
     1. màn xuất hiện: bóng người trên cao rồi bay xuống, đúng 1.5 giây người chơi, bốn
        pha, địch chỉ được đứng chờ, và cú tiếp đất KHÔNG gây sát thương hay choáng;
     2. nội tại: Man of Steel (giảm 20% dmg vật lý, burn ăn đủ, trần 60%, giảm lực đẩy
        và thời gian choáng, đòn dưới 25 dmg không làm ngã), Kryptonian Flight,
        Last Son's Resolve rồi Solar Fatigue;
     3. bốn chiêu: combo 26/26/38 cách nhau 0.55s, Heat Vision 4×17 + Burning,
        Freeze Breath (Frozen / Chilled / vỡ băng ở 100 dmg), Meteor Strike 109+23
        (147 khi địch đang Frozen) với vùng chấn động là AoE nhạt dần theo khoảng
        cách, đánh trượt thì nằm 1.3 giây;
     4. trần khống chế cứng 3.5 giây, phần thừa đổi thành làm chậm 40%;
     5. chữ hiển thị đều bằng tiếng Anh.
   Chạy: node tools/t_superman.js */
const { openGame } = require('./probe');

const out = [];
let fail = 0;
function ok(name, pass, note) {
  out.push(`${pass ? 'DAT ' : 'HONG'}  ${name}${note ? '  — ' + note : ''}`);
  if (!pass) fail++;
}

(async () => {
  /* ---------- trận 1: Superman vs ChiChi ---------- */
  {
    const { browser, page, errors } = await openGame('superman', 'chichi', { play: false });

    const before = await page.evaluate(() => {
      const G = window.__G(), f = G.fighters.find(x => x.key === 'superman');
      return { hide: !!f.supHide, entry: !!f.supEntry, hp: f.maxHp, air: f.supAir,
               speed: f.speed, r: f.r };
    });
    ok('máu tối đa đúng 800', before.hp === 800, `${before.hp} HP`);
    ok('chưa bấm Bắt đầu thì Superman chưa đứng trên sàn, mới là bóng người trên cao',
      before.entry && before.hide && before.air > 100, `supAir=${before.air}`);

    const spd = await page.evaluate(() => {
      const C = window.__CHARS;
      /* Trung bình của NHÂN VẬT CHƠI ĐƯỢC. `CHARS` giờ còn chứa quái của chế độ Phiêu lưu
         (chúng chậm hẳn: 46~124) nên đọc `Object.keys(CHARS)` là kéo tụt trung bình xuống
         và Superman đọc ra nhanh hơn cả bảng tới +16%. `CKEYS` là danh sách đã lọc. */
      const others = window.__CKEYS().filter(k => k !== 'superman').map(k => C[k].speed);
      return { sup: C.superman.speed, avg: others.reduce((a, b) => a + b, 0) / others.length };
    });
    ok('chạy nhanh hơn mức trung bình của cả bảng khoảng 10%',
      spd.sup / spd.avg > 1.06 && spd.sup / spd.avg < 1.15,
      `${spd.sup} so với trung bình ${spd.avg.toFixed(1)} (+${((spd.sup / spd.avg - 1) * 100).toFixed(1)}%)`);

    await page.click('#play');
    await page.selectOption('#speed', '1');

    const ent = await page.evaluate(() => new Promise(res => {
      const G = window.__G(), SUP = window.__SUP;
      const f = G.fighters.find(x => x.key === 'superman'), e = G.fighters.find(x => x !== f);
      const eHp = e.hp, ex = e.x, ey = e.y;
      let shadowEnd = -1, landAt = -1, endAt = -1, foeFree = 0, foeMoved = 0, foeHurt = 0, foeStun = 0;
      let airTop = 0;
      const id = setInterval(() => {
        if (f.supEntry) {
          const t = f.supEntry.t;
          airTop = Math.max(airTop, f.supAir);
          if (!(e.lock > 0)) foeFree++;
          foeMoved = Math.max(foeMoved, Math.hypot(e.x - ex, e.y - ey));
          foeHurt = Math.max(foeHurt, eHp - e.hp);
          foeStun = Math.max(foeStun, e.stun);
          if (!f.supHide && shadowEnd < 0) shadowEnd = t;
          if (f.pose === 'land' && landAt < 0) landAt = t;
        } else if (endAt < 0) {
          endAt = G.t;
          clearInterval(id);
          res({ shadowEnd: +shadowEnd.toFixed(3), landAt: +landAt.toFixed(3),
                foeFree, foeMoved: +foeMoved.toFixed(1), foeHurt: +foeHurt.toFixed(1),
                foeStun: +foeStun.toFixed(2), airTop: +airTop.toFixed(0),
                ph: SUP.entPh, tot: SUP.entT, RT: window.__RT });
        }
      }, 8);
      setTimeout(() => { clearInterval(id); res({ timeout: 1 }); }, 60000);
    }));
    /* Máy test không có GPU nên mỗi lượt vẽ trôi cả một chặng thời gian trong trận:
       đo mốc pha thì chỉ chốt được "nằm trong pha nào", không chốt được tới phần trăm
       giây. Vì vậy kiểm theo ranh giới pha chứ đừng kiểm sát từng con số. */
    ok('bóng người trên cao chỉ có ở pha 1 (0 → 0.4 giây người chơi)',
      ent.shadowEnd >= ent.ph[0] - .02 && ent.shadowEnd < ent.ph[1],
      `hiện rõ người ở giây ${(ent.shadowEnd * ent.RT).toFixed(2)} người chơi (pha 1 hết ở 0.40, pha 2 hết ở 1.00)`);
    ok('tiếp đất bằng một chân ở pha 3 (1 → 1.3 giây người chơi)',
      ent.landAt >= ent.ph[1] - .02 && ent.landAt < ent.ph[2],
      `dáng tiếp đất từ giây ${(ent.landAt * ent.RT).toFixed(2)} người chơi (pha 3: 1.00 → 1.30)`);
    ok('cả màn xuất hiện dài đúng 1.5 giây người chơi',
      Math.abs(ent.tot * ent.RT - 1.5) < .001, `SUP.entT = ${(ent.tot * ent.RT).toFixed(2)}s người chơi`);
    ok('đối phương chỉ được đứng chờ suốt màn xuất hiện',
      ent.foeFree === 0, `${ent.foeFree} nhịp không bị khoá, xê dịch ${ent.foeMoved}px`);
    ok('cú tiếp đất không gây sát thương và không choáng ai',
      ent.foeHurt === 0 && ent.foeStun === 0, `địch mất ${ent.foeHurt} máu, choáng ${ent.foeStun}s`);

    // từ đây trở đi dừng trận lại: mọi phép đo chạy bằng cách gọi thẳng vào ruột game
    await page.click('#play');

    /* ---- nội tại Man of Steel ---- */
    const steel = await page.evaluate(() => {
      const G = window.__G(), SUP = window.__SUP;
      const s = G.fighters.find(f => f.key === 'superman'), e = G.fighters.find(f => f !== s);
      const take = (amt, kind) => { s.hp = s.maxHp; window.__hurt(s, amt, e, false, kind); return +(s.maxHp - s.hp).toFixed(2); };
      const phys = take(100);
      const dot = take(100, 'dot');
      const dom = take(100, 'domain');
      s.dmgRes = .9; const capped = take(100); s.dmgRes = 0;
      s.lsr = 99; const lsr = take(100); s.lsr = 0;
      s.supMsDown = 99; const down = take(100); s.supMsDown = 0;
      s.pose = 'idle'; s.poseT = 0; take(20); const lightPose = s.pose;
      s.pose = 'idle'; s.poseT = 0; take(60); const heavyPose = s.pose;
      s.stun = 0; window.__stunFx(s, 1, 'spark'); const stun = +s.stun.toFixed(3);
      s.stun = 0; window.__stunFx(s, 1, 'ice'); const ice = +s.stun.toFixed(3); s.stun = 0;
      const kb = +window.__supKbTake(s).toFixed(3);
      s.supFly = 99; const kbFly = +window.__supKbTake(s).toFixed(3); s.supFly = 0;
      s.lsr = 99; const kbLsr = +window.__supKbTake(s).toFixed(3); s.lsr = 0;
      // choáng vẫn dính, không có chuyện miễn nhiễm hoàn toàn
      s.stun = 0; const stunLands = window.__stunFx(s, 2, 'spark') && s.stun > 0; s.stun = 0;
      s.hp = s.maxHp;
      return { phys, dot, dom, capped, lsr, down, lightPose, heavyPose, stun, ice, kb, kbFly, kbLsr, stunLands };
    });
    ok('100 raw damage vào người thì chỉ mất đúng 80',
      steel.phys === 80, `mất ${steel.phys}`);
    ok('burn / poison / true damage vẫn ăn đủ 100',
      steel.dot === 100 && steel.dom === 100, `dot ${steel.dot} · domain ${steel.dom}`);
    ok('tổng giảm sát thương không bao giờ vượt 60%, kể cả khi được buff thêm',
      steel.capped === 40, `nhận buff giảm 90% mà vẫn mất ${steel.capped}`);
    ok("Last Son's Resolve nâng giảm sát thương lên đúng 30%",
      steel.lsr === 70, `mất ${steel.lsr}`);
    ok('nằm sau cú Meteor Strike hụt: Man of Steel tụt còn 10%',
      steel.down === 90, `mất ${steel.down}`);
    ok('đòn dưới 25 dmg không làm Superman ngã người ra',
      steel.lightPose === 'idle' && steel.heavyPose === 'hurt',
      `20 dmg -> dáng "${steel.lightPose}", 60 dmg -> dáng "${steel.heavyPose}"`);
    ok('choáng do va chạm vật lý ngắn lại 15%, còn băng thì không dính luật này',
      Math.abs(steel.stun - .85) < .001 && Math.abs(steel.ice - 1) < .001,
      `choáng 1s -> ${steel.stun}s · băng 1s -> ${steel.ice}s`);
    ok('vẫn dính choáng bình thường, không miễn nhiễm hoàn toàn với khống chế',
      steel.stunLands === true);
    ok('giảm 35% lực đẩy, bay thì thêm 50%, gồng Resolve thì thêm 25%',
      Math.abs(steel.kb - .65) < .001 && Math.abs(steel.kbFly - .325) < .001 &&
      Math.abs(steel.kbLsr - .4875) < .001,
      `nền ${steel.kb} · bay ${steel.kbFly} · resolve ${steel.kbLsr}`);

    /* ---- chiêu 1: combo ba đòn ---- */
    const combo = await page.evaluate(() => {
      const G = window.__G(), SUP = window.__SUP;
      const s = G.fighters.find(f => f.key === 'superman'), e = G.fighters.find(f => f !== s);
      s.supHv = null; s.supFb = null; s.supMs = null; s.supFly = 0; s.supEntry = null;
      s.cds = { s1: 0, s2: 99, s3: 99, s4: 99 };
      e.maxHp = 99999; e.hp = e.maxHp; e.stun = 0; e.evade = 0; e.supCcAcc = 0; e.supCcT = 0;
      e.x = s.x + 50; e.y = s.y; e.kbx = 0; e.kby = 0;
      const dt = 1 / 120;
      const hits = []; let prev = e.hp, kb = 0, stun = 0;
      window.__supCombo(s, e);
      for (let i = 0; i < 600 && (s.supCombo || hits.length < 3); i++) {
        e.x = s.x + 50; e.y = s.y; e.stun = 0;      // giữ nguyên tầm để combo chạy đủ ba đòn
        G.t += dt;
        window.__supermanTick(s, dt);
        if (e.hp < prev) {
          hits.push({ dmg: +(prev - e.hp).toFixed(1), t: +(i * dt).toFixed(3) });
          prev = e.hp;
          if (hits.length === 3) { kb = Math.hypot(e.kbx, e.kby); stun = e.stun; }
        }
      }
      return { hits, kb: +kb.toFixed(1), stun: +stun.toFixed(3), cd: +s.cds.s1.toFixed(3),
               W: window.__WH().W, SUP: { hit: SUP.hit, gap: SUP.hitGap, cd: SUP.hitCd, stun: SUP.upStun, kb: SUP.upKb },
               RT: window.__RT };
    });
    ok('combo đúng ba đòn 26 / 26 / 38 = 90 dmg',
      combo.hits.length === 3 && combo.hits[0].dmg === 26 && combo.hits[1].dmg === 26 &&
      combo.hits[2].dmg === 38,
      combo.hits.map(h => h.dmg).join(' + ') + ' = ' + combo.hits.reduce((a, b) => a + b.dmg, 0));
    ok('hai đòn cách nhau đúng 0.55 giây người chơi',
      combo.hits.length === 3 &&
      Math.abs((combo.hits[1].t - combo.hits[0].t) * combo.RT - .55) < .04 &&
      Math.abs((combo.hits[2].t - combo.hits[1].t) * combo.RT - .55) < .04,
      combo.hits.length === 3
        ? `${((combo.hits[1].t - combo.hits[0].t) * combo.RT).toFixed(2)}s và ${((combo.hits[2].t - combo.hits[1].t) * combo.RT).toFixed(2)}s`
        : 'không đủ ba đòn');
    ok('đòn ba choáng 0.55 giây người chơi',
      Math.abs(combo.stun * combo.RT - .55) < .02, `choáng ${(combo.stun * combo.RT).toFixed(2)}s`);
    ok('đòn ba đẩy lùi đúng 12% chiều dài sàn',
      Math.abs(combo.kb / 6 / combo.W - .12) < .01,
      `đẩy đi ${(combo.kb / 6).toFixed(0)}px trên sàn ${combo.W}px = ${(combo.kb / 6 / combo.W * 100).toFixed(1)}%`);
    ok('xong combo thì chờ 0.8 giây người chơi mới đánh tiếp',
      Math.abs(combo.cd * combo.RT - .8) < .02, `chờ ${(combo.cd * combo.RT).toFixed(2)}s`);

    /* ---- chiêu 2: Heat Vision ---- */
    const heat = await page.evaluate(() => {
      const G = window.__G(), SUP = window.__SUP;
      const s = G.fighters.find(f => f.key === 'superman'), e = G.fighters.find(f => f !== s);
      s.supCombo = null; s.supHv = null; s.supFb = null; s.supMs = null; s.supFly = 0;
      s.cds = { s1: 99, s2: 0, s3: 99, s4: 99 };
      e.maxHp = 99999; e.hp = e.maxHp; e.stun = 0; e.evade = 0; e.dots.length = 0;
      e.x = s.x + 150; e.y = s.y; e.kbx = 0; e.kby = 0;
      const dt = 1 / 120, R = Math.random;
      Math.random = () => .01;                     // ghim cho chắc trúng
      const ticks = []; let prev = e.hp, aimEnd = -1, slow = 0, kb = 0, stun = 0;
      window.__supermanHeat(s, e);
      try {
        for (let i = 0; i < 900 && s.supHv; i++) {
          e.x = s.x + 150; e.y = s.y;
          G.t += dt;
          window.__supermanTick(s, dt);
          if (s.supHv && s.supHv.ph === 'fire' && aimEnd < 0) aimEnd = i * dt;
          if (e.hp < prev) { ticks.push(+(prev - e.hp).toFixed(1)); prev = e.hp; }
          slow = Math.max(slow, e.hvSlowT || 0);
          kb = Math.max(kb, Math.hypot(e.kbx, e.kby));
          stun = Math.max(stun, e.stun);
        }
      } finally { Math.random = R; }
      const burn = e.dots.filter(d => d && d.sup);
      const burnTotal = burn.length ? burn[0].dps * burn[0].left : 0;
      // hai tia phải phóng ra từ đúng chiều cao hai con mắt
      const eyeY = window.__supEyeY(s), headTop = s.y + 20 - s.spriteH, foot = s.y + 20;
      return { ticks, aimEnd: +aimEnd.toFixed(3), slow: slow > 0, kb: +kb.toFixed(1), stun: +stun.toFixed(2),
               burnT: burn.length ? +burn[0].left.toFixed(3) : 0, burnDps: burn.length ? burn[0].dps : 0,
               burnTotal: +burnTotal.toFixed(1), nBurn: burn.length,
               eyeRel: +((foot - eyeY) / s.spriteH).toFixed(2),
               near: +window.__supHvOdds(0, s).toFixed(2), mid: +window.__supHvOdds(300, s).toFixed(2),
               far: +window.__supHvOdds(620, s).toFixed(2),
               SUP: { aim: SUP.hvAim, t: SUP.hvT, n: SUP.hvN, dmg: SUP.hvDmg }, RT: window.__RT };
    });
    ok('gồng 0.65 giây người chơi rồi mới bắn',
      Math.abs(heat.aimEnd * heat.RT - .65) < .05, `gồng ${(heat.aimEnd * heat.RT).toFixed(2)}s`);
    ok('tia nhiệt gây đúng bốn nhịp 17 dmg = 68',
      heat.ticks.length === 4 && heat.ticks.every(x => x === 17),
      heat.ticks.join(' + ') + ' = ' + heat.ticks.reduce((a, b) => a + b, 0));
    ok('trúng đủ bốn nhịp thì bốc cháy 3.75 dmg/giây trong 4 giây người chơi (tổng 83)',
      heat.nBurn === 1 && Math.abs(heat.burnDps / heat.RT - 3.75) < .001 &&
      Math.abs(heat.burnT * heat.RT - 4) < .02 && Math.abs(heat.burnTotal - 15) < .5,
      `${(heat.burnDps / heat.RT)} dmg/s × ${(heat.burnT * heat.RT).toFixed(2)}s = ${heat.burnTotal} · tổng ${68 + heat.burnTotal}`);
    ok('đang bị chiếu thì chậm chân, nhưng không choáng và không bị đẩy lùi',
      heat.slow && heat.kb === 0 && heat.stun === 0,
      `chậm ${heat.slow} · lực đẩy ${heat.kb} · choáng ${heat.stun}`);
    ok('hai tia phóng ra từ chiều cao hai con mắt, không phải từ trán hay miệng',
      heat.eyeRel > .78 && heat.eyeRel < .9, `mắt nằm ở ${(heat.eyeRel * 100).toFixed(0)}% chiều cao model`);
    ok('độ chính xác 90% gần · 70% trung bình · 55% xa nhất',
      heat.near === .9 && heat.mid === .7 && heat.far === .55,
      `${heat.near} / ${heat.mid} / ${heat.far}`);

    const heatMore = await page.evaluate(() => {
      const G = window.__G(), SUP = window.__SUP;
      const s = G.fighters.find(f => f.key === 'superman'), e = G.fighters.find(f => f !== s);
      const dt = 1 / 120;
      // bay thì ngắm tệ hơn 15%
      s.supFly = 99; const fly = +window.__supHvOdds(0, s).toFixed(2); s.supFly = 0;
      // bị đánh trong 0.4 giây đầu của quãng gồng: đứt chiêu, chờ nửa hồi chiêu
      s.supHv = null; s.cds.s2 = 0; s.supCombo = null;
      window.__supermanHeat(s, e);
      G.t += dt; window.__supermanTick(s, dt);
      window.__hurt(s, 30, e);
      const brokeEarly = !s.supHv, cdEarly = +s.cds.s2.toFixed(3);
      // đánh muộn hơn thì không đứt nữa
      s.hp = s.maxHp; s.supHv = null; s.cds.s2 = 0;
      window.__supermanHeat(s, e);
      for (let i = 0; i < 200 && s.supHv && s.supHv.ph === 'aim'; i++) { G.t += dt; window.__supermanTick(s, dt); }
      const firing = !!(s.supHv && s.supHv.ph === 'fire');
      window.__hurt(s, 30, e);
      const survived = !!s.supHv;
      // hướng bắn phải KHOÁ sau 0.3 giây đầu: địch chạy vòng ra sau lưng mà tia không xoay theo
      for (let i = 0; i < 60; i++) { G.t += dt; window.__supermanTick(s, dt); }
      const ang0 = s.supHv ? s.supHv.ang : 0;
      e.x = s.x - 200; e.y = s.y + 160;
      for (let i = 0; i < 30 && s.supHv; i++) { G.t += dt; window.__supermanTick(s, dt); }
      const ang1 = s.supHv ? s.supHv.ang : ang0;
      // choáng thì cắt được tia
      if (s.supHv) { s.stun = 1; G.t += dt; window.__supermanTick(s, dt); }
      const cutByStun = !s.supHv;
      s.stun = 0; s.hp = s.maxHp;
      return { fly, brokeEarly, cdEarly, firing, survived, locked: Math.abs(ang1 - ang0) < .001,
               cutByStun, cd: SUP.hvCd, cut: SUP.hvBreakCut, RT: window.__RT };
    });
    ok('đang bay thì độ chính xác Heat Vision trừ thêm 15%',
      Math.abs(heatMore.fly - .75) < .001, `sát mặt còn ${heatMore.fly}`);
    ok('bị đánh trong 0.4 giây đầu: đứt chiêu và chỉ chờ 50% hồi chiêu',
      heatMore.brokeEarly && Math.abs(heatMore.cdEarly - heatMore.cd * heatMore.cut) < .001,
      `hồi chiêu còn ${(heatMore.cdEarly * heatMore.RT).toFixed(2)}s`);
    ok('tia đã bắn ra thì đòn đánh nhẹ không cắt được, nhưng choáng thì cắt được',
      heatMore.firing && heatMore.survived && heatMore.cutByStun);
    ok('qua 0.3 giây đầu là hướng bắn khoá cứng, địch né sang bên thì tia chiếu hụt',
      heatMore.locked === true);

    /* ---- chiêu 3: Freeze Breath ---- */
    const cold = await page.evaluate(() => {
      const G = window.__G(), SUP = window.__SUP;
      const s = G.fighters.find(f => f.key === 'superman'), e = G.fighters.find(f => f !== s);
      s.supHv = null; s.supFb = null; s.supMs = null; s.supCombo = null; s.supFly = 0;
      s.cds = { s1: 99, s2: 99, s3: 0, s4: 99 };
      e.maxHp = 99999; e.hp = e.maxHp; e.stun = 0; e.evade = 0; e.frozen = 0; e.chill = 0;
      e.supCcAcc = 0; e.supCcT = 0; e.supSlow = 0;
      e.x = s.x + 90; e.y = s.y;
      const dt = 1 / 120;
      let aimEnd = -1, prev = e.hp, dmg = 0;
      window.__supermanFreeze(s, e);
      for (let i = 0; i < 600 && s.supFb; i++) {
        e.x = s.x + 90; e.y = s.y; G.t += dt; window.__supermanTick(s, dt);
        if (s.supFb && s.supFb.ph === 'blow' && aimEnd < 0) aimEnd = i * dt;
        if (e.hp < prev) { dmg += prev - e.hp; prev = e.hp; }
      }
      const frozen = e.frozen, locked = e.stun > 0;
      // đứng trong băng vẫn ăn đòn, và đủ 100 dmg thì băng vỡ ngay
      // để băng chạy bớt một quãng. statusTick() không đếm ngược f.stun (chỗ đó nằm
      // trong step()), nên ở đây phải tự trừ cho hai đồng hồ đi cùng nhịp như trong trận.
      for (let i = 0; i < 90; i++) { window.__statusTick(e, dt); e.stun = Math.max(0, e.stun - dt); }
      window.__hurt(e, 40, s, false, 'big');
      const stillFrozen = e.frozen > 0;
      window.__hurt(e, 70, s, false, 'big');
      const broke = e.frozen <= 0, chillLeft = e.chill, stunAfter = e.stun;
      // hết Frozen bình thường thì mới nhận Chilled đủ 4 giây
      e.chill = 0; e.stun = 0; e.supCcAcc = 0; e.supCcT = 0; e.frozen = 0;
      e.chillAfter = SUP.fbChill;
      window.__supFreezeOn(e, SUP.fbFreeze, s);
      const reFreeze = window.__supFreezeOn(e, SUP.fbFreeze, s);   // đã Frozen: không đóng băng lại
      for (let i = 0; i < 2000 && e.frozen > 0; i++) window.__statusTick(e, dt);
      const chillFull = e.chill;
      e.chill = 0; e.stun = 0; e.frozen = 0;
      return { aimEnd: +aimEnd.toFixed(3), dmg: +dmg.toFixed(1), frozen: +frozen.toFixed(3), locked,
               stillFrozen, broke, chillLeft: +chillLeft.toFixed(3), stunAfter: +stunAfter.toFixed(3),
               chillFull: +chillFull.toFixed(3), reFreeze,
               SUP: { aim: SUP.fbAim, dmg: SUP.fbDmg, fz: SUP.fbFreeze, ch: SUP.fbChill,
                      move: SUP.fbChillMove, cast: SUP.fbChillCast,
                      edge: [SUP.fbEdgeDmg, SUP.fbEdgeFreeze, SUP.fbEdgeChill], max: SUP.fbMax },
               RT: window.__RT };
    });
    ok('hít vào 0.9 giây người chơi rồi mới thổi',
      Math.abs(cold.aimEnd * cold.RT - .9) < .05, `hít ${(cold.aimEnd * cold.RT).toFixed(2)}s`);
    ok('trúng giữa nón: 34 dmg và đóng băng 2.2 giây người chơi',
      cold.dmg === 34 && Math.abs(cold.frozen * cold.RT - 2.2) < .05 && cold.locked,
      `${cold.dmg} dmg · Frozen ${(cold.frozen * cold.RT).toFixed(2)}s`);
    ok('đang Frozen vẫn ăn đòn, và đủ 100 dmg thì lớp băng vỡ ngay',
      cold.stillFrozen && cold.broke, `40 dmg chưa vỡ, thêm 70 nữa thì vỡ`);
    ok('băng vỡ sớm: hết choáng và đổi thành Chilled đúng phần thời gian còn lại',
      cold.chillLeft > 0 && cold.chillLeft < cold.SUP.fz && cold.stunAfter === 0,
      `Chilled còn ${(cold.chillLeft * cold.RT).toFixed(2)}s, choáng ${cold.stunAfter}`);
    ok('hết Frozen bình thường thì Chilled đủ 4 giây người chơi',
      Math.abs(cold.chillFull * cold.RT - 4) < .05, `${(cold.chillFull * cold.RT).toFixed(2)}s`);
    ok('đang Frozen thì một lần Freeze Breath nữa không đóng băng lại',
      cold.reFreeze === false);
    ok('Chilled giảm 50% tốc chạy và 25% tốc ra chiêu',
      cold.SUP.move === .5 && cold.SUP.cast === .75);
    ok('đứng ở rìa nón chỉ ăn 19 dmg / Frozen 1s / Chilled 2.5s, tối đa ba người',
      cold.SUP.edge[0] === 19 && Math.abs(cold.SUP.edge[1] * cold.RT - 1) < .001 &&
      Math.abs(cold.SUP.edge[2] * cold.RT - 2.5) < .001 && cold.SUP.max === 3);

    const coldMore = await page.evaluate(() => {
      const G = window.__G(), SUP = window.__SUP;
      const s = G.fighters.find(f => f.key === 'superman'), e = G.fighters.find(f => f !== s);
      const dt = 1 / 120;
      // bị đánh trong 0.5 giây đầu: đứt chiêu, hồi chiêu còn 60%
      s.supFb = null; s.cds.s3 = 0; s.supCombo = null; s.supHv = null;
      window.__supermanFreeze(s, e);
      G.t += dt; window.__supermanTick(s, dt);
      window.__hurt(s, 30, e);
      const broke = !s.supFb, cd = +s.cds.s3.toFixed(3);
      s.hp = s.maxHp;
      // đang bay thì không được dùng Freeze Breath
      s.supFb = null; s.cds = { s1: 99, s2: 99, s3: 0, s4: 99 };
      s.supFly = 99; s.lock = 0; s.stun = 0;
      e.x = s.x + 90; e.y = s.y; e.vx = 400; e.vy = 0;      // địch chạy nhanh: đúng lúc AI thèm Freeze Breath
      window.__CHARS.superman.think(s, e, 90, true);
      const whileFlying = !!s.supFb;
      s.supFly = 0;
      window.__CHARS.superman.think(s, e, 90, true);
      const onGround = !!s.supFb;
      s.supFb = null; e.vx = 0;
      return { broke, cd, whileFlying, onGround, want: SUP.fbCd * SUP.fbBreakCut, RT: window.__RT };
    });
    ok('bị đánh trong 0.5 giây đầu: Freeze Breath đứt, hồi chiêu còn 60%',
      coldMore.broke && Math.abs(coldMore.cd - coldMore.want) < .001,
      `chờ ${(coldMore.cd * coldMore.RT).toFixed(2)}s`);
    ok('đang bay thì tuyệt đối không thổi Freeze Breath, hạ xuống mới thổi',
      coldMore.whileFlying === false && coldMore.onGround === true);

    /* ---- chiêu 4: Meteor Strike ---- */
    const meteor = await page.evaluate(() => {
      const G = window.__G(), SUP = window.__SUP;
      const s = G.fighters.find(f => f.key === 'superman'), e = G.fighters.find(f => f !== s);
      const dt = 1 / 120, R = Math.random;
      const reset = () => {
        s.supHv = null; s.supFb = null; s.supMs = null; s.supCombo = null; s.supFly = 0;
        s.supMsDown = 0; s.stun = 0; s.lock = 0; s.hp = s.maxHp; s.supAir = 0;
        s.cds = { s1: 99, s2: 99, s3: 99, s4: 0 };
        e.maxHp = 99999; e.hp = e.maxHp; e.stun = 0; e.evade = 0; e.frozen = 0; e.chill = 0;
        e.supCcAcc = 0; e.supCcT = 0; e.supSlow = 0; e.supQuake = 0; e.kbx = 0; e.kby = 0;
        // ghim hẳn hai chỗ đứng vào giữa sàn: để trôi thì điểm rơi bị clamp vào mép
        // và cú lao "trúng" hoá thành trượt, đo ra số sai
        s.x = 200; s.y = 300; e.x = 360; e.y = 300;
      };
      // cú đấm trúng: 145 + 30 chấn động = 175
      reset();
      Math.random = () => .01;
      let prepEnd = -1, rise = 0, dmg = 0, prev, kb = 0, down = 0, dive = -1;
      try {
        window.__supermanMeteor(s, e);
        prev = e.hp;
        for (let i = 0; i < 900 && s.supMs; i++) {
          G.t += dt; window.__supermanTick(s, dt);
          rise = Math.max(rise, s.supAir);
          if (s.supMs && s.supMs.ph === 'dive' && dive < 0) { dive = i * dt; prepEnd = i * dt; }
        }
        dmg = +(prev - e.hp).toFixed(1);
        kb = Math.hypot(e.kbx, e.kby); down = e.stun;
      } finally { Math.random = R; }
      const quake = e.supQuake;
      // địch đang Frozen: thêm đúng 20 Shatter Damage, tổng 195
      reset();
      e.chillAfter = SUP.fbChill;
      window.__supFreezeOn(e, SUP.fbFreeze, s);
      e.supCcAcc = 0; e.supCcT = 0;                     // đo riêng phần sát thương
      Math.random = () => .01;
      let dmgFrozen = 0;
      try {
        window.__supermanMeteor(s, e);
        const p0 = e.hp;
        for (let i = 0; i < 900 && s.supMs; i++) { G.t += dt; window.__supermanTick(s, dt); }
        dmgFrozen = +(p0 - e.hp).toFixed(1);
      } finally { Math.random = R; }
      // đánh trượt: nằm 1.3 giây, Man of Steel tụt còn 10%
      reset();
      Math.random = () => .99;                          // ghim cho chắc trượt
      let missDown = 0;
      try {
        window.__supermanMeteor(s, e);
        for (let i = 0; i < 900 && s.supMs; i++) {
          G.t += dt; window.__supermanTick(s, dt);
          if (s.supMs && s.supMs.ph === 'hold' && s.supMs.t <= dt) { e.x = s.x + 320; e.y = s.y + 240; }
        }
        missDown = s.supMsDown;
      } finally { Math.random = R; }
      const missTake = +(1 - window.__supResist(s)).toFixed(3);
      // bị choáng trong quãng chuẩn bị: huỷ chiêu, chờ 70% hồi chiêu
      reset();
      window.__supermanMeteor(s, e);
      G.t += dt; window.__supermanTick(s, dt);
      s.stun = 1; G.t += dt; window.__supermanTick(s, dt);
      const cancelled = !s.supMs, cancelCd = +s.cds.s4.toFixed(3);
      s.stun = 0; s.supMsDown = 0; reset(); s.cds.s4 = 99;
      return { prepEnd: +prepEnd.toFixed(3), rise: +rise.toFixed(0), dmg, kb: +kb.toFixed(1),
               down: +down.toFixed(3), quake: +quake.toFixed(3), dmgFrozen,
               missDown: +missDown.toFixed(3), missTake, cancelled, cancelCd,
               near: +window.__supMsOdds(0, s).toFixed(2), mid: +window.__supMsOdds(300, s).toFixed(2),
               far: +window.__supMsOdds(620, s).toFixed(2),
               W: window.__WH().W, SUP: { cd: SUP.msCd, cut: SUP.msCancelCut, kb: SUP.msKb, quakeT: SUP.msQuakeT },
               RT: window.__RT };
    });
    ok('quãng chuẩn bị dài đúng 1.2 giây người chơi rồi mới lao xuống',
      Math.abs(meteor.prepEnd * meteor.RT - 1.2) < .06, `${(meteor.prepEnd * meteor.RT).toFixed(2)}s`);
    ok('có bay lên cao thật rồi mới bổ xuống, không phải dịch chuyển tức thời',
      meteor.rise > 120, `lên tới ${meteor.rise}px`);
    ok('cú đấm trúng: 109 + 23 chấn động = 132 dmg',
      meteor.dmg === 132, `${meteor.dmg} dmg`);
    ok('quật ngã 1.5 giây người chơi và hất lùi 20% chiều dài sàn',
      Math.abs(meteor.down * meteor.RT - 1.5) < .05 &&
      Math.abs(meteor.kb / 6 / meteor.W - .20) < .015,
      `ngã ${(meteor.down * meteor.RT).toFixed(2)}s · đẩy ${(meteor.kb / 6).toFixed(0)}px = ${(meteor.kb / 6 / meteor.W * 100).toFixed(1)}%`);
    ok('vùng chấn động để lại làm chậm 2 giây người chơi',
      Math.abs(meteor.quake * meteor.RT - 2) < .05, `${(meteor.quake * meteor.RT).toFixed(2)}s`);
    ok('địch đang Frozen: thêm đúng 15 Shatter Damage, tổng 147 và không hơn',
      meteor.dmgFrozen === 147, `${meteor.dmgFrozen} dmg`);
    ok('đánh trượt thì nằm 1.3 giây và Man of Steel tụt còn 10%',
      Math.abs(meteor.missDown * meteor.RT - 1.3) < .05 && Math.abs(meteor.missTake - .1) < .001,
      `nằm ${(meteor.missDown * meteor.RT).toFixed(2)}s · giảm dmg ${(meteor.missTake * 100).toFixed(0)}%`);
    ok('bị choáng trong quãng chuẩn bị: huỷ chiêu, chờ 70% hồi chiêu',
      meteor.cancelled && Math.abs(meteor.cancelCd - meteor.SUP.cd * meteor.SUP.cut) < .001,
      `chờ ${(meteor.cancelCd * meteor.RT).toFixed(2)}s`);
    ok('độ chính xác 80% gần · 60% trung bình · 50% xa nhất',
      meteor.near === .8 && meteor.mid === .6 && meteor.far === .5,
      `${meteor.near} / ${meteor.mid} / ${meteor.far}`);

    /* ---- toàn bộ sát thương đúng cỡ 70% so với bản đầu ---- */
    const cut = await page.evaluate(() => {
      const SUP = window.__SUP, RT = window.__RT;
      // [tên, số cũ, số mới]
      /* Luật áp cho TỪNG con số một, không phải cho tổng: đòn một và đòn hai của combo
         đều là 34 gốc nên mỗi cái tự làm tròn riêng. */
      return [
        ['đấm 1', 34, SUP.hit[0]],
        ['đấm 2', 34, SUP.hit[1]],
        ['uppercut', 50, SUP.hit[2]],
        ['heat vision mỗi nhịp', 22, SUP.hvDmg],
        ['burning mỗi giây', 5, SUP.hvBurnDps / RT],
        ['freeze breath giữa nón', 45, SUP.fbDmg],
        ['freeze breath rìa nón', 25, SUP.fbEdgeDmg],
        ['meteor strike', 145, SUP.msDmg],
        ['vùng chấn động', 30, SUP.msQuakeDmg],
        ['shatter damage', 20, SUP.msShatter]
      ].map(([n, a, b]) => ({ n, a, b, r: +(b / a).toFixed(3), lech: +Math.abs(b - a * .75).toFixed(2) }));
    });
    /* Luật là MỘT dòng, áp cho từng con số: số mới = làm tròn(số bản đầu × 0.75). Kiểm
       bằng độ lệch so với mốc 75% chứ đừng kiểm một khoảng lỏng lẻo — lệch quá nửa đơn
       vị là ai đó đã bốc tay đổi số. */
    ok('TỪNG con số sát thương đúng bằng làm tròn(số bản đầu × 0.75)',
      cut.every(x => x.lech <= .5),
      cut.map(x => `${x.n} ${x.a}->${x.b} (${Math.round(x.r * 100)}%)`).join(' · '));

    /* ---- vùng chấn động của Meteor Strike là AoE nhạt dần theo khoảng cách ---- */
    const aoe = await page.evaluate(() => {
      const G = window.__G(), SUP = window.__SUP;
      const s = G.fighters.find(f => f.key === 'superman'), e = G.fighters.find(f => f !== s);
      const dt = 1 / 120, R = Math.random;
      // bảng nội suy đọc thẳng từ hàm
      const mid = (SUP.msQuakeR + SUP.msQuakeFar) / 2;
      const bang = {
        tam: +window.__supQuakeShare(0).toFixed(3),
        loi: +window.__supQuakeShare(SUP.msQuakeR).toFixed(3),
        giua: +window.__supQuakeShare(mid).toFixed(3),
        mep: +window.__supQuakeShare(SUP.msQuakeFar - 1).toFixed(3),
        ngoai: +window.__supQuakeShare(SUP.msQuakeFar + 40).toFixed(3)
      };
      /* Đo thật: cho anh lao trượt hẳn rồi dời địch ra đúng khoảng cách muốn đo so với
         ĐIỂM RƠI (dời sau khi hướng đã khoá nên điểm rơi không đổi theo). */
      const doAt = (kc) => {
        s.supHv = null; s.supFb = null; s.supMs = null; s.supCombo = null; s.supFly = 0;
        s.supMsDown = 0; s.stun = 0; s.lock = 0; s.hp = s.maxHp; s.supAir = 0;
        s.cds = { s1: 99, s2: 99, s3: 99, s4: 0 };
        e.maxHp = 99999; e.hp = e.maxHp; e.stun = 0; e.evade = 0; e.frozen = 0;
        e.supQuake = 0; e.supCcAcc = 0; e.supCcT = 0; e.kbx = 0; e.kby = 0;
        s.x = 200; s.y = 300; e.x = 360; e.y = 300;
        const hp0 = e.hp;
        Math.random = () => .01;
        let moved = false;
        try {
          window.__supermanMeteor(s, e);
          for (let i = 0; i < 900 && s.supMs; i++) {
            G.t += dt; window.__supermanTick(s, dt);
            // hướng đã khoá: giờ dời địch ra đúng khoảng cách cần đo so với điểm rơi
            if (s.supMs && s.supMs.ph === 'dive' && !moved) {
              moved = true;
              e.x = s.supMs.tx + kc; e.y = s.supMs.ty;
            }
          }
        } finally { Math.random = R; }
        return { dmg: +(hp0 - e.hp).toFixed(1), slow: +(e.supQuake || 0).toFixed(3) };
      };
      const loi = doAt(SUP.msQuakeR - 20);
      const rim = doAt(mid);
      const xa = doAt(SUP.msQuakeFar + 60);
      /* Lượt đo cuối cố tình để anh lao trượt, nên anh đang NẰM (supMsDown) và
         supResist() trả về mức 10%. Dọn sạch, không thì mấy mục đo sau ăn nhầm. */
      s.cds.s4 = 99; s.supMsDown = 0; s.lock = 0; s.pose = 'idle'; s.hp = s.maxHp;
      e.supQuake = 0; e.hp = e.maxHp;
      return { bang, loi, rim, xa, dmg: SUP.msQuakeDmg, T: SUP.msQuakeT,
               R: SUP.msQuakeR, far: SUP.msQuakeFar, min: SUP.msQuakeMin, RT: window.__RT };
    });
    ok('trong lõi thì chấn động ăn đủ, ra mép ngoài thì nhạt dần, quá mép là không dính',
      aoe.bang.tam === 1 && aoe.bang.loi === 1 &&
      Math.abs(aoe.bang.giua - (1 + aoe.min) / 2) < .01 &&
      aoe.bang.mep > aoe.min - .01 && aoe.bang.mep < aoe.min + .02 && aoe.bang.ngoai === 0,
      `tâm ${aoe.bang.tam} · mép lõi ${aoe.bang.loi} · giữa ${aoe.bang.giua} · sát mép ${aoe.bang.mep} · ngoài ${aoe.bang.ngoai}`);
    ok('đứng trong lõi thì ăn trọn sát thương chấn động',
      aoe.loi.dmg === aoe.dmg && Math.abs(aoe.loi.slow - aoe.T) < .01,
      `${aoe.loi.dmg} dmg · chậm ${(aoe.loi.slow * aoe.RT).toFixed(2)}s`);
    ok('đứng cạnh vùng ảnh hưởng thì chỉ ăn một phần, cả dmg lẫn thời gian làm chậm',
      aoe.rim.dmg > 0 && aoe.rim.dmg < aoe.dmg && aoe.rim.slow > 0 && aoe.rim.slow < aoe.T,
      `${aoe.rim.dmg}/${aoe.dmg} dmg · chậm ${(aoe.rim.slow * aoe.RT).toFixed(2)}s trên ${(aoe.T * aoe.RT).toFixed(2)}s`);
    ok('đứng hẳn ngoài mép ngoài thì không dính một điểm nào',
      aoe.xa.dmg === 0 && aoe.xa.slow === 0, `${aoe.xa.dmg} dmg`);

    /* ---- trần khống chế cứng 3.5 giây ---- */
    const cc = await page.evaluate(() => {
      const G = window.__G(), SUP = window.__SUP;
      const s = G.fighters.find(f => f.key === 'superman'), e = G.fighters.find(f => f !== s);
      e.stun = 0; e.frozen = 0; e.chill = 0; e.supSlow = 0; e.supCcAcc = 0; e.supCcT = 0; e.supCcFree = 0;
      e.chillAfter = SUP.fbChill;
      const a = window.__supCC(s, e, SUP.fbFreeze, 'freeze');       // đóng băng 2.2s
      const b = window.__supCC(s, e, SUP.msDown, 'down');           // rồi knockdown 1.5s ngay sau
      const slow = e.supSlow;
      // nghỉ đủ lâu thì bộ đếm về 0 và lại khống chế được đủ
      e.stun = 0; e.frozen = 0; e.supSlow = 0;
      for (let i = 0; i < 2000 && e.supCcAcc > 0; i++) window.__statusTick(e, 1 / 120);
      const reset = e.supCcAcc;
      e.stun = 0; e.frozen = 0;
      const c = window.__supCC(s, e, SUP.msDown, 'down');
      e.stun = 0; e.frozen = 0; e.supSlow = 0; e.supCcAcc = 0; e.supCcT = 0;
      return { a: +a.hard.toFixed(3), b: +b.hard.toFixed(3), rest: +b.rest.toFixed(3),
               slow: +slow.toFixed(3), reset, c: +c.hard.toFixed(3),
               cap: SUP.ccCap, RT: window.__RT };
    });
    ok('đóng băng 2.2s rồi Meteor Strike thì chỉ quật ngã thêm 1.3s, không phải 1.5s',
      Math.abs(cc.a * cc.RT - 2.2) < .001 && Math.abs(cc.b * cc.RT - 1.3) < .001,
      `${(cc.a * cc.RT).toFixed(2)}s + ${(cc.b * cc.RT).toFixed(2)}s = ${((cc.a + cc.b) * cc.RT).toFixed(2)}s (trần ${(cc.cap * cc.RT).toFixed(2)}s)`);
    ok('phần thừa 0.2s đổi thành làm chậm 40% đúng bấy nhiêu giây',
      Math.abs(cc.rest * cc.RT - .2) < .001 && Math.abs(cc.slow - cc.rest) < .001,
      `làm chậm ${(cc.slow * cc.RT).toFixed(2)}s`);
    ok('nghỉ đủ lâu thì bộ đếm về 0 và lại khống chế cứng được đủ thời lượng',
      cc.reset === 0 && Math.abs(cc.c * cc.RT - 1.5) < .001,
      `lần sau quật ngã ${(cc.c * cc.RT).toFixed(2)}s`);

    /* ---- nội tại máu thấp ---- */
    const lsr = await page.evaluate(() => new Promise(res => {
      const G = window.__G(), SUP = window.__SUP;
      const s = G.fighters.find(f => f.key === 'superman'), e = G.fighters.find(f => f !== s);
      s.lsr = 0; s.lsrDone = false; s.fatigue = 0;
      s.cds = { s1: 0, s2: 9, s3: 9, s4: 9 };
      s.hp = Math.round(s.maxHp * SUP.lsrHp) - 1;
      const cd0 = { s2: s.cds.s2, s3: s.cds.s3 };
      window.__supResolve(s);
      const cdCut = { s2: +(cd0.s2 - s.cds.s2).toFixed(3), s3: +(cd0.s3 - s.cds.s3).toFixed(3) };
      window.__statusTick(s, 0);
      const on = { move: +s.moveMul.toFixed(3), cast: +s.castMul.toFixed(3),
                   res: +(1 - window.__supResist(s)).toFixed(3) };
      // hồi máu lên trên 25% rồi tụt xuống lại: vẫn KHÔNG được gọi lần hai
      const dt = 1 / 120;
      for (let i = 0; i < 4000 && s.lsr > 0; i++) window.__statusTick(s, dt);
      window.__statusTick(s, 0);
      const fat = { t: +s.fatigue.toFixed(3), move: +s.moveMul.toFixed(3),
                    cast: +s.castMul.toFixed(3), res: +(1 - window.__supResist(s)).toFixed(3) };
      s.hp = s.maxHp;
      res({ cdCut, on, fat, done: s.lsrDone, hp: Math.round(s.maxHp * SUP.lsrHp), RT: window.__RT,
            SUP: { t: SUP.lsrT, fatT: SUP.fatT } });
    }));
    ok("Last Son's Resolve: +30% chạy, +25% ra chiêu, giảm sát thương lên 30%",
      Math.abs(lsr.on.move - 1.3) < .001 && Math.abs(lsr.on.cast - 1.25) < .001 &&
      Math.abs(lsr.on.res - .3) < .001,
      `chạy ${lsr.on.move} · cast ${lsr.on.cast} · giảm dmg ${(lsr.on.res * 100).toFixed(0)}%`);
    ok('kích hoạt ở dưới 25% máu, tức dưới 200 HP', lsr.hp === 200, `mốc ${lsr.hp} HP`);
    ok('cắt ngay 2 giây người chơi khỏi hồi chiêu Heat Vision và Freeze Breath',
      Math.abs(lsr.cdCut.s2 * lsr.RT - 2) < .001 && Math.abs(lsr.cdCut.s3 * lsr.RT - 2) < .001,
      `cắt ${(lsr.cdCut.s2 * lsr.RT).toFixed(2)}s / ${(lsr.cdCut.s3 * lsr.RT).toFixed(2)}s`);
    ok('hết 8 giây thì rơi vào Solar Fatigue 4 giây: −20% chạy, −15% ra chiêu, giảm dmg về 20%',
      Math.abs(lsr.fat.t * lsr.RT - 4) < .05 && Math.abs(lsr.fat.move - .8) < .001 &&
      Math.abs(lsr.fat.cast - .85) < .001 && Math.abs(lsr.fat.res - .2) < .001,
      `${(lsr.fat.t * lsr.RT).toFixed(2)}s · chạy ${lsr.fat.move} · cast ${lsr.fat.cast} · giảm dmg ${(lsr.fat.res * 100).toFixed(0)}%`);
    ok('chỉ dùng được một lần mỗi trận (cờ lsrDone giữ luôn)', lsr.done === true);

    /* ---- chữ hiển thị đều bằng tiếng Anh ---- */
    const eng = await page.evaluate(() => {
      const C = window.__CHARS.superman;
      const txt = C.skills.join(' ') + ' ' + C.name + ' ' + C.tag;
      const dau = txt.match(/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/g);
      const need = ['Superman', 'Man of Steel', 'Kryptonian Flight', "Last Son's Resolve",
                    'Solar Fatigue', 'Basic Attack', 'Heat Vision', 'Burning', 'Freeze Breath',
                    'Frozen', 'Chilled', 'Meteor Strike', 'Shatter Damage', 'Super Armor'];
      return { dau: dau ? dau.slice(0, 6) : [], thieu: need.filter(n => txt.indexOf(n) < 0),
               name: C.name };
    });
    ok('mảng skills không lẫn một chữ tiếng Việt có dấu nào',
      eng.dau.length === 0, eng.dau.length ? 'còn: ' + eng.dau.join('') : 'sạch');
    ok('đủ mười bốn cái tên tiếng Anh người dùng liệt kê',
      eng.thieu.length === 0, eng.thieu.length ? 'thiếu: ' + eng.thieu.join(', ') : 'đủ');
    ok('tên dưới thanh máu vẫn là "Superman"', eng.name === 'Superman');

    if (errors.length) ok('trang không ném lỗi', false, errors[0]);
    await browser.close();
  }

  /* ---------- trận 2: Superman vs Shikamaru — bay đuổi và dải bóng ---------- */
  {
    const { browser, page, errors } = await openGame('superman', 'shika', { play: false });
    await page.click('#play');
    await page.selectOption('#speed', '1');
    await page.waitForFunction(() => {
      const G = window.__G(); const f = G.fighters.find(x => x.key === 'superman');
      return f && !f.supEntry;
    }, null, { timeout: 60000 });
    await page.click('#play');                       // dừng lại, đo bằng cách gọi thẳng

    const fly = await page.evaluate(() => {
      const G = window.__G(), SUP = window.__SUP;
      const s = G.fighters.find(f => f.key === 'superman'), e = G.fighters.find(f => f !== s);
      const W = window.__WH().W, dt = 1 / 120;
      s.supFly = 0; s.supFlyCd = 0; s.supStuck = 0; s.supHv = null; s.supFb = null;
      s.supMs = null; s.supCombo = null; s.stun = 0;
      s.x = 60; s.y = 300; e.x = 560; e.y = 300;      // xa hơn 50% chiều dài sàn
      let onAt = -1;
      for (let i = 0; i < 2000 && s.supFly <= 0; i++) {
        e.x = 560; e.y = 300; G.t += dt; window.__supermanTick(s, dt);
        if (s.supFly > 0) onAt = i * dt;
      }
      G.t += dt; window.__supermanTick(s, dt);      // thêm một nhịp để độ cao kịp đặt
      window.__statusTick(s, 0);
      const move = +s.moveMul.toFixed(3), air = s.supAir;
      // vào đủ tầm là hạ cánh ngay, và hồi chiêu chỉ bắt đầu đếm TỪ LÚC TIẾP ĐẤT
      e.x = s.x + 50;
      G.t += dt; window.__supermanTick(s, dt);
      const landed = s.supFly <= 0, cd = +s.supFlyCd.toFixed(3);
      // đứng gần thì không bao giờ cất cánh
      s.supFlyCd = 0; s.supStuck = 0;
      for (let i = 0; i < 800; i++) { e.x = s.x + 60; G.t += dt; window.__supermanTick(s, dt); }
      const stayed = s.supFly <= 0;
      return { onAt: +onAt.toFixed(3), move, air, landed, cd, stayed,
               wait: SUP.flyWait, far: SUP.flyFar, W, RT: window.__RT };
    });
    ok('địch đứng xa hơn 50% sàn suốt 2 giây người chơi thì Superman mới cất cánh',
      fly.onAt > 0 && Math.abs(fly.onAt - fly.wait) < .06,
      `cất cánh sau ${(fly.onAt * fly.RT).toFixed(2)}s người chơi (chuẩn 2.00)`);
    ok('lúc bay: +75% tốc chạy và model rời hẳn mặt đất',
      Math.abs(fly.move - 1.75) < .001 && fly.air > 0,
      `tốc chạy ×${fly.move} · cao ${fly.air.toFixed(1)}px`);
    ok('vào đủ tầm vung tay là hạ xuống ngay, hồi chiêu 8 giây tính TỪ LÚC TIẾP ĐẤT',
      fly.landed && Math.abs(fly.cd * fly.RT - 8) < .05, `hồi ${(fly.cd * fly.RT).toFixed(2)}s`);
    ok('địch đứng sát bên thì không bao giờ cất cánh bỏ chạy câu giờ', fly.stayed === true);

    const bind = await page.evaluate(() => {
      const G = window.__G();
      const s = G.fighters.find(f => f.key === 'superman'), k = G.fighters.find(f => f.key === 'shika');
      k.bind = null; k.lock = 0; k.lazy = false; k.awake = true; k.weak = false;
      s.supFly = 0;
      window.__shadowBind(k, s);
      const started = !!k.bind;
      s.supFly = 99;
      window.__bindTick(k, 1 / 120);
      const cut = !k.bind;
      s.supFly = 0;
      return { started, cut };
    });
    ok('dải bóng của Shikamaru là chướng ngại vật thấp: không giữ nổi người đang bay',
      bind.started && bind.cut);

    if (errors.length) ok('trang không ném lỗi (trận 2)', false, errors[0]);
    await browser.close();
  }

  console.log(out.join('\n'));
  console.log(fail ? `HONG: ${fail} muc khong dat` : `DAT: ${out.length}/${out.length} muc`);
  process.exit(fail ? 1 : 0);
})();
