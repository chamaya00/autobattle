/* Satoru Gojo — contract test for shared HP, Infinity, techniques and Domain rules.
   Run: node tools/t_gojo.js */
const { openGame } = require('./probe');

let pass=0,fail=0;
const ok=(c,m,d)=>{console.log((c?'  DAT  ':'  HONG ')+m+(d===undefined?'':` (${d})`));c?pass++:fail++;};
const near=(a,b,e=.03)=>Math.abs(a-b)<=e;

(async()=>{
  const {browser,page,errors}=await openGame('gojo','chichi',{play:false});

  console.log('\n=== 1. Shared HP, English copy and exact constants ===');
  const cfg=await page.evaluate(()=>{
    const X=window.__GOJO,D=window.__DEX.gojo,C=window.__CHARS.gojo,RT=window.__RT;
    const text=[C.name,C.tag,...C.skills,D.role.vi,D.role.en,D.bio.vi,D.bio.en,
      ...D.skills.flatMap(s=>[s.name,s.vi,s.en])].join(' ');
    return {hp:window.__HP.gojo,std:window.__HP_STD,entrance:X.entranceT*RT,basic:X.basic,
      basicCd:X.basicCd*RT,basicStun:X.basicStun*RT,blue:[X.blueDmg,X.blueSplash,X.blueCd*RT,X.blueWind*RT,X.blueStun*RT],
      red:[X.redDmg,X.redCd*RT,X.redWind*RT,X.redBreak*RT,X.redStun*RT],
      purple:[X.purpleDmg,X.purpleSecond,X.purpleCd*RT,X.purpleWind*RT,X.purpleLock*RT],
      domain:[X.domainCd*RT,X.domainWind*RT,X.domainBreak*RT,X.overloadT*RT,X.overwhelmedT*RT],
      inf:[X.infinityMax,X.infinityDelay*RT,X.infinityStep*RT],
      names:['Satoru Gojo','Mage','Controller','Six Eyes','Infinity','Infinity Charge','Limitless Combat',
        'Blue-Enhanced Strike','Cursed Technique Lapse: Blue','Cursed Technique Reversal: Red',
        'Hollow Technique: Purple','Domain Expansion: Unlimited Void','Information Overload','Overwhelmed']
        .every(x=>text.includes(x)), vietnamese:/[À-ỹ]/.test(text), chart:D.pw};
  });
  ok(cfg.hp===cfg.std,'Maximum HP comes from the shared stat system',`${cfg.hp}/${cfg.std}`);
  ok(near(cfg.entrance,1.5)&&cfg.basic.join('/')==='18/18/28'&&cfg.basicCd===.75&&cfg.basicStun===.25,
    'entrance and Limitless Combat values are exact');
  ok(cfg.blue.join('/')==='55/30/8.5/0.55/0.6'&&cfg.red.join('/')==='80/11/0.7/0.45/0.75',
    'Blue and Red values are exact');
  ok(cfg.purple.join('/')==='150/0.6/22/1.6/4'&&cfg.domain.join('/')==='32/1.2/0.8/2.5/4',
    'Purple and Unlimited Void values are exact');
  ok(cfg.inf.join('/')==='2/3/5.5','Infinity is two charges with 3s delay and 5.5s recharge');
  ok(cfg.names&&!cfg.vietnamese,'all Gojo names, statuses and display copy are English');
  ok(cfg.chart.cmb<=25&&cfg.chart.dmg>=80&&cfg.chart.rng>=80&&cfg.chart.con>=80&&cfg.chart.cc>=72&&cfg.chart.cc<=76&&cfg.chart.as<70&&cfg.chart.mob<60,'power chart matches the requested burst/range/consistency profile');

  console.log('\n=== 2. Entrance freezes the opponent for all four phases ===');
  const ent=await page.evaluate(()=>{
    const G=window.__G(),f=G.fighters.find(x=>x.key==='gojo'),e=G.fighters.find(x=>x.key==='chichi');
    const x=e.x,y=e.y,h=e.hp,poses=new Set();let n=0;
    while(f.gojoEntry&&n++<400){window.__step(1/120);poses.add(f.pose);}
    return {seconds:G.t*window.__RT,moved:Math.hypot(e.x-x,e.y-y),damage:h-e.hp,poses:[...poses],done:!f.gojoEntry};
  });
  ok(ent.done&&near(ent.seconds,1.5,.04),'entrance completes at exactly 1.5 player seconds',ent.seconds.toFixed(3));
  ok(ent.moved<1&&ent.damage===0,'the opponent waits without moving or attacking');
  ok(ent.poses.includes('entry')&&ent.poses.includes('adjust')&&ent.poses.includes('idle'),
    'space distortion, blindfold adjustment and stance phases are present',ent.poses.join(','));

  console.log('\n=== 3. Infinity blocks only direct hits and recharges on its own clock ===');
  const inf=await page.evaluate(()=>{
    const G=window.__G(),f=G.fighters.find(x=>x.key==='gojo'),e=G.fighters.find(x=>x.key==='chichi'),X=window.__GOJO;
    f.gojoEntry=null;f.gojoHide=false;f.hp=1000;f.maxHp=1000;f.infinity=2;f.infinityLock=0;f.infinityDelay=0;f.infinityTick=0;
    e.dmgOut=1;const h0=f.hp,direct=window.__hurt(f,80,e,false,'big');
    const h1=f.hp,dot=window.__hurt(f,20,e,false,'dot');
    window.__hurt(f,30,e,false,'big');
    const empty=f.infinity,h2=f.hp;window.__hurt(f,30,e,false,'big');const exposed=h2-f.hp;
    f.infinity=1;f.infinityDelay=X.infinityDelay;f.infinityTick=0;
    window.__gojoStatus(f,X.infinityDelay-.001);const before=f.infinity;
    window.__gojoStatus(f,.002);window.__gojoStatus(f,X.infinityStep);const after=f.infinity;
    return {direct,dot,blocked:h0-h1,dotDamage:h1-f.hp+exposed-30,empty,exposed,before,after};
  });
  ok(!inf.direct&&inf.blocked===0,'a direct hit consumes one charge and deals no damage');
  ok(inf.dot&&inf.empty===0&&inf.exposed===30,'DoT bypasses Infinity and direct hits land once charges are empty');
  ok(inf.before===1&&inf.after===2,'passive recharge waits 3s, then restores one charge after 5.5s');

  console.log('\n=== 4. Blue restores once; Purple consumes all charges and stays fixed ===');
  const skills=await page.evaluate(()=>{
    const G=window.__G(),f=G.fighters.find(x=>x.key==='gojo'),e=G.fighters.find(x=>x.key==='chichi');
    const prep=()=>{f.gojoEntry=null;f.gojoHide=false;f.gojoAct=null;f.gojoShots=[];f.stun=0;f.lock=0;
      e.hp=1000;e.maxHp=1000;e.alive=true;e.evade=0;e.dodge=0;e.dmgRes=0;e.dmgTake=1;e.invuln=0;e.stun=0;
      f.x=260;f.y=350;e.x=360;e.y=350;};
    prep();f.infinity=1;let h=e.hp;window.__gojoBlue(f,e);for(let i=0;i<200&&f.gojoAct;i++)window.__gojoTick(f,1/120);
    const blue=h-e.hp,restored=f.infinity;
    prep();f.infinity=2;h=e.hp;window.__gojoPurple(f,e);const spent=f.infinity,lock=f.infinityLock*window.__RT,ang=f.gojoAct.ang;
    e.y+=120;for(let i=0;i<500&&(f.gojoAct||f.gojoShots.length);i++)window.__gojoTick(f,1/120);
    const missed=h-e.hp,fixed=ang;
    prep();f.infinity=2;e.dmgRes=.5;h=e.hp;window.__gojoPurple(f,e);for(let i=0;i<500&&(f.gojoAct||f.gojoShots.length);i++)window.__gojoTick(f,1/120);
    return {blue,restored,spent,lock,missed,fixed,purple:h-e.hp};
  });
  ok(skills.blue===55&&skills.restored===2,'Blue deals 55 and restores exactly one shared Infinity charge');
  ok(skills.spent===0&&near(skills.lock,4,.04)&&skills.missed===0,'Purple consumes all charges immediately and can miss its fixed line');
  ok(near(skills.purple,97.5,.01),'Purple ignores 30% of a target\'s 50% damage reduction',skills.purple);

  console.log('\n=== 5. Unlimited Void deals zero and transitions into Overwhelmed ===');
  const domain=await page.evaluate(()=>{
    const G=window.__G(),f=G.fighters.find(x=>x.key==='gojo'),e=G.fighters.find(x=>x.key==='chichi'),X=window.__GOJO;
    f.gojoEntry=null;f.gojoHide=false;f.gojoAct=null;f.stun=0;f.lock=0;f.x=270;f.y=350;
    e.x=380;e.y=350;e.hp=1000;e.stun=0;e.infoOverload=0;e.overwhelmed=0;
    window.__gojoDomain(f,e);for(let i=0;i<300&&f.gojoAct;i++)window.__gojoTick(f,1/120);
    const hp=e.hp,over=e.infoOverload*window.__RT,stun=e.stun*window.__RT;
    window.__gojoStatus(e,X.overloadT+.01);
    e.moveMul=1;e.castMul=1;window.__gojoStatus(e,0);
    return {damage:1000-hp,over,stun,overwhelmed:e.overwhelmed*window.__RT,move:e.moveMul,cast:e.castMul};
  });
  ok(domain.damage===0&&near(domain.over,2.5,.04)&&near(domain.stun,2.5,.04),
    'Unlimited Void applies 2.5s Information Overload and deals 0 damage');
  ok(near(domain.overwhelmed,4,.04)&&domain.move===.5&&domain.cast===.6,
    'Information Overload transitions to 4s Overwhelmed: −50% move, −40% attack/cast');

  ok(errors.length===0,'no browser page errors',errors[0]);
  await browser.close();
  console.log(`\n${fail===0?'DAT':'HONG'}  ${pass} dat / ${fail} hong`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
