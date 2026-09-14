from pathlib import Path

p=Path('index.html')
s=p.read_text()

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'{label} anchor missing')
    s=s.replace(old,new,1)

rep('directCd:gs(7), directWind:gs(.6), directSpeed:BIC_SPD,','directCd:gs(7), directWind:gs(.45), directSpeed:BIC_SPD,','Direct Shot cast')
rep('puzzleCd:gs(9), puzzleT:gs(1), puzzleMove:.60, puzzleVision:30,','puzzleCd:gs(9), puzzleT:gs(.75), puzzleMove:.60, puzzleVision:30,','Puzzle Pieces cast')
rep('ultRange:500, ultWind:gs(1.1), ultArmor:gs(.35), ultDmg:145, ultDevour:170, ultPierce:.20,','ultRange:500, ultWind:gs(.85), ultArmor:gs(.35), ultDmg:145, ultDevour:170, ultPierce:.20,','Two-Gun Volley cast')
p.write_text(s)

t=Path('tools/t_isagi.js')
q=t.read_text()
anchor="has('directDmg:66, directPerfect:86, directCd:gs(7)','Direct / Perfect Timing nerf');"
if anchor not in q:
    raise SystemExit('t_isagi anchor missing')
extra="\nhas('directCd:gs(7), directWind:gs(.45)','Direct Shot faster cast');\nhas('puzzleCd:gs(9), puzzleT:gs(.75)','Puzzle Pieces faster analysis cast');\nhas('ultRange:500, ultWind:gs(.85)','Two-Gun Volley faster cast');"
q=q.replace(anchor,anchor+extra,1)
t.write_text(q)
