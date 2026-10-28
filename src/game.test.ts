import test from 'node:test';
import assert from 'node:assert/strict';
import {GameState,newDeck} from './game.ts';
import {cardById} from './cards.ts';
test('48 unique cards; four per month',()=>{const d=newDeck();assert.equal(new Set(d.map(c=>c.id)).size,48);for(let m=1;m<=12;m++)assert.equal(d.filter(c=>c.month===m).length,4);});
test('deal and complete round preserve every card',()=>{for(let n=0;n<100;n++){const s=new GameState();assert.deepEqual(s.hands.map(h=>h.length),[10,10]);assert.equal(s.table.length,8);assert.equal(s.deck.length,20);while(!s.finished){for(let p=0;p<2;p++){s.place(p,s.hands[p].shift()!);s.place(p,s.deck.shift()!);}}const all=[...s.table,...s.captured.flat()];assert.equal(all.length,48);assert.equal(new Set(all.map(c=>c.id)).size,48);}});
test('two matching cards allow chosen target',()=>{const s=new GameState();s.table=[cardById(0),cardById(1)];s.place(0,cardById(2),1);assert.deepEqual(s.table.map(c=>c.id),[0]);assert.deepEqual(s.captured[0].map(c=>c.id),[2,1]);});
import {CARDS} from './cards.ts';
const 국진=CARDS.find(c=>c.gukjin)!;
const 피들=CARDS.filter(c=>c.kind==='피'&&!c.ssangpi);
const 다른열끗=CARDS.filter(c=>c.kind==='열끗'&&!c.gukjin);
function withCaptured(player:number,cards:typeof CARDS[number][]){const s=new GameState();s.captured[player]=[...cards];return s;}
test('국진 획득 전에는 선택 대기 없음, 선택 시도는 오류',()=>{const s=withCaptured(0,피들.slice(0,3));assert.equal(s.pendingGukjin(0),false);assert.throws(()=>s.chooseGukjin(0,'피'),/획득하지 않았/);assert.equal(s.gukjinChoice[0],null);});
test('국진 획득 시 선택 대기, 선택 전 점수는 열끗 기준',()=>{const s=withCaptured(0,[국진,...다른열끗.slice(0,4)]);assert.equal(s.pendingGukjin(0),true);assert.equal(s.score(0).열끗.cards.length,5);assert.equal(s.score(0).total,1);});
test('예상 합계는 두 선택지를 각각 계산한다',()=>{const s=withCaptured(0,[국진,...피들.slice(0,8),...다른열끗.slice(0,4)]);assert.deepEqual(s.previewGukjin(0),{열끗:1,피:1});const t=withCaptured(0,[국진,...피들.slice(0,8)]);assert.deepEqual(t.previewGukjin(0),{열끗:0,피:1});});
test('쌍피 선택 시 열끗과 피에 중복 계산되지 않는다',()=>{const s=withCaptured(0,[국진,...피들.slice(0,8),...다른열끗.slice(0,4)]);s.chooseGukjin(0,'피');const sc=s.score(0);assert.equal(sc.열끗.cards.length,4);assert.equal(sc.피.cards.filter(c=>c.gukjin).length,1);assert.equal(sc.피.value,10);assert.equal(sc.열끗.cards.some(c=>c.gukjin),false);assert.equal(sc.광.cards.length+sc.열끗.cards.length+sc.띠.cards.length+sc.피.cards.length,s.captured[0].length);assert.equal(sc.total,1);});
test('선택은 한 판에 한 번만, 재선택은 오류이고 값은 유지',()=>{const s=withCaptured(0,[국진]);s.chooseGukjin(0,'열끗');assert.throws(()=>s.chooseGukjin(0,'피'),/이미 확정/);assert.equal(s.gukjinChoice[0],'열끗');assert.equal(s.pendingGukjin(0),false);assert.equal(s.gukjinChoice[1],null);});
test('컴퓨터 자동 선택: 합계가 높은 쪽, 동점이면 열끗',()=>{const a=withCaptured(1,[국진,...피들.slice(0,8)]);assert.equal(a.autoChooseGukjin(1),'피');const b=withCaptured(1,[국진,...다른열끗.slice(0,4)]);assert.equal(b.autoChooseGukjin(1),'열끗');const c=withCaptured(1,[국진]);assert.equal(c.autoChooseGukjin(1),'열끗');assert.throws(()=>c.autoChooseGukjin(1));assert.equal(c.gukjinChoice[1],'열끗');});
test('새 판은 선택 상태가 초기화된다',()=>{const s=withCaptured(0,[국진]);s.chooseGukjin(0,'피');const n=new GameState();assert.deepEqual(n.gukjinChoice,[null,null]);assert.deepEqual(n.captured,[[],[]]);assert.equal(n.pendingGukjin(0),false);});

// ---- 고/스톱 · 승패 판정 ----
import {GO_STOP_THRESHOLD} from './game.ts';
import {settlementPoints} from './score.ts';
const 일반광=CARDS.filter(c=>c.kind==='광'&&!c.rainGwang);
/** 기본 점수 6점: 삼광 3 + 피 12장 3점. 7점: 피 13장 4점. */
const 여섯점=[...일반광.slice(0,3),...피들.slice(0,12)];
const 일곱점=[...일반광.slice(0,3),...피들.slice(0,13)];
/** 승리 결과의 핵심 항목만 비교(박 항목은 별도 테스트). */
const winLike=(r:unknown,exp:Record<string,number>)=>{const o=r as Record<string,unknown>;assert.equal(o.outcome,'승리');for(const k of Object.keys(exp))assert.equal(o[k],exp[k],k);};
test('고/스톱 최초 조건: 6점은 선택 불가, 7점은 선택 가능',()=>{
  assert.equal(GO_STOP_THRESHOLD,7);
  const a=withCaptured(0,여섯점);assert.equal(a.baseScore(0),6);assert.equal(a.canDecide(0),false);assert.equal(a.canGo(0),false);
  assert.throws(()=>a.declareGo(0),/선택할 수 없습니다/);assert.throws(()=>a.declareStop(0),/선택할 수 없습니다/);assert.equal(a.result,null);
  const b=withCaptured(0,일곱점);assert.equal(b.baseScore(0),7);assert.equal(b.canDecide(0),true);assert.equal(b.canGo(0),true);
});
test('고 이후 기본 점수가 유지되면 재선택 없음, 상승하면 재선택',()=>{
  const s=withCaptured(0,일곱점);
  assert.equal(s.declareGo(0),1);assert.deepEqual([s.goCount[0],s.goBase[0]],[1,7]);
  assert.equal(s.canDecide(0),false); // 같은 7점: 고 보너스가 아닌 기본 점수 기준
  assert.throws(()=>s.declareGo(0));assert.throws(()=>s.declareStop(0));
  s.captured[0].push(피들[13]);assert.equal(s.baseScore(0),8);assert.equal(s.canDecide(0),true);
  assert.equal(s.declareGo(0),2);assert.equal(s.goBase[0],8);assert.equal(s.canDecide(0),false);
  s.captured[0].push(피들[14]);const r=s.declareStop(0);
  winLike(r,{winner:0,base:9,goCount:2,settled:11});
});
test('고 횟수별 정산이 결과에 반영된다(3고 이상 배수)',()=>{
  const s=withCaptured(0,일곱점);
  for(let n=1;n<=3;n++){s.declareGo(0);s.captured[0].push(피들[12+n]);}
  assert.equal(s.goCount[0],3);assert.equal(s.baseScore(0),10);
  assert.equal(s.stopPreview(0),settlementPoints(10,3));
  const r=s.declareStop(0);winLike(r,{winner:0,base:10,goCount:3,settled:24});
});
test('국진 선택이 끝나야 고/스톱을 판단한다',()=>{
  const s=withCaptured(0,[...일곱점,국진,...다른열끗.slice(0,4)]); // 선택 전 열끗 기준 8점
  assert.equal(s.baseScore(0),8);assert.equal(s.pendingGukjin(0),true);
  assert.equal(s.canDecide(0),false);assert.throws(()=>s.declareStop(0));
  s.chooseGukjin(0,'피');assert.equal(s.pendingGukjin(0),false);
  assert.equal(s.baseScore(0),3+ (15-9));assert.equal(s.canDecide(0),true);
  winLike(s.declareStop(0),{winner:0,base:9,goCount:0,settled:9});
});
test('스톱 후에는 상대 턴·획득·선택이 모두 막힌다',()=>{
  const s=withCaptured(0,일곱점);s.captured[1]=[...피들.slice(13,22),...일반광.slice(3)];
  const r=s.declareStop(0);assert.equal(s.over,true);assert.equal(r.outcome,'승리');
  assert.throws(()=>s.place(1,s.hands[1][0]),/판이 끝났습니다/);
  assert.equal(s.canDecide(1),false);assert.throws(()=>s.declareStop(1));assert.throws(()=>s.declareGo(0));
  assert.equal(s.hands[1].length,10);assert.deepEqual(s.result,r); // 결과 불변
});
test('마지막 손패를 낸 턴: 고 금지, 스톱 정산',()=>{
  const s=withCaptured(0,일곱점);s.hands[0]=[];
  assert.equal(s.canDecide(0),true);assert.equal(s.canGo(0),false);
  assert.throws(()=>s.declareGo(0),/마지막 행동/);assert.equal(s.goCount[0],0);
  winLike(s.declareStop(0),{winner:0,base:7,goCount:0,settled:7});
  const t=withCaptured(0,일곱점);t.declareGo(0);t.captured[0].push(피들[13]);t.hands[0]=[];
  assert.throws(()=>t.declareGo(0),/마지막 행동/);winLike(t.declareStop(0),{winner:0,base:8,goCount:1,settled:9});
});
test('나가리: 손패 소진까지 승자 없음, 기본 점수 우열로 승자를 정하지 않음',()=>{
  const s=withCaptured(0,일곱점);s.captured[1]=[];
  assert.equal(s.settleIfExhausted(),null); // 아직 손패가 남음
  s.hands=[[],[]];assert.equal(s.finished,true);
  const r=s.settleIfExhausted();assert.deepEqual(r,{outcome:'나가리'});assert.equal(s.over,true);
  assert.equal(s.canDecide(0),false);assert.throws(()=>s.declareStop(0));
  assert.deepEqual(s.settleIfExhausted(),{outcome:'나가리'}); // 재호출해도 유지
  const w=withCaptured(0,일곱점);w.declareStop(0);w.hands=[[],[]];assert.equal(w.settleIfExhausted()?.outcome,'승리'); // 승자가 있으면 덮어쓰지 않음
});
test('새 판은 고 횟수·직전 고 점수·승패·국진 선택이 모두 초기화된다',()=>{
  const s=withCaptured(0,[...일곱점,국진]);s.chooseGukjin(0,'피');s.declareGo(0);s.captured[0].push(피들[13]);s.declareStop(0);
  const n=new GameState();
  assert.deepEqual(n.goCount,[0,0]);assert.deepEqual(n.goBase,[null,null]);assert.equal(n.result,null);assert.equal(n.over,false);
  assert.deepEqual(n.gukjinChoice,[null,null]);assert.deepEqual(n.captured,[[],[]]);
  assert.deepEqual(n.hands.map(h=>h.length),[10,10]);assert.equal(n.canDecide(0),false);
});

// ---- 피박·광박·고박과 정산 ----
const 비광=CARDS.find(c=>c.rainGwang)!;
const 띠홍=CARDS.filter(c=>c.band==='홍단'), 띠청=CARDS.filter(c=>c.band==='청단');
type Won=Extract<ReturnType<GameState['declareStop']>,{outcome:'승리'}>;
/** 승자(0) 획득·고, 패자(1) 획득·고·국진 선택을 두고 스톱한 결과. */
function stopWith(o:{win:typeof CARDS[number][];winGo?:number;lose:typeof CARDS[number][];loseGo?:number;loseGukjin?:'열끗'|'피';emptyHand?:boolean}){
  const s=withCaptured(0,o.win);s.captured[1]=[...o.lose];
  s.goCount[0]=o.winGo??0;s.goCount[1]=o.loseGo??0;
  if(o.loseGukjin)s.chooseGukjin(1,o.loseGukjin);
  if(o.emptyHand)s.hands[0]=[];
  const r=s.declareStop(0);assert.equal(r.outcome,'승리');return {s,r:r as Won};
}
test('피박 경계: 패자 피 가치 0 면제, 1·7 적용, 8 미적용',()=>{
  for(const [n,expect] of [[0,false],[1,true],[7,true],[8,false]] as const){
    const {r}=stopWith({win:일곱점,lose:피들.slice(13,13+n)});
    assert.equal(r.baks.includes('피박'),expect,`피 ${n}`);
    assert.ok(r.baks.includes('광박')); // 승자 삼광 3점, 패자 광 0장
    assert.equal(r.multiplier,expect?4:2);assert.equal(r.final,7*r.multiplier);assert.equal(r.settled,7);
  }
});
test('승자에게 피 점수가 없으면 피박 미적용',()=>{
  const win=[...일반광.slice(0,3),...띠홍,...띠청]; // 광 3 + 띠 6장(2)+홍단3+청단3 = 11점, 피 0
  const {r}=stopWith({win,lose:피들.slice(0,3)});
  assert.equal(r.base,11);assert.ok(!r.baks.includes('피박'));assert.ok(r.baks.includes('광박'));
});
test('국진을 쌍피로 선택하면 피 가치가 올라 피박 경계를 벗어난다',()=>{
  const lose=[...피들.slice(13,19),국진]; // 피 6 + 국진
  const a=stopWith({win:일곱점,lose,loseGukjin:'열끗'});assert.ok(a.r.baks.includes('피박'));  // 피 가치 6
  const b=stopWith({win:일곱점,lose,loseGukjin:'피'});assert.ok(!b.r.baks.includes('피박'));  // 피 가치 8
});
test('패자에게 비광 한 장만 있어도 광박 미적용',()=>{
  const {r}=stopWith({win:일곱점,lose:[비광]});
  assert.ok(!r.baks.includes('광박'));assert.deepEqual(r.baks,[]);assert.equal(r.multiplier,1);assert.equal(r.final,7);
});
test('고박: 패자 고 0회 미적용, 1회·여러 회 모두 한 번만 ×2',()=>{
  const lose=[비광,...피들.slice(13,21)]; // 광 1장, 피 8 → 광박·피박 없음
  assert.deepEqual(stopWith({win:일곱점,lose,loseGo:0}).r.baks,[]);
  const one=stopWith({win:일곱점,lose,loseGo:1}).r;assert.deepEqual(one.baks,['고박']);assert.equal(one.final,14);
  const many=stopWith({win:일곱점,lose,loseGo:3}).r;assert.deepEqual(many.baks,['고박']);assert.equal(many.multiplier,2);assert.equal(many.final,14);
});
test('세 박 중첩은 ×8이고 고 공식과 함께 계산된다 (예: 기본 10, 2고, 피박·광박 → 48)',()=>{
  const win=[...일곱점,...피들.slice(13,16)]; // 광 3 + 피 16(7) = 10점
  const ex=stopWith({win,winGo:2,lose:피들.slice(16,19),loseGo:0}).r;
  assert.deepEqual([ex.base,ex.goCount,ex.settled,ex.baks,ex.multiplier,ex.final],[10,2,12,['피박','광박'],4,48]);
  const all=stopWith({win,winGo:2,lose:피들.slice(16,19),loseGo:1}).r;
  assert.deepEqual([all.baks,all.multiplier,all.final],[['피박','광박','고박'],8,96]);
  const three=stopWith({win,winGo:3,lose:피들.slice(16,19),loseGo:1}).r; // (10+2)×2 = 24, ×8
  assert.deepEqual([three.settled,three.final],[24,192]);
});
test('마지막 손패의 자동 스톱에도 박이 적용된다',()=>{
  const {s,r}=stopWith({win:일곱점,lose:피들.slice(13,16),emptyHand:true});
  assert.equal(s.canGo(0),false);assert.deepEqual(r.baks,['피박','광박']);assert.equal(r.final,28);
});
test('나가리에는 박·정산이 없고, 새 판은 초기화되며, 결과는 다시 정산되지 않는다',()=>{
  const n=withCaptured(0,일곱점);n.captured[1]=[];n.goCount[1]=2;n.hands=[[],[]];
  const d=n.settleIfExhausted()!;assert.equal(d.outcome,'나가리');assert.ok(!('final' in d)&&!('baks' in d));
  const {s,r}=stopWith({win:일곱점,lose:피들.slice(13,16),loseGo:1});
  const snapshot=JSON.stringify(r);
  s.captured[1].push(비광,...피들.slice(16,21));s.goCount[1]=0; // 결과 확정 뒤 상태가 바뀌어도
  assert.throws(()=>s.declareStop(0));assert.equal(JSON.stringify(s.result),snapshot); // 재정산 없음
  assert.notDeepEqual(s.previewSettlement(0).baks,r.baks); // 미리보기는 달라져도 결과는 그대로
  const fresh=new GameState();assert.equal(fresh.result,null);assert.deepEqual(fresh.goCount,[0,0]);assert.deepEqual(fresh.gukjinChoice,[null,null]);
});

// ---- 상대 피 가져오기 · 국진 이동 · 턴 계획 적용 ----
const 쌍피들=CARDS.filter(c=>c.ssangpi);
test('피 가져오기: 일반 피 우선(id 순), 없으면 쌍피, 피가 없으면 빚 없이 중단, 여러 회는 매번 다시 고른다',()=>{
  const s=new GameState();s.captured[1]=[피들[5],피들[1],쌍피들[0],일반광[0]];s.captured[0]=[];
  assert.deepEqual(s.peekSteal(1,1).map(c=>c.id),[피들[1].id]);
  const moved=s.stealPi(1,0,2);
  assert.deepEqual(moved.map(c=>c.id),[피들[1].id,피들[5].id]);
  assert.deepEqual(s.captured[1].map(c=>c.id).sort((a,b)=>a-b),[쌍피들[0].id,일반광[0].id].sort((a,b)=>a-b));
  assert.deepEqual(s.stealPi(1,0,1).map(c=>c.id),[쌍피들[0].id]); // 일반 피가 없으면 쌍피
  assert.deepEqual(s.stealPi(1,0,3),[]); // 피 없음 → 가져오지 않음
  assert.deepEqual(s.captured[1].map(c=>c.id),[일반광[0].id]);
  assert.equal(s.captured[0].length,3);
  const t=new GameState();t.captured[1]=[쌍피들[1]];assert.deepEqual(t.stealPi(1,0,1).map(c=>c.id),[쌍피들[1].id]); // 쌍피만 있음
});
test('국진은 쌍피로 선택된 경우에만 가져오고, 이동해도 결정이 유지되어 새 소유자에게 묻지 않는다',()=>{
  const a=new GameState();a.captured[1]=[국진];a.chooseGukjin(1,'열끗');
  assert.deepEqual(a.stealPi(1,0,1),[]); // 열끗이면 대상 아님
  const b=new GameState();b.captured[1]=[국진];b.chooseGukjin(1,'피');
  assert.deepEqual(b.stealPi(1,0,1).map(c=>c.id),[국진.id]);
  assert.equal(b.pendingGukjin(0),false);assert.equal(b.gukjinUse(0),'피');assert.equal(b.gukjinUse(1),null);
  assert.equal(b.score(0).피.value,2);assert.equal(b.score(0).열끗.cards.length,0);
  assert.throws(()=>b.chooseGukjin(0,'열끗'),/이미 확정/);
});
test('피 이동으로 바뀐 최종 상태로 점수·피박·고/스톱을 판단한다',()=>{
  const s=new GameState();
  s.captured[0]=[...일반광.slice(0,3),...피들.slice(0,12)]; // 광 3 + 피 12(3) = 6점 → 아직 불가
  s.captured[1]=[...피들.slice(12,20)]; // 피 8 → 피박 아님
  assert.equal(s.canDecide(0),false);
  s.stealPi(1,0,1); // 쓸 등으로 한 장 가져오면
  assert.equal(s.baseScore(0),7);assert.equal(s.canDecide(0),true);
  assert.ok(s.previewSettlement(0).baks.includes('피박')); // 상대 피 7 → 피박
});
test('턴 계획 적용 뒤에도 48장이 고유하게 보존되고, 같은 계획을 두 번 적용할 수 없다',()=>{
  for(let n=0;n<30;n++){
    const s=new GameState();
    while(!s.finished&&!s.over){
      for(const p of [0,1]){
        if(!s.hands[p].length)continue;
        const card=s.hands[p][0];
        let plan=s.planTurn(p,card);
        if(plan.needsDeckChoice)plan=s.planTurn(p,card,undefined,plan.needsDeckChoice[1].id);
        s.applyTurn(plan);
        if(s.pendingGukjin(p))s.autoChooseGukjin(p);
        s.stealPi(1-p,p,plan.piSteals);
        const all=s.allCardIds();assert.equal(all.length,48);assert.equal(new Set(all).size,48);
        assert.throws(()=>s.applyTurn(plan),/이미 적용/); // 같은 계획 재적용 거부
      }
    }
    assert.equal(s.deck.length,0);
  }
});
test('새 판은 뻑 소유자와 국진 결정을 초기화한다',()=>{
  const s=new GameState();s.ppeok.set(1,0);s.captured[0]=[국진];s.chooseGukjin(0,'피');
  const n=new GameState();assert.equal(n.ppeok.size,0);assert.equal(n.gukjinDecision,null);assert.deepEqual(n.gukjinChoice,[null,null]);
});

test('applyTurn은 현재 판·턴의 미적용 계획만 받는다: 중복·이전 턴·다른 판 계획은 거부하고 상태를 바꾸지 않는다',()=>{
  const s=new GameState();
  const snap=()=>JSON.stringify([s.turn,s.allCardIds(),s.table.map(c=>c.id),s.captured]);
  const old=s.planTurn(0,s.hands[0][0]);             // 턴 0 계획 A
  assert.deepEqual([old.roundId,old.turnNo,old.applied],[s.roundId,0,false]);
  const other=s.planTurn(0,s.hands[0][1]);           // 같은 턴의 다른 계획 B
  s.applyTurn(other);                                 // B 적용 → 턴 1
  assert.equal(s.turn,1);assert.equal(other.applied,true);
  let before=snap();
  assert.throws(()=>s.applyTurn(other),/이미 적용/);  // 중복 적용
  assert.throws(()=>s.applyTurn(old),/이전 턴/);      // 이전 턴 계획
  assert.equal(snap(),before,'거부된 적용은 상태를 바꾸지 않는다');
  // 다음 턴에 새로 계획하면 적용된다
  const next=s.planTurn(1,s.hands[1][0]);assert.equal(next.turnNo,1);s.applyTurn(next);assert.equal(s.turn,2);
  // 새 판 시작 전(이전 판)에 만든 계획은 새 판에서 거부된다
  const fresh=new GameState();before=JSON.stringify([fresh.turn,fresh.allCardIds()]);
  const stale=s.planTurn(0,s.hands[0][0]);
  assert.notEqual(fresh.roundId,s.roundId);
  assert.throws(()=>fresh.applyTurn(stale),/다른 판/);
  assert.equal(JSON.stringify([fresh.turn,fresh.allCardIds()]),before);
  assert.equal(fresh.turn,0);
  // 더미 윗장 검사 유지: 턴 번호는 맞지만 더미가 바뀐 계획
  const p=fresh.planTurn(0,fresh.hands[0][0]);
  fresh.deck.unshift(fresh.deck.pop()!);
  assert.throws(()=>fresh.applyTurn(p),/더미 윗장/);
});

// ---- 흔들기 ----
const 월카드=(m:number)=>CARDS.filter(c=>c.month===m);
/** 손패를 지정해 만든 상태(플레이어 0 차례). 나머지 카드는 더미에 둔다. */
function withHands(h0:number[],h1:number[]=[]){
  const s=new GameState();
  const used=new Set([...h0,...h1]);
  s.hands=[h0.map(cardById),h1.map(cardById)];s.table=[];s.captured=[[],[]];
  s.deck=CARDS.filter(c=>!used.has(c.id));
  return s;
}
test('흔들기 후보: 같은 월 정확히 3장만, 4장·2장은 제외, 오름차순',()=>{
  const s=withHands([...월카드(3).slice(0,3).map(c=>c.id),...월카드(1).map(c=>c.id),...월카드(5).slice(0,2).map(c=>c.id),20]);
  assert.deepEqual(s.shakeCandidates(0),[3]);
  const t=withHands([...월카드(7).slice(0,3).map(c=>c.id),...월카드(2).slice(0,3).map(c=>c.id)]);
  assert.deepEqual(t.shakeCandidates(0),[2,7]);
  assert.deepEqual(withHands([0,4,8]).shakeCandidates(0),[]);
});
test('선언: 세 장을 공개용으로 돌려주되 카드·턴 번호는 그대로, 같은 월 재선언 차단, 다른 월 추가 가능',()=>{
  const s=withHands([...월카드(2).slice(0,3).map(c=>c.id),...월카드(7).slice(0,3).map(c=>c.id),20,32]);
  const hand=s.hands[0].map(c=>c.id), turn=s.turn, v=s.version;
  assert.equal(s.canShake(0,2),true);
  const shown=s.declareShake(0,2);
  assert.deepEqual(shown.map(c=>c.id).sort((a,b)=>a-b),월카드(2).slice(0,3).map(c=>c.id));
  assert.deepEqual(s.hands[0].map(c=>c.id),hand);assert.equal(s.turn,turn);assert.equal(s.version,v+1);
  assert.deepEqual(s.shakes[0],[2]);assert.equal(s.canShake(0,2),false);assert.deepEqual(s.shakeCandidates(0),[7]);
  assert.throws(()=>s.declareShake(0,2),/이미 흔들었/);
  s.declareShake(0,7);assert.deepEqual(s.shakes[0],[2,7]);assert.deepEqual(s.shakeCandidates(0),[]);
  assert.equal(s.allCardIds().length,48);
});
test('선언 차단: 상대 차례, 조건 미달, 판 종료 후',()=>{
  const s=withHands([20,24,28],월카드(2).slice(0,3).map(c=>c.id));
  assert.equal(s.canShake(1,2),false);assert.throws(()=>s.declareShake(1,2),/자기 차례/); // 턴 0은 플레이어 0 차례
  assert.throws(()=>s.declareShake(0,5),/조건/);
  const p=s.planTurn(0,s.hands[0][0]);s.applyTurn(p); // 턴 1 = 플레이어 1 차례
  assert.equal(s.currentPlayer,1);assert.equal(s.canShake(1,2),true);assert.throws(()=>s.declareShake(0,2),/자기 차례/);
  const o=withHands(월카드(2).slice(0,3).map(c=>c.id));o.captured[0]=[...일곱점];o.declareStop(0);
  assert.throws(()=>o.declareShake(0,2),/판이 끝나/);
});
test('흔들기 선언 뒤에는 그 전에 만든 턴 계획이 거부되고, 다시 계획하면 적용된다',()=>{
  const s=withHands([...월카드(2).slice(0,3).map(c=>c.id),20]);
  const stale=s.planTurn(0,s.hands[0][3]);
  s.declareShake(0,2);
  assert.throws(()=>s.applyTurn(stale),/상태가 바뀌었습니다/);
  assert.equal(s.turn,0);assert.equal(s.hands[0].length,4);
  const fresh=s.planTurn(0,s.hands[0][3]);s.applyTurn(fresh);assert.equal(s.turn,1);
});
test('정산: 승자의 흔들기만 2^횟수로 곱하고 고·박과 함께 계산한다. 예) 기본 10·2고·피박·흔들기 1회 = 48',()=>{
  const win=[...일곱점,...피들.slice(13,16)]; // 10점
  const {r}=stopWith({win,winGo:2,lose:[비광,...피들.slice(16,19)],loseGo:0}); // 피박만(비광 보유로 광박 없음)
  assert.deepEqual([r.baks,r.declared,r.final],[['피박'],[],24]);
  const a=withCaptured(0,win);a.captured[1]=[비광,...피들.slice(16,19)];a.goCount[0]=2;a.shakes[0]=[1];
  const ra=a.declareStop(0) as Extract<ReturnType<GameState['declareStop']>,{outcome:'승리'}>;
  assert.deepEqual([ra.settled,ra.multiplier,ra.declared,ra.declMultiplier,ra.final],[12,2,[{month:1,kinds:['흔들기']}],2,48]);
  const b=withCaptured(0,win);b.captured[1]=[비광,...피들.slice(16,19)];b.goCount[0]=2;b.shakes[0]=[1,5];b.shakes[1]=[3,7,9];
  const rb=b.declareStop(0) as Extract<ReturnType<GameState['declareStop']>,{outcome:'승리'}>;
  assert.deepEqual([rb.declared.map(d=>d.month),rb.declMultiplier,rb.final],[[1,5],4,96]); // 패자의 흔들기 3회는 무시
  assert.equal(b.previewSettlement(1).declared.length,3); // 상대가 이겼다면 상대 기준
});
test('나가리에는 흔들기 배수가 없고, 새 판은 선언 기록을 초기화한다',()=>{
  const s=withHands([]);s.hands=[[],[]];s.shakes[0]=[1,2];
  const d=s.settleIfExhausted()!;assert.equal(d.outcome,'나가리');assert.ok(!('declared' in d));
  const n=new GameState();assert.deepEqual(n.shakes,[[],[]]);assert.deepEqual(n.bombs,[[],[]]);assert.deepEqual(n.flipChances,[0,0]);assert.equal(n.version,0);assert.equal(n.turn,0);
});

// ---- 폭탄과 더미만 뒤집기 ----
import {BOMB_FLIP_CHANCES} from './game.ts';
/** 손패·바닥을 지정해 만든 상태(플레이어 0 차례). 나머지는 더미(id 순). deckTop을 주면 더미 맨 위에 둔다. */
function setupState(o:{h0:number[];h1?:number[];table?:number[];deckTop?:number[];chances?:[number,number]}){
  const used=new Set([...o.h0,...(o.h1??[]),...(o.table??[]),...(o.deckTop??[])]);
  const rest=CARDS.filter(c=>!used.has(c.id)).map(c=>c.id);
  const s=new GameState({hands:[o.h0,o.h1??[]],table:o.table??[],deck:[...(o.deckTop??[]),...rest],flipChances:o.chances});
  return s;
}
const uniq48=(s:GameState)=>{const a=s.allCardIds();assert.equal(a.length,48);assert.equal(new Set(a).size,48);};
test('폭탄 조건: 손패 3장 + 바닥 1장일 때만. 바닥 0장·2장, 손패 2장·4장은 불가',()=>{
  assert.deepEqual(setupState({h0:[0,1,2,20],table:[3]}).bombCandidates(0),[1]);
  assert.deepEqual(setupState({h0:[0,1,2,20],table:[]}).bombCandidates(0),[]);
  assert.deepEqual(setupState({h0:[0,1,20],table:[2,3]}).bombCandidates(0),[]);
  assert.deepEqual(setupState({h0:[0,1,2,3],table:[]}).bombCandidates(0),[]);
  assert.deepEqual(setupState({h0:[0,1,2,8,9,10],table:[3,11]}).bombCandidates(0),[1,3]);
  const s=setupState({h0:[0,1,2,20],table:[3]});
  assert.equal(s.canBomb(0,1),true);assert.equal(s.canBomb(1,1),false);
  assert.throws(()=>s.planBomb(0,2),/폭탄 조건/);
  // 선택 취소: 계획만 만들고 적용하지 않으면 아무 변화 없음
  const before=JSON.stringify([s.hands[0].map(c=>c.id),s.table.map(c=>c.id),s.flipChances]);
  s.planBomb(0,1);assert.equal(JSON.stringify([s.hands[0].map(c=>c.id),s.table.map(c=>c.id),s.flipChances]),before);
});
test('폭탄: 4장 획득, 더미 1장 소비, 기회 2회 지급, 피 1회. 더미 패는 정상 매칭(뻑 회수 포함)',()=>{
  const s=setupState({h0:[0,1,2,20],table:[3,24,28],deckTop:[25]}); // 더미 7월 초단이 바닥 7월 멧돼지와 맞음, 8월 광은 남음
  s.captured[1]=[];const pi=s.deck.splice(s.deck.findIndex(c=>c.id===22),1);s.captured[1].push(...pi); // 상대 피 1장
  const plan=s.planBomb(0,1);
  assert.equal(plan.kind,'bomb');assert.deepEqual(plan.bombCards.map(c=>c.id),[0,1,2]);
  assert.deepEqual(plan.events,['폭탄']);assert.equal(plan.piSteals,1);
  assert.deepEqual(plan.captureGroups.map(g=>g.map(c=>c.id).sort((a,b)=>a-b)),[[0,1,2,3],[24,25]]);
  s.applyTurn(plan);s.stealPi(1,0,plan.piSteals);
  assert.deepEqual(s.hands[0].map(c=>c.id),[20]);assert.equal(s.flipChances[0],BOMB_FLIP_CHANCES);assert.deepEqual(s.bombs[0],[1]);
  assert.equal(s.captured[0].length,7);assert.deepEqual(s.table.map(c=>c.id),[28]);assert.equal(s.turn,1);uniq48(s);
  // 뻑 회수: 더미 패가 뻑 묶음 4번째 장이면 기존 규칙대로
  const t=setupState({h0:[4,5,6,20],table:[7,8,9,10,28],deckTop:[11]});t.ppeok.set(3,1); // 8월 광은 바닥에 남아 쓸이 아님
  const p=t.planBomb(0,2);assert.deepEqual(p.events,['폭탄','뻑회수']);assert.equal(p.piSteals,2);
});
test('폭탄 뒤 바닥이 비면 쓸 보너스를 합산한다',()=>{
  const s=setupState({h0:[0,1,2,20],table:[3,24],deckTop:[25]});
  const plan=s.planBomb(0,1);assert.deepEqual(plan.events,['폭탄','쓸']);assert.equal(plan.piSteals,2);assert.equal(plan.floorCountAfter,0);
});
test('같은 월 흔들기+폭탄은 배수 한 번, 다른 월은 누적. 예) 기본 10·2고·피박·1월 흔들기 후 1월 폭탄 = 48, 다른 월 폭탄 추가 96',()=>{
  // 실제 흐름: 1월로 흔든 뒤 같은 1월 폭탄 → 선언 월은 1월 하나(종류 둘)
  const b=setupState({h0:[0,1,2,20],table:[3]});
  b.declareShake(0,1);const plan=b.planBomb(0,1);b.applyTurn(plan);
  assert.deepEqual(b.declaredMonths(0),[{month:1,kinds:['흔들기','폭탄']}]);assert.equal(b.previewSettlement(0).declMultiplier,2);uniq48(b);
  // 정산 계산: 기본 10·2고·피박에 같은 월 흔들기+폭탄 = 48, 다른 월 폭탄 추가 = 96, 패자 선언 무시
  const win=[...일곱점,...피들.slice(13,16)];
  const s=withCaptured(0,win);s.captured[1]=[비광,...피들.slice(16,19)];s.goCount[0]=2;s.shakes[0]=[1];s.bombs[0]=[1];
  const pv=s.previewSettlement(0);assert.deepEqual([pv.goPoints,pv.baks,pv.multiplier,pv.declared,pv.declMultiplier,pv.final],[12,['피박'],2,[{month:1,kinds:['흔들기','폭탄']}],2,48]);
  s.bombs[0].push(3);assert.equal(s.previewSettlement(0).final,96);assert.equal(s.previewSettlement(0).declMultiplier,4);
  s.shakes[1]=[5,7];s.bombs[1]=[9];assert.equal(s.previewSettlement(0).final,96); // 패자 선언은 무시
  const r=s.declareStop(0) as Extract<ReturnType<GameState['declareStop']>,{outcome:'승리'}>;assert.equal(r.final,96);assert.equal(r.declared.length,2);
});
test('더미만 뒤집기: 손패가 남아도 선택 가능하고, 기회 1회 소비, 매칭·두 장 선택·뻑 회수·국진·피 이동 처리. 쪽·새 뻑·따닥 없음',()=>{
  const s=setupState({h0:[20,24],table:[2,3],deckTop:[1],chances:[2,0]});
  assert.equal(s.canFlipOnly(0),true);
  let plan=s.planFlip(0);assert.equal(plan.kind,'flip');assert.equal(plan.card,null);
  assert.deepEqual(plan.needsDeckChoice?.map(c=>c.id),[2,3]);
  plan=s.planFlip(0,3);assert.deepEqual(plan.captureGroups.map(g=>g.map(c=>c.id)),[[1,3]]);assert.deepEqual(plan.events,[]);
  s.applyTurn(plan);assert.equal(s.flipChances[0],1);assert.deepEqual(s.hands[0].map(c=>c.id),[20,24]);assert.equal(s.turn,1);uniq48(s);
  // 뻑 회수 + 국진: 더미 패가 국진이고 바닥에 9월 뻑 묶음
  const t=setupState({h0:[20],table:[33,34,35,28],deckTop:[32],chances:[1,0]});t.ppeok.set(9,1);t.captured[1]=[];
  const pi=t.deck.splice(t.deck.findIndex(c=>c.id===22),1);t.captured[1].push(...pi);
  const p=t.planFlip(0);assert.deepEqual(p.events,['뻑회수']);assert.equal(p.piSteals,1);
  t.applyTurn(p);assert.equal(t.pendingGukjin(0),true);t.chooseGukjin(0,'피');t.stealPi(1,0,p.piSteals);
  assert.equal(t.flipChances[0],0);assert.equal(t.captured[0].length,5);assert.equal(t.captured[1].length,0);uniq48(t);
  // 더미 패와 같은 월이 바닥에 없으면 그냥 놓인다(쪽 아님)
  const u=setupState({h0:[20],table:[],deckTop:[1],chances:[1,0]});const pu=u.planFlip(0);assert.deepEqual(pu.events,[]);assert.deepEqual(pu.leftOnFloor.map(c=>c.id),[1]);
  assert.throws(()=>setupState({h0:[20],table:[]}).planFlip(0),/기회가 없거나/);
});
test('손패 0·기회 남음이면 끝이 아니고 마지막 턴도 아니다. 기회가 소진돼야 마지막 턴 고 금지·자동 스톱·나가리가 적용된다',()=>{
  const s=setupState({h0:[],h1:[],table:[2],deckTop:[3,20],chances:[2,0]});
  assert.equal(s.finished,false);assert.equal(s.remainingActions(0),2);
  const p1=s.planFlip(0);assert.equal(p1.lastTurn,false);
  assert.deepEqual(p1.events,['쓸']); // 바닥 2 + 더미 3 획득, 바닥 0, 마지막 턴 아님 → 쓸
  s.applyTurn(p1);assert.equal(s.finished,false);
  assert.equal(s.currentPlayer,1);s.turn+=1; // 상대는 행동이 없어 건너뛴다(화면 흐름)
  s.captured[0]=[...일곱점];for(const c of s.captured[0]){const i=s.deck.findIndex(x=>x.id===c.id);if(i>=0)s.deck.splice(i,1);} // 1월 피 두 장은 이미 획득돼 있음
  const p2=s.planFlip(0);assert.equal(p2.lastTurn,true);
  s.applyTurn(p2);assert.equal(s.remainingActions(0),0);assert.equal(s.finished,true);
  assert.equal(s.canGo(0),false);assert.ok(s.canDecide(0));assert.throws(()=>s.declareGo(0),/마지막 행동/);
  const r=s.declareStop(0);assert.equal(r.outcome,'승리');
  const n=setupState({h0:[],h1:[],table:[2],deckTop:[20,24],chances:[1,0]});n.applyTurn(n.planFlip(0));
  assert.equal(n.finished,true);assert.equal(n.settleIfExhausted()?.outcome,'나가리');
});
test('폭탄·기회를 포함한 무작위 전체 진행에서 48장 보존, 더미 소진과 남은 행동 수 일관성, 이전 계획 거부',()=>{
  for(let n=0;n<40;n++){
    const s=new GameState();let stale:ReturnType<GameState['planTurn']>|null=null;
    while(!s.finished&&!s.over){
      const p=s.currentPlayer;
      if(s.remainingActions(p)===0){s.turn+=1;continue;}
      let plan;
      const bomb=s.bombCandidates(p)[0];
      if(bomb!==undefined)plan=s.planBomb(p,bomb);
      else if(s.hands[p].length){const card=s.hands[p][0];plan=s.planTurn(p,card);if(plan.needsDeckChoice)plan=s.planTurn(p,card,undefined,plan.needsDeckChoice[1].id);}
      else{plan=s.planFlip(p);if(plan.needsDeckChoice)plan=s.planFlip(p,plan.needsDeckChoice[0].id);}
      if(stale)assert.throws(()=>s.applyTurn(stale!),/이전 턴|다른 판|이미 적용|상태가 바뀌었/);
      s.applyTurn(plan);stale=plan;
      if(s.pendingGukjin(p))s.autoChooseGukjin(p);
      s.stealPi(1-p,p,plan.piSteals);
      uniq48(s);
      assert.equal(s.deck.length,s.remainingActions(0)+s.remainingActions(1),'남은 더미 = 남은 행동 수');
    }
    assert.equal(s.deck.length,0);
  }
});

test('더미 선택 재계획: 연출용으로 손패를 먼저 빼도 폭탄·일반·더미만 턴을 같은 카드로 다시 계획하고, 오래된 계획은 거부한다',()=>{
  const s=setupState({h0:[0,1,2,20],table:[3,24,25],deckTop:[26]}); // 폭탄 뒤 더미 7월 피가 바닥 7월 두 장과 맞음
  const p=s.planBomb(0,1);assert.deepEqual(p.needsDeckChoice?.map(c=>c.id),[24,25]);
  for(const c of p.bombCards)s.hands[0].splice(s.hands[0].indexOf(c),1); // 화면이 연출을 위해 미리 뺀 상태
  assert.throws(()=>s.planBomb(0,1,25),/폭탄 조건/);
  const q=s.replanDeckChoice(p,25);assert.equal(q.kind,'bomb');assert.equal(q.needsDeckChoice,null);
  assert.deepEqual(q.captureGroups.map(g=>g.map(c=>c.id).sort((a,b)=>a-b)),[[0,1,2,3],[25,26]]);
  s.applyTurn(q);assert.equal(s.flipChances[0],2);assert.deepEqual(s.table.map(c=>c.id),[24]);uniq48(s);
  // 일반 턴: 고른 바닥패(handTarget)를 유지한 채 더미 선택만 추가
  const n=setupState({h0:[4,20],table:[6,7,24,25],deckTop:[26]});
  const a=n.planTurn(0,n.hands[0][0],7);n.hands[0].splice(0,1);
  const b=n.replanDeckChoice(a,24);assert.equal(b.handTarget,7);assert.deepEqual(b.captureGroups.map(g=>g.map(c=>c.id).sort((x,y)=>x-y)),[[4,7],[24,26]]);
  n.applyTurn(b);uniq48(n);
  // 오래된 계획(턴이 지남)은 재계획 거부
  assert.throws(()=>n.replanDeckChoice(a,25),/유효한 계획이 아니라/);
  // 더미만 턴
  const f=setupState({h0:[20],table:[24,25],deckTop:[26],chances:[1,0]});
  const fp=f.planFlip(0);assert.ok(fp.needsDeckChoice);const fq=f.replanDeckChoice(fp,25);assert.equal(fq.kind,'flip');f.applyTurn(fq);assert.equal(f.flipChances[0],0);
});
test('마지막 턴 판정은 손패를 미리 뺀 상태에서 계획해도 같다',()=>{
  const s=setupState({h0:[20],h1:[],table:[24],deckTop:[26]}); // 내 마지막 손패, 상대 행동 없음
  const before=s.planTurn(0,s.hands[0][0]);
  const card=s.hands[0].splice(0,1)[0];
  const after=s.planTurn(0,card);
  assert.equal(before.lastTurn,true);assert.equal(after.lastTurn,true);assert.deepEqual(after.events,before.events);
});

test('마지막 행동 예외: 행동한 사람의 마지막 행동에서는 쪽 보너스가 없고, 뻑 대신 세 장을 가져간다',()=>{
  // 쪽 모양: 내 마지막 손패 1월 피(2), 바닥에 1월 없음, 더미 윗장 1월 피(3). 상대 행동 없음.
  const s=setupState({h0:[2],h1:[],table:[24],deckTop:[3,20]});
  const p=s.planTurn(0,s.hands[0][0]);
  assert.deepEqual(p.events,[]);assert.equal(p.piSteals,0);
  assert.deepEqual(p.captureGroups.map(g=>g.map(c=>c.id).sort((a,b)=>a-b)),[[2,3]]); // 두 장은 가져간다
  s.applyTurn(p);assert.ok([2,3].every(id=>s.captured[0].some(c=>c.id===id)));assert.equal(s.table.length,1);uniq48(s);
  // 뻑 모양: 내 마지막 손패 1월 피(3), 바닥 1월 피(2), 더미 1월 홍단(1) → 세 장 모두 획득, 뻑 기록 없음
  const t=setupState({h0:[3],h1:[],table:[2,24],deckTop:[1,20]});
  const q=t.planTurn(0,t.hands[0][0]);
  assert.deepEqual(q.events,[]);assert.equal(q.ppeokMade,null);
  assert.deepEqual(q.captureGroups.map(g=>g.map(c=>c.id).sort((a,b)=>a-b)),[[1,2,3]]);
  t.applyTurn(q);assert.equal(t.ppeok.size,0);assert.ok([1,2,3].every(id=>t.captured[0].some(c=>c.id===id)));uniq48(t);
  // 행동이 더 남아 있으면(기회 패 1장) 평소대로 쪽·뻑
  const u=setupState({h0:[2],h1:[],table:[24],deckTop:[3,20],chances:[1,0]});
  assert.deepEqual(u.planTurn(0,u.hands[0][0]).events,['쪽']);
  const v=setupState({h0:[3],h1:[],table:[2,24],deckTop:[1,20],chances:[1,0]});
  const pv=v.planTurn(0,v.hands[0][0]);assert.deepEqual(pv.events,['뻑']);assert.equal(pv.ppeokMade,1);
  // 상대에게 행동이 남아 있어도 "행동한 사람"의 마지막이면 예외 적용
  const w=setupState({h0:[2],h1:[20,24],table:[28],deckTop:[3,25]});
  assert.deepEqual(w.planTurn(0,w.hands[0][0]).events,[]);
});

test('마지막 행동 예외는 상대의 남은 행동과 무관하다: 내 남은 행동 1, 상대 2 이상이어도 쪽 보너스 없음·새 뻑 없음',()=>{
  // 쪽 모양: 내 손패 1장(1월 피 2), 상대 손패 3장, 바닥에 1월 없음, 더미 윗장 1월 피 3
  const s=setupState({h0:[2],h1:[20,24,28],table:[32],deckTop:[3,36]});
  assert.equal(s.remainingActions(0),1);assert.equal(s.remainingActions(1),3);
  const p=s.planTurn(0,s.hands[0][0]);
  assert.deepEqual(p.events,[]);assert.equal(p.piSteals,0);assert.equal(p.lastTurn,false); // 양쪽 소진은 아니므로 쓸 기준의 마지막 턴은 아님
  assert.deepEqual(p.captureGroups.map(g=>g.map(c=>c.id).sort((a,b)=>a-b)),[[2,3]]);
  s.applyTurn(p);assert.ok([2,3].every(id=>s.captured[0].some(c=>c.id===id)));uniq48(s);
  // 뻑 모양: 내 손패 1장(1월 피 3), 바닥 1월 피 2, 더미 1월 홍단 1, 상대 손패 3장
  const t=setupState({h0:[3],h1:[20,24,28],table:[2,32],deckTop:[1,36]});
  const q=t.planTurn(0,t.hands[0][0]);
  assert.deepEqual(q.events,[]);assert.equal(q.ppeokMade,null);
  assert.deepEqual(q.captureGroups.map(g=>g.map(c=>c.id).sort((a,b)=>a-b)),[[1,2,3]]);
  t.applyTurn(q);assert.equal(t.ppeok.size,0);assert.equal(t.table.length,1);uniq48(t);
  // 내 남은 행동이 2(손패 1 + 기회 1)면 마지막 행동이 아니라 평소대로 쪽·뻑
  const u=setupState({h0:[2],h1:[20,24,28],table:[32],deckTop:[3,36],chances:[1,0]});
  assert.deepEqual(u.planTurn(0,u.hands[0][0]).events,['쪽']);
  const v=setupState({h0:[3],h1:[20,24,28],table:[2,32],deckTop:[1,36],chances:[1,0]});
  assert.equal(v.planTurn(0,v.hands[0][0]).ppeokMade,1);
});
test('기회 패만 쓰는 턴에는 손패가 없으므로 쪽·새 뻑 판정이 원래 없다(마지막 기회든 아니든)',()=>{
  for(const chances of [1,2] as const){
    // 더미 윗장과 같은 월이 바닥에 없음 → 그냥 놓임(쪽 아님)
    const a=setupState({h0:[],h1:[20,24],table:[32],deckTop:[3,36],chances:[chances,0]});
    const pa=a.planFlip(0);assert.deepEqual(pa.events,[]);assert.deepEqual(pa.leftOnFloor.map(c=>c.id),[3]);assert.equal(pa.captureGroups.length,0);
    // 더미 윗장과 같은 월이 바닥에 1장 → 두 장 획득(새 뻑이 생길 손패가 없음)
    const b=setupState({h0:[],h1:[20,24],table:[2,32],deckTop:[3,36],chances:[chances,0]});
    const pb=b.planFlip(0);assert.deepEqual(pb.events,[]);assert.equal(pb.ppeokMade,null);
    assert.deepEqual(pb.captureGroups.map(g=>g.map(c=>c.id).sort((x,y)=>x-y)),[[2,3]]);
    b.applyTurn(pb);assert.equal(b.flipChances[0],chances-1);assert.equal(b.ppeok.size,0);uniq48(b);
  }
});
