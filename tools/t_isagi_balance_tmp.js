const fs=require('fs');
const {build,playwright}=require('./probe');

const OPP=['tsubasa','conan','gojo','tanjiro','dora','ginyu','suzune','shika','superman','beatrice'];
const N=16, MAX_SIM=120, DT=1/60, CONCURRENCY=8;

(async()=>{
  const file=build(); const {chromium}=playwright();
  const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  async function one(opp,i){
    const isagiA=i%2===0, a=isagiA?'isagi':opp, b=isagiA?opp:'isagi';
    const page=await browser.newPage({viewport:{width:700,height:960}});
    await page.route('**://fonts.*/**',r=>r.abort());
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto('file://'+file,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(220);
      await page.click('#mTabDuel'); await page.click(`#listA .cTile[data-key="${a}"]`); await page.click(`#listB .cTile[data-key="${b}"]`);
      await page.click('#cselGo'); await page.selectOption('#speed','1'); await page.click('#play'); await page.waitForTimeout(1500); await page.click('#play').catch(()=>{});
      const r=await page.evaluate(({dt,maxSim})=>{
        const G=window.__G(); const t0=G.t; let loops=0;
        while(!G.over && G.t-t0<maxSim && loops<maxSim/dt+120){ window.__step(dt); loops++; }
        const mains=G.fighters.filter(f=>f&&!f.summon&&!f.swapAs), alive=mains.filter(f=>f.alive&&f.hp>0); let winner=null;
        if(alive.length===1)winner=alive[0].key; else if(G.winner&&G.winner.key)winner=G.winner.key; else if(G.over){ const ranked=mains.slice().sort((x,y)=>(y.hp||0)-(x.hp||0)); if(ranked.length>1&&ranked[0].hp>ranked[1].hp)winner=ranked[0].key; }
        const ig=mains.find(f=>f.key==='isagi'), o=mains.find(f=>f.key!=='isagi');
        return {winner,over:!!G.over,t:+(G.t-t0).toFixed(2),isagiHp:ig?+ig.hp.toFixed(1):null,oppHp:o?+o.hp.toFixed(1):null,isagiDmg:ig?+(ig.dmgDealt||0).toFixed(1):null,oppDmg:o?+(o.dmgDealt||0).toFixed(1):null,vision:ig?+(ig.vision||0).toFixed(1):null};
      },{dt:DT,maxSim:MAX_SIM});
      return {opp,i,side:isagiA?'A':'B',...r,errors};
    }finally{ await page.close(); }
  }
  const jobs=[]; for(const opp of OPP)for(let i=0;i<N;i++)jobs.push([opp,i]);
  const rows=[]; for(let i=0;i<jobs.length;i+=CONCURRENCY){ rows.push(...await Promise.all(jobs.slice(i,i+CONCURRENCY).map(([o,n])=>one(o,n)))); console.log(`progress ${Math.min(i+CONCURRENCY,jobs.length)}/${jobs.length}`); }
  await browser.close();
  const summary={generatedAt:new Date().toISOString(),matchesPerOpponent:N,maxGameSeconds:MAX_SIM,matchups:{},errors:[]};
  for(const opp of OPP){ const a=rows.filter(r=>r.opp===opp), wins=a.filter(r=>r.winner==='isagi').length, losses=a.filter(r=>r.winner===opp).length, draws=a.length-wins-losses, avg=k=>+(a.reduce((s,r)=>s+(r[k]||0),0)/a.length).toFixed(1); summary.matchups[opp]={matches:a.length,wins,losses,draws,winRate:+(wins/a.length*100).toFixed(1),avgTime:avg('t'),avgIsagiHp:avg('isagiHp'),avgOppHp:avg('oppHp'),avgIsagiDamage:avg('isagiDmg'),avgOppDamage:avg('oppDmg'),avgVision:avg('vision'),winsAsA:a.filter(r=>r.side==='A'&&r.winner==='isagi').length,winsAsB:a.filter(r=>r.side==='B'&&r.winner==='isagi').length}; }
  const wins=rows.filter(r=>r.winner==='isagi').length, losses=rows.filter(r=>r.winner===r.opp).length; summary.total={matches:rows.length,wins,losses,draws:rows.length-wins-losses,winRate:+(wins/rows.length*100).toFixed(1),winsAsA:rows.filter(r=>r.side==='A'&&r.winner==='isagi').length,winsAsB:rows.filter(r=>r.side==='B'&&r.winner==='isagi').length}; summary.errors=rows.flatMap(r=>r.errors.map(e=>({opp:r.opp,i:r.i,error:e})));
  console.log('=== ISAGI BALANCE BENCHMARK ==='); console.log(JSON.stringify(summary,null,2)); if(summary.errors.length)process.exitCode=1;
})();
