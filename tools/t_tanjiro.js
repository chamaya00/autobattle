/* Tanjiro Kamado — contract test for timings, damage, awakening and status rules.
   Run: node tools/t_tanjiro.js */
const { openGame } = require('./probe');

let pass = 0, fail = 0;
const ok = (c, m, d) => {
  console.log((c ? '  DAT  ' : '  HONG ') + m + (d === undefined ? '' : ` (${d})`));
  c ? pass++ : fail++;
};
const near = (a, b, eps = .02) => Math.abs(a - b) <= eps;

(async () => {
  const { browser, page, errors } = await openGame('tanjiro', 'chichi', { play: false });

  console.log('\n=== 1. Constants, shared HP and English profile ===');
  const cfg = await page.evaluate(() => {
    const T = window.__TAN, RT = window.__RT, D = window.__DEX.tanjiro;
    const text = [window.__CHARS.tanjiro.name, ...window.__CHARS.tanjiro.skills,
      D.name, D.role.vi, D.role.en, D.bio.vi, D.bio.en,
      ...D.skills.flatMap(s => [s.name, s.vi, s.en])].join(' ');
    return {
      hp: window.__HP.tanjiro, hpStd: window.__HP_STD,
      entrance: T.entranceT * RT, threadCd: T.threadCd * RT, threadT: T.threadT * RT,
      basic: T.basic.slice(), basicGap: T.basicGap * RT,
      wheel: [T.wheelDmg, T.wheelCd * RT, T.wheelAir * RT, T.wheelRecover * RT],
      flux: T.fluxHit.slice(), fluxCd: T.fluxCd * RT,
      sun: T.sunHit.slice(), sunCd: T.sunCd * RT,
      control: [T.surfaceStun,T.wheelAir,T.fluxStun,T.sunStun,T.ultDown].map(x=>x*RT),
      mark: [T.markHp, T.markT * RT, T.markMove, T.markAtk, T.markCast, T.markCcRes, T.markKbRes, T.markRhythmHits, T.markRhythmDmg, T.markRhythmCdCut * RT],
      ult: T.ultDmg.slice(), ultCd: T.ultCd * RT, ultT: T.ultT * RT,
      ultFocus: T.ultFocus * RT, ultTake: T.ultTake, ultCcRes: T.ultCcRes,
      redT: T.redT * RT, suppT: T.suppressT * RT, suppHeal: T.suppressHeal,
      hasVietnamese: /[À-ỹ]/.test(text), locked: text.includes('Locked – Awaken Demon Slayer Mark'),
      names: ['Opening Thread','Nichirin Sword Combo','Water Surface Slash','Water Wheel',
        'Constant Flux','Dragon Sun Halo Head Dance','Demon Slayer Mark','Transparent World',
        'Sun Breathing: Thirteenth Form','Bright Red Nichirin Blade','Regeneration Suppression','Hinokami Rhythm']
        .every(x => text.includes(x))
    };
  });
  ok(cfg.hp === cfg.hpStd, 'Tanjiro HP reads the shared HP standard', `${cfg.hp}/${cfg.hpStd}`);
  ok(near(cfg.entrance, 1.5), 'entrance is exactly 1.5 player seconds', cfg.entrance);
  ok(cfg.threadCd === 8 && cfg.threadT === 3, 'Opening Thread is 8s cooldown / 3s duration');
  ok(cfg.basic.join(',') === '22,22,36' && cfg.basic.reduce((a,b)=>a+b,0) === 80 && cfg.basicGap === .8,
    'Nichirin Sword Combo is 22/22/36 = 80 at 0.8s per strike');
  ok(cfg.wheel[0] === 75 && cfg.wheel[1] === 9 && cfg.wheel[2] === .85 && cfg.wheel[3] === .5,
    'Water Wheel values are exact');
  ok(cfg.flux.join(',') === '18,22,26,30,34' && cfg.flux.reduce((a,b)=>a+b,0) === 130 && cfg.fluxCd === 14,
    'Constant Flux is five increasing hits totaling 130');
  ok(cfg.sun.join(',') === '35,35,35' && cfg.sun.reduce((a,b)=>a+b,0) === 105 && cfg.sunCd === 13,
    'Dragon Sun Halo Head Dance is 3 x 35 = 105');
  ok(cfg.ult.length === 12 && cfg.ult.reduce((a,b)=>a+b,0) === 210 && cfg.ultCd === 28 && cfg.ultT === 3.5,
    'Thirteenth Form is twelve connected hits, capped at 210 over 3.5s');
  ok(cfg.control.every((x,i)=>near(x,[.55,.85,1.1,.9,1.4][i],.01)),
    'control durations rise one step across basic, Water Wheel, Flux, Sun Dance and Ultimate', cfg.control.join('/'));
  ok(!cfg.hasVietnamese && cfg.locked && cfg.names, 'all Tanjiro profile, skill, buff and debuff text is English');

  console.log('\n=== 2. Entrance locks the arena for all three phases ===');
  const ent = await page.evaluate(() => {
    const G=window.__G(), step=window.__step, f=G.fighters.find(x=>x.key==='tanjiro'), e=G.fighters.find(x=>x.key==='chichi');
    const x=e.x,y=e.y,h=e.hp, poses=new Set(), samples=[];
    let ticks=0;
    for(;ticks<400&&f.tanEntry;ticks++){
      step(1/120); poses.add(f.pose);
      if(ticks===28||ticks===58||ticks===88)samples.push(f.pose);
    }
    return { playerSeconds:G.t*window.__RT, ticks, poses:[...poses], samples,
      moved:Math.hypot(e.x-x,e.y-y), damage:h-e.hp, done:!f.tanEntry };
  });
  ok(ent.done && near(ent.playerSeconds,1.5,.04), 'entrance completes at 1.5s', ent.playerSeconds.toFixed(3));
  ok(ent.poses.includes('run') && ent.poses.includes('draw') && ent.poses.includes('ready'),
    'entrance visits run, draw and low ready poses', ent.poses.join(','));
  ok(ent.moved < 1 && ent.damage === 0, 'opponent waits without moving or attacking', `${ent.moved.toFixed(2)}px / ${ent.damage} dmg`);

  console.log('\n=== 3. Opening Thread respects full blocks and is consumed once ===');
  const thread = await page.evaluate(() => {
    const G=window.__G(), T=window.__TAN, f=G.fighters.find(x=>x.key==='tanjiro'), e=G.fighters.find(x=>x.key==='chichi');
    f.tanThreadCd=999; f.dmgOut=1; e.evade=0; e.dodge=0; e.dmgRes=0; e.dmgTake=1; e.hp=1000; e.maxHp=1000;
    window.__tanMarkOpening(f);
    const count=()=>e.openingThreads.filter(x=>x.owner===f&&x.t>0).length;
    const before=count(); e.invuln=1; const inv=window.__hurt(e,100,f,false,'big'); e.invuln=0;
    const afterInv=count(); e.beaEmt=.5; const barrier=window.__hurt(e,100,f,false,'big'); e.beaEmt=0;
    const afterBarrier=count(), hp0=e.hp;
    const first=window.__hurt(e,100,f,false,'big'), damage1=hp0-e.hp, afterHit=count(), hp1=e.hp;
    const second=window.__hurt(e,100,f,false,'big'), damage2=hp1-e.hp;
    // Re-mark against 50% reduction: Opening Thread ignores 20% of that reduction.
    window.__tanMarkOpening(f); e.dmgRes=.5; const hp2=e.hp; window.__hurt(e,100,f,false,'big');
    const pierced=hp2-e.hp;
    return {before,inv,barrier,afterInv,afterBarrier,first,second,damage1,damage2,afterHit,pierced};
  });
  ok(thread.before===1 && !thread.inv && !thread.barrier && thread.afterInv===1 && thread.afterBarrier===1,
    'invulnerability and a full barrier block without consuming Opening Thread');
  ok(thread.first && thread.damage1===115 && thread.afterHit===0 && thread.second && thread.damage2===100,
    'the +15 damage applies once, even across subsequent hits', `${thread.damage1}/${thread.damage2}`);
  ok(near(thread.pierced,69,.01), '20% of target damage reduction is ignored', thread.pierced);

  console.log('\n=== 4. Basic and active forms deal only their specified hit totals ===');
  const forms = await page.evaluate(() => {
    const G=window.__G(), f=G.fighters.find(x=>x.key==='tanjiro'), e=G.fighters.find(x=>x.key==='chichi');
    const prep=()=>{ f.tanAct=null; f.tanTrails=[]; f.tanThreadCd=999; f.tanRed=0; f.stun=0; f.lock=0;
      e.hp=1000;e.maxHp=1000;e.alive=true;e.evade=0;e.dodge=0;e.dmgRes=0;e.dmgTake=1;e.invuln=0;e.beaEmt=0;e.dots=[];e.stun=0;e.kbx=0;e.kby=0;
      f.x=300;f.y=350;e.x=355;e.y=350; };
    prep(); f.tanCombo=0; const b=e.hp; window.__tanBasic(f,e);window.__tanBasic(f,e);window.__tanBasic(f,e);
    const basic=b-e.hp, basicStun=e.stun*window.__RT;
    const run=(start,limit=600)=>{ let n=0; while(f.tanAct&&n++<limit)window.__tanjiroTick(f,1/120); return {dmg:start-e.hp,n}; };
    prep(); let h=e.hp; window.__tanWaterWheel(f,e); const wheel=run(h);
    prep(); h=e.hp; window.__tanConstantFlux(f,e); const flux=run(h);
    prep(); h=e.hp; window.__tanSunDance(f,e); const sun=run(h);
    return {basic,basicStun,wheel,flux,sun,sunDots:e.dots.length};
  });
  ok(forms.basic===80 && near(forms.basicStun,.55,.02), 'basic combo deals 80; third hit applies 0.55s hit stun');
  ok(forms.wheel.dmg===75 && forms.wheel.n<600, 'Water Wheel deals 75 and completes without teleporting');
  ok(forms.flux.dmg===130 && forms.flux.n<600, 'Constant Flux deals exactly 130 across five hits');
  ok(forms.sun.dmg===105 && forms.sun.n<600 && forms.sunDots===0, 'Sun dance deals exactly 105 with no burn or damage over time');

  console.log('\n=== 5. Mark uses current maxHp and powers Hinokami Rhythm ===');
  const mark = await page.evaluate(() => {
    const G=window.__G(), T=window.__TAN, f=G.fighters.find(x=>x.key==='tanjiro'), e=G.fighters.find(x=>x.key==='chichi');
    f.tanAct=null;f.tanMarked=false;f.tanMarkStarted=false;f.tanMarkAnim=0;f.maxHp=1333;f.hp=f.maxHp*.40;
    f.cds.s1=f.cds.s2=f.cds.s3=f.cds.s4=f.cds.basic=999;e.lock=999;e.stun=0;
    window.__step(1/120); const exact=f.tanMarkStarted;
    f.hp=f.maxHp*.40-.01; const before=f.hp; window.__step(1/120); const started=f.tanMarkStarted;
    for(let i=0;i<200&&!f.tanMarked;i++)window.__step(1/120);
    window.__statusTick(f,0);
    f.stun=0; const cc=window.__stunFx(f,1,'spark');
    e.hp=1000;e.maxHp=1000;e.alive=true;e.evade=0;e.dodge=0;e.dmgRes=0;e.dmgTake=1;e.invuln=0;e.openingThreads=[];
    f.tanRed=0;f.tanCombo=0;f.tanMarkHits=0;f.x=300;f.y=350;e.x=355;e.y=350;
    f.cds.s1=T.wheelCd;f.cds.s2=T.fluxCd;f.cds.s3=T.sunCd;
    const h0=e.hp;window.__tanBasic(f,e);window.__tanBasic(f,e);window.__tanBasic(f,e);
    const rhythmDamage=h0-e.hp,rhythmCds=[f.cds.s1*window.__RT,f.cds.s2*window.__RT,f.cds.s3*window.__RT];
    return {exact,started,active:f.tanMarked,hpBefore:before,hpAfter:f.hp,maxHp:f.maxHp,
      move:f.moveMul,cast:f.castMul,cc,stun:f.stun,ultReady:f.cds.s4===0,
      rhythm:[T.markRhythmHits,T.markRhythmDmg,T.markRhythmCdCut*window.__RT],rhythmDamage,rhythmCds,rhythmStacks:f.tanMarkHits};
  });
  ok(!mark.exact && mark.started && mark.active && mark.maxHp===1333,
    'Mark triggers strictly below 40% of a runtime maxHp value', mark.maxHp);
  ok(near(mark.hpAfter,mark.hpBefore,.01), 'Mark restores no HP', `${mark.hpBefore}/${mark.hpAfter}`);
  ok(near(mark.move,1.25) && near(mark.cast,1.25) && mark.cc && near(mark.stun,.75),
    'Mark grants +25% move/cast and 25% status resistance');
  ok(mark.rhythm.join('/')==='3/18/0.75','Hinokami Rhythm constants are exact',mark.rhythm.join('/'));
  ok(mark.rhythmDamage===98 && mark.rhythmStacks===0 && mark.rhythmCds.every((x,i)=>near(x,[8.25,13.25,12.25][i],.02)),
    'three marked basic hits trigger +18 damage and shave 0.75s from all Breathing Form cooldowns',`${mark.rhythmDamage} / ${mark.rhythmCds.map(x=>x.toFixed(2)).join('/')}`);
  ok(mark.ultReady, 'Thirteenth Form unlocks only after the Mark animation');

  console.log('\n=== 6. Ultimate mitigation, 210 cap and Bright Red suppression ===');
  const ult = await page.evaluate(() => {
    const G=window.__G(), T=window.__TAN, f=G.fighters.find(x=>x.key==='tanjiro'), e=G.fighters.find(x=>x.key==='chichi');
    f.hp=1000;f.maxHp=1000;f.alive=true;f.tanMarked=true;f.tanMarkAnim=0;f.tanRed=0;f.tanThreadCd=999;
    f.tanAct=null;f.stun=0;f.lock=0;e.hp=1200;e.maxHp=1200;e.alive=true;e.evade=0;e.dodge=0;e.dmgRes=0;e.dmgTake=1;e.invuln=0;e.dots=[];
    f.x=300;f.y=350;e.x=355;e.y=350;
    window.__tanUltimate(f,e); const own0=f.hp; window.__hurt(f,100,e,false,'big'); const taken=own0-f.hp;
    f.stun=0; const cc=window.__stunFx(f,1,'spark'), ultStun=f.stun;
    f.stun=0; const target0=e.hp; let n=0; while(f.tanAct&&n++<800)window.__tanjiroTick(f,1/120);
    const dealt=target0-e.hp, red=f.tanRed*window.__RT, dots=e.dots.length;
    const h=e.hp; window.__hurt(e,40,f,false,'big'); const redDamage=h-e.hp, supp=e.regenSupp*window.__RT, factor=window.__regenFactor(e);
    const old=e.regenSupp; window.__hurt(e,40,f,false,'big');
    return {taken,cc,ultStun,dealt,n,red,dots,redDamage,supp,factor,stacked:e.regenSupp>old+.001};
  });
  ok(ult.taken===50 && ult.cc && near(ult.ultStun,.3), 'during Ultimate: 50% damage reduction and 70% status resistance, not invulnerability');
  ok(ult.dealt===210 && ult.n<800 && ult.dots===0, 'Ultimate deals no more than 210 and creates no burn', ult.dealt);
  ok(near(ult.red,6,.04) && ult.redDamage===40, 'Bright Red blade lasts 6s and adds no direct damage');
  ok(near(ult.supp,5,.04) && near(ult.factor,.4) && !ult.stacked,
    'Regeneration Suppression cuts healing by 60% for 5s and does not stack');

  console.log('\n=== 7. AI shares normal melee movement and uses Water Wheel occasionally ===');
  const ai = await page.evaluate(() => {
    const G=window.__G(), C=window.__CHARS.tanjiro, f=G.fighters.find(x=>x.key==='tanjiro'), e=G.fighters.find(x=>x.key==='chichi');
    G.proj=[];G.waves=[];
    const sharedVec=(unit,target)=>{
      unit.x=260;unit.y=350;unit.role='melee';unit.engage=true;unit.orbR=62;
      unit.wx=320;unit.wy=410;unit.jx=.25;unit.jy=-.15;unit.strafe=1;unit.dodge=0;
      target.x=360;target.y=350;
      return window.__aiVec(unit,target);
    };
    const tanMove=sharedVec(f,e);
    const chiMove=sharedVec(e,f);
    const prep=(range)=>{
      f.x=260;f.y=350;e.x=f.x+range;e.y=f.y;f.tanAct=null;f.tanEntry=null;f.tanMarkAnim=0;
      f.tanThink=0;f.tanReset=0;f.tanCombo=0;f.tanMarked=false;
      f.cds.s1=f.cds.s2=f.cds.s3=0;f.cds.s4=999;f.cds.basic=0;
    };
    const oldRandom=Math.random;
    Math.random=()=>.9; // default close decision must start with the basic combo
    prep(64);C.think(f,e,64,true);const basic1=f.tanCombo, basicAct=f.tanAct;
    Math.random=()=>0; // an in-progress combo must finish even when a form roll would win
    f.cds.basic=0;C.think(f,e,64,true);const basic2=f.tanCombo;
    f.cds.basic=0;C.think(f,e,64,true);const basic3=f.tanCombo, comboReset=f.tanReset;
    prep(64);const rolls=[.1,.9];Math.random=()=>rolls.shift()??.9;
    C.think(f,e,64,true);const occasionalForm=f.tanAct&&f.tanAct.kind;
    Math.random=()=>.9;
    prep(300);f.tanWheelWait=1;C.think(f,e,300,true);const held=f.tanAct;
    prep(300);f.tanWheelWait=0;C.think(f,e,300,true);const far=f.tanAct&&f.tanAct.kind, nextWheel=f.tanWheelWait;
    prep(64);f.tanReset=1;C.think(f,e,64,true);const gated=f.tanAct;
    Math.random=oldRandom;
    return {tanMove,chiMove,basic1,basic2,basic3,basicAct,comboReset,occasionalForm,
      held,far,nextWheel,wheelCd:window.__TAN.wheelCd,gated,
      cooldowns:[window.__TAN.wheelCd,window.__TAN.fluxCd,window.__TAN.sunCd,window.__TAN.ultCd].map(x=>x*window.__RT),
      wheelWait:[window.__TAN.wheelAiMin*window.__RT,window.__TAN.wheelAiMax*window.__RT],
      chart:window.__DEX.tanjiro.pw,asRank:window.__pwGrade(window.__DEX.tanjiro.pw.as),
      summary:window.__DEX.tanjiro.bio.en};
  });
  ok(near(ai.tanMove.x,ai.chiMove.x)&&near(ai.tanMove.y,ai.chiMove.y),
    'ordinary Tanjiro movement uses the same shared melee vector as ChiChi');
  ok(ai.held===null&&ai.far==='wheel'&&ai.nextWheel>ai.wheelCd,
    'Water Wheel waits beyond its cooldown for an occasional approach window, then closes a long gap');
  ok(ai.basic1===1&&ai.basic2===2&&ai.basic3===0&&ai.basicAct===null&&ai.comboReset>0,
    'close-range AI defaults to and completes the full three-hit basic combo');
  ok(ai.occasionalForm==='flux', 'a Breathing Form is an occasional close-range decision, not the default', ai.occasionalForm);
  ok(ai.gated===null&&ai.comboReset>0, 'a completed combo creates a real action pause before another skill');
  ok(ai.cooldowns.join('/')==='9/14/13/28'&&ai.wheelWait.join('/')==='3.5/6',
    'active cooldowns and the extra Water Wheel decision delay are nerfed', ai.cooldowns.join('/'));
  ok(ai.chart.dmg===72&&ai.chart.dur===56&&ai.chart.mob===72&&ai.chart.as===84&&ai.chart.rng===18&&
     ai.chart.cc===64&&ai.chart.uti===62&&ai.chart.con===68&&ai.chart.cmb===74&&
     ai.asRank==='S'&&/three-hit Nichirin Sword Combo/.test(ai.summary)&&/occasional commitments/.test(ai.summary),
    'power chart and short profile describe the revised combat rhythm');

  ok(errors.length===0, 'no browser page errors', errors[0]);
  await browser.close();
  console.log(`\n${fail===0?'DAT':'HONG'}  ${pass} dat / ${fail} hong`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
