import { CARDS, cardById, type Card } from './cards.ts';
import { judgeBak, scoreCaptured, settle, settlementPoints, type BakKind, type Declared, type Score, type ScoreOptions, type Settlement } from './score.ts';
export type { Card } from './cards.ts';
export type GukjinChoice = '열끗' | '피';
/** 최초 고/스톱 선택이 가능한 기본 점수(1대1 맞고). */
export const GO_STOP_THRESHOLD = 7;
/** 폭탄 1회마다 지급하는 "손패 없이 더미만 뒤집기" 기회. */
export const BOMB_FLIP_CHANCES = 2;
/** 판 결과. 스톱한 쪽이 즉시 승자. 양쪽 행동이 모두 소진될 때까지 승자가 없으면 나가리(박·정산 없음, 배수 이월 없음). */
export type RoundResult =
  | { outcome: '승리'; winner: number; base: number; goCount: number; settled: number; baks: BakKind[]; multiplier: number; declared: Declared[]; declMultiplier: number; final: number }
  | { outcome: '나가리' };
export function newDeck(random: () => number = Math.random): Card[] {
  const cards = [...CARDS];
  for(let i=47;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
  return cards;
}
/** 고정 패 구성(개발용 시나리오). 48장을 빠짐·중복 없이 나눠야 한다. flipChances는 카드가 아닌 기회 카운터. */
export type Setup = { hands: [number[], number[]]; table: number[]; deck: number[]; flipChances?: [number, number]; /** 이미 획득한 패(시나리오용). */ captured?: [number[], number[]] };
export function validateSetup(s: Setup) {
  const all = [...s.hands[0], ...s.hands[1], ...s.table, ...s.deck, ...(s.captured?.[0] ?? []), ...(s.captured?.[1] ?? [])];
  if (all.length !== 48 || new Set(all).size !== 48) throw new Error(`고정 패 구성은 고유한 48장이어야 합니다(현재 ${all.length}장, 고유 ${new Set(all).size}장).`);
}

// ---- 턴 판정 결과(계획). 상태를 바꾸지 않고 손패·더미 결과를 함께 판단한다. 화면은 이 계획대로만 연출한다. ----
export type TurnKind = 'normal' | 'bomb' | 'flip';
export type TurnEvent = '쪽' | '뻑' | '따닥' | '쓸' | '뻑회수' | '자뻑회수' | '폭탄';
/** 카드 한 장이 바닥에 닿는 동작. onto: 그 위에 겹치는 카드들(이번 턴에 먼저 놓인 손패 포함). stays: 바닥에 남음(일반 놓기 또는 뻑). */
export type Landing = { card: Card; source: 'hand' | 'deck'; onto: Card[]; stays: boolean };
let roundSeq = 0;
export type TurnPlan = {
  /** 계획을 만든 판의 ID·턴 번호·상태 버전. applyTurn은 현재 판·턴·버전과 일치하고 아직 적용하지 않은 계획만 받는다. */
  roundId: number; turnNo: number; version: number; applied: boolean;
  /** normal: 손패 한 장 / bomb: 같은 월 세 장 / flip: 손패 없이 더미만. */
  kind: TurnKind;
  player: number;
  /** normal의 손패. bomb·flip은 null. */
  card: Card | null;
  /** bomb의 세 장. */
  bombCards: Card[];
  /** normal에서 손패와 같은 월 2장 중 고른 바닥패 id(재계획용). */
  handTarget?: number;
  deckCard: Card | null;
  landings: Landing[];
  /** 함께 획득하는 묶음들(손패/더미 패 + 바닥 패). 연출 뒤 applyTurn이 한 번에 획득시킨다. */
  captureGroups: Card[][];
  /** 이번 턴에 바닥에 남는 손패·더미 패. */
  leftOnFloor: Card[];
  events: TurnEvent[];
  /** 상대 피 가져오기 횟수(쪽 1, 따닥 1, 쓸 1, 폭탄 1, 상대 뻑 회수 1, 자뻑 회수 2 합산). */
  piSteals: number;
  ppeokMade: number | null;
  ppeokTaken: { month: number; owner: number } | null;
  /** 더미 패가 같은 월 2장 중 하나를 골라야 하는데 아직 지정하지 않음. 지정 뒤 같은 종류의 plan 함수를 다시 부른다. */
  needsDeckChoice: Card[] | null;
  /** 이 턴으로 양쪽 남은 행동(손패+뒤집기 기회)이 모두 소진됨(쓸 제외). */
  lastTurn: boolean;
  floorCountAfter: number;
};

export class GameState {
  deck:Card[]; hands:Card[][]; table:Card[]; captured:Card[][]=[[],[]]; peekUsed=false;
  /** 판 ID(인스턴스마다 고유). 다른 판에서 만든 계획을 거부하는 데 쓴다. */
  readonly roundId:number=++roundSeq;
  /** 적용된 턴 수. applyTurn마다 1씩 늘어 이전 턴의 계획을 거부하는 데 쓴다. 흔들기 선언은 늘리지 않는다. */
  turn=0;
  /** 상태 버전. 상태를 바꾸는 모든 처리(턴 적용, 흔들기, 피 이동, 국진·고·스톱)마다 1씩 늘어 오래된 계획을 거부하는 데 쓴다. */
  version=0;
  /** 플레이어별 흔들기 선언 월. 같은 월은 한 판에 한 번만. 새 판에서 비운다. */
  shakes:number[][]=[[],[]];
  /** 플레이어별 폭탄 사용 월. 새 판에서 비운다. */
  bombs:number[][]=[[],[]];
  /** 플레이어별 "손패 없이 더미만 뒤집기" 기회(카드가 아닌 카운터). 폭탄 1회마다 +2. */
  flipChances:number[]=[0,0];
  /** 9월 국진 사용 선택(결정한 플레이어 기준). 판마다 한 번만 정하고 바꿀 수 없다. 국진이 상대에게 넘어가도 이 결정을 따른다. */
  gukjinChoice:(GukjinChoice|null)[]=[null,null];
  /** 플레이어별 고 횟수. 새 판에서 0. */
  goCount:number[]=[0,0];
  /** 직전 고를 외칠 때의 기본 점수. 이 값보다 기본 점수가 올라야 다시 고/스톱을 묻는다. */
  goBase:(number|null)[]=[null,null];
  /** 뻑 묶음: 월 → 만든 플레이어. 처음 깔린 같은 월 3장은 등록하지 않는다(소유자 없는 일반 묶음). */
  ppeok:Map<number,number>=new Map();
  /** 판 결과. null이면 진행 중. */
  result:RoundResult|null=null;
  constructor(setup?:Setup){
    if(setup){validateSetup(setup);this.hands=[setup.hands[0].map(cardById),setup.hands[1].map(cardById)];this.table=setup.table.map(cardById);this.deck=setup.deck.map(cardById);if(setup.flipChances)this.flipChances=[...setup.flipChances];if(setup.captured)this.captured=[setup.captured[0].map(cardById),setup.captured[1].map(cardById)];}
    else{const d=newDeck();this.hands=[d.splice(0,10),d.splice(0,10)];this.table=d.splice(0,8);this.deck=d;}
  }
  // ---- 행동 수와 종료 ----
  /** 남은 행동 수 = 실제 손패 수 + 더미만 뒤집기 기회 수. */
  remainingActions(player:number){return this.hands[player].length+this.flipChances[player];}
  /** 양쪽의 남은 행동이 모두 소진됨. 손패가 0이어도 기회가 남으면 끝이 아니다. */
  get finished(){return this.remainingActions(0)===0&&this.remainingActions(1)===0;}
  /** 승자 확정 또는 나가리로 판이 끝남. 이후 어떤 획득·선택도 허용하지 않는다. */
  get over(){return this.result!==null;}
  /** 지금 차례인 플레이어. 0이 먼저 시작하고 턴마다 번갈아 든다. */
  get currentPlayer(){return this.turn%2;}
  matches(card:Card){return this.table.filter(c=>c.month===card.month);}
  /** 단순 획득(테스트·보조용). 실제 턴은 planTurn → applyTurn을 쓴다. */
  place(player:number,card:Card,targetId?:number){
    if(this.over)throw new Error('판이 끝났습니다. 더 이상 패를 낼 수 없습니다.');
    const matches=this.matches(card);
    if(matches.length===0){this.table.push(card);return;}
    const selected=matches.length===3?matches:[matches.find(c=>c.id===targetId)??matches[0]];
    this.table=this.table.filter(c=>!selected.some(s=>s.id===c.id));
    this.captured[player].push(card,...selected);
  }
  // ---- 흔들기 ----
  private monthCounts(player:number){const count=new Map<number,number>();for(const c of this.hands[player])count.set(c.month,(count.get(c.month)??0)+1);return count;}
  /** 선언 가능한 월: 손패에 같은 월이 정확히 3장이고(4장은 제외) 아직 그 월로 흔들지 않은 월. 오름차순. */
  shakeCandidates(player:number):number[]{
    return [...this.monthCounts(player).entries()].filter(([m,n])=>n===3&&!this.shakes[player].includes(m)).map(([m])=>m).sort((a,b)=>a-b);
  }
  canShake(player:number,month:number){return !this.over&&this.currentPlayer===player&&this.shakeCandidates(player).includes(month);}
  /**
   * 흔들기 선언. 세 장을 돌려주지만(공개용) 카드를 이동·소비하지 않고 턴 번호도 늘리지 않는다.
   * 자기 차례, 판 진행 중, 선언 가능한 월일 때만. 같은 월 재선언은 거부한다.
   */
  declareShake(player:number,month:number):Card[]{
    if(this.over)throw new Error('판이 끝나 흔들 수 없습니다.');
    if(this.currentPlayer!==player)throw new Error('자기 차례에만 흔들 수 있습니다.');
    if(this.shakes[player].includes(month))throw new Error(`${month}월은 이미 흔들었습니다.`);
    if(!this.shakeCandidates(player).includes(month))throw new Error(`${month}월은 흔들기 조건(손패에 정확히 3장)이 아닙니다.`);
    this.shakes[player].push(month);this.version+=1;
    return this.hands[player].filter(c=>c.month===month);
  }
  // ---- 폭탄 ----
  /** 폭탄 가능한 월: 손패에 같은 월이 정확히 3장이고 바닥에 그 월이 정확히 1장. 흔든 월도 가능(배수는 중복되지 않음). 오름차순. */
  bombCandidates(player:number):number[]{
    return [...this.monthCounts(player).entries()].filter(([m,n])=>n===3&&this.table.filter(c=>c.month===m).length===1).map(([m])=>m).sort((a,b)=>a-b);
  }
  canBomb(player:number,month:number){return !this.over&&this.currentPlayer===player&&this.bombCandidates(player).includes(month);}
  /** 더미만 뒤집기 가능: 자기 차례이고 기회가 남아 있을 때. */
  canFlipOnly(player:number){return !this.over&&this.currentPlayer===player&&this.flipChances[player]>0;}
  /** 승자 정산용: 흔들기 또는 폭탄을 선언한 중복 없는 월 목록(월 오름차순, 종류 기록). 배수는 2^(월 수). */
  declaredMonths(player:number):Declared[]{
    const map=new Map<number,Declared>();
    for(const m of this.shakes[player]){if(!map.has(m))map.set(m,{month:m,kinds:[]});map.get(m)!.kinds.push('흔들기');}
    for(const m of this.bombs[player]){if(!map.has(m))map.set(m,{month:m,kinds:[]});map.get(m)!.kinds.push('폭탄');}
    return [...map.values()].sort((a,b)=>a.month-b.month);
  }
  // ---- 국진 ----
  hasGukjin(player:number){return this.captured[player].some(c=>c.gukjin);}
  /** 이 판의 국진 결정(누가 정했든). 아직 아무도 정하지 않았으면 null. */
  get gukjinDecision():GukjinChoice|null{return this.gukjinChoice[0]??this.gukjinChoice[1];}
  /** 국진을 획득했지만 이 판에서 아직 아무도 사용 방식을 정하지 않은 상태. 피 이동으로 넘어온 국진은 다시 묻지 않는다. */
  pendingGukjin(player:number){return this.hasGukjin(player)&&this.gukjinDecision===null;}
  /** 화면 표시용: 이 플레이어가 국진을 들고 있을 때 적용되는 결정. */
  gukjinUse(player:number):GukjinChoice|null{return this.hasGukjin(player)?this.gukjinDecision:null;}
  scoreOptions(player:number):ScoreOptions{return {gukjinAsPi:this.gukjinDecision==='피'};}
  /** 현재 선택을 반영한 기본 점수. 선택 전에는 열끗 기준. */
  score(player:number):Score{return scoreCaptured(this.captured[player],this.scoreOptions(player));}
  /** 기본 점수 합계(고 보너스 미포함). */
  baseScore(player:number){return this.score(player).total;}
  /** 선택지별 예상 합계 점수. */
  previewGukjin(player:number):Record<GukjinChoice,number>{
    const c=this.captured[player];
    return {열끗:scoreCaptured(c,{gukjinAsPi:false}).total,피:scoreCaptured(c,{gukjinAsPi:true}).total};
  }
  chooseGukjin(player:number,choice:GukjinChoice){
    if(!this.hasGukjin(player))throw new Error('국진을 획득하지 않았습니다.');
    if(this.gukjinDecision!==null)throw new Error('국진 사용 방식은 이 판에서 이미 확정되었습니다.');
    this.gukjinChoice[player]=choice;this.version+=1;
  }
  /** 컴퓨터용: 합계가 높은 쪽, 동점이면 열끗. */
  autoChooseGukjin(player:number):GukjinChoice{
    const p=this.previewGukjin(player);
    const choice:GukjinChoice=p.피>p.열끗?'피':'열끗';
    this.chooseGukjin(player,choice);return choice;
  }
  // ---- 턴 판정 ----
  /** 손패를 내기 전 분석. needsChoice: 같은 월 2장 중 골라야 함(더미 윗장이 같은 월이면 따닥이라 묻지 않음). */
  analyzeHand(card:Card){const matches=this.matches(card);const top=this.deck[0];return {matches,needsChoice:matches.length===2&&top?.month!==card.month};}
  /**
   * 일반 턴 계획: 손패 card와 더미 윗장을 함께 판정한다. 상태는 바꾸지 않는다.
   * handTarget: 손패와 같은 월이 2장일 때 고른 바닥패 id. deckTarget: 더미 패와 같은 월이 2장일 때 고른 id(없으면 needsDeckChoice로 알려준다).
   */
  planTurn(player:number,card:Card,handTarget?:number,deckTarget?:number):TurnPlan{
    if(this.over)throw new Error('판이 끝났습니다.');
    return this.buildPlan(player,{kind:'normal',card,handTarget,deckTarget});
  }
  /** 폭탄 턴 계획: 같은 월 세 장을 한꺼번에 내 바닥의 한 장과 함께 4장 획득(폭탄, 피 1회)한 뒤 더미 한 장을 정상 처리한다. */
  planBomb(player:number,month:number,deckTarget?:number):TurnPlan{
    if(!this.canBomb(player,month))throw new Error(`${month}월은 폭탄 조건(손패 3장, 바닥 1장)이 아닙니다.`);
    return this.buildPlan(player,{kind:'bomb',month,deckTarget});
  }
  /** 더미만 뒤집는 턴 계획: 손패를 내지 않고 기회 1회를 써서 더미 한 장만 정상 처리한다(쪽·새 뻑·따닥 없음). */
  planFlip(player:number,deckTarget?:number):TurnPlan{
    if(!this.canFlipOnly(player))throw new Error('더미만 뒤집기 기회가 없거나 자기 차례가 아닙니다.');
    return this.buildPlan(player,{kind:'flip',deckTarget});
  }
  /**
   * 더미 패 두 장 중 하나를 고른 뒤 같은 턴·같은 행동으로 계획을 다시 만든다.
   * 연출을 위해 손패에서 이미 뺀 카드가 있어도 원래 계획의 카드(손패·폭탄 세 장)를 그대로 쓴다. 현재 턴의 유효한 계획만 받는다.
   */
  replanDeckChoice(plan:TurnPlan,deckTarget:number):TurnPlan{
    if(plan.roundId!==this.roundId||plan.turnNo!==this.turn||plan.version!==this.version||plan.applied)throw new Error('현재 턴의 유효한 계획이 아니라 다시 계획할 수 없습니다.');
    if(plan.kind==='normal')return this.buildPlan(plan.player,{kind:'normal',card:plan.card!,handTarget:plan.handTarget,deckTarget});
    if(plan.kind==='bomb')return this.buildPlan(plan.player,{kind:'bomb',month:plan.bombCards[0].month,bombCards:plan.bombCards,deckTarget});
    return this.buildPlan(plan.player,{kind:'flip',deckTarget});
  }
  private buildPlan(player:number,o:{kind:TurnKind;card?:Card;month?:number;bombCards?:Card[];handTarget?:number;deckTarget?:number}):TurnPlan{
    const other=1-player, D=this.deck[0]??null;
    const landings:Landing[]=[], groups:Card[][]=[], left:Card[]=[], events:TurnEvent[]=[];
    let steals=0, ppeokMade:number|null=null, ppeokTaken:{month:number;owner:number}|null=null, needsDeckChoice:Card[]|null=null;
    const reserved=new Set<number>(); // 손패가 가져가는 바닥패(더미 판정에서 제외)
    const take=(g:Card[])=>{groups.push(g);for(const c of g)reserved.add(c.id);};
    const recover=(month:number)=>{const owner=this.ppeok.get(month);if(owner===undefined)return;ppeokTaken={month,owner};if(owner===player){events.push('자뻑회수');steals+=2;}else{events.push('뻑회수');steals+=1;}};
    let deckDone=false, bombCards:Card[]=[];
    const card=o.card??null;
    // 행동한 사람의 마지막 행동인가(이 행동 뒤 자기 남은 행동 0). 공식 설명의 예외: 마지막 행동에서는 쪽 보너스가 없고 새 뻑으로 세 장을 남기지 않고 가져간다.
    const actorLast=o.kind==='normal'&&card!==null&&this.hands[player].filter(c=>c.id!==card.id).length+this.flipChances[player]===0;
    if(o.kind==='normal'&&card){
      const m=card.month, M=this.matches(card);
      if(M.length===0){
        landings.push({card,source:'hand',onto:[],stays:true});
        if(D&&D.month===m){landings.push({card:D,source:'deck',onto:[card],stays:false});take([card,D]);if(!actorLast){events.push('쪽');steals+=1;}deckDone=true;}
        else left.push(card);
      }else if(M.length===1){
        if(D&&D.month===m&&actorLast){landings.push({card,source:'hand',onto:[M[0]],stays:false});landings.push({card:D,source:'deck',onto:[M[0],card],stays:false});take([card,M[0],D]);deckDone=true;} // 마지막 행동: 뻑 대신 세 장 획득
        else if(D&&D.month===m){landings.push({card,source:'hand',onto:[M[0]],stays:true});landings.push({card:D,source:'deck',onto:[M[0],card],stays:true});left.push(card,D);ppeokMade=m;events.push('뻑');deckDone=true;}
        else{landings.push({card,source:'hand',onto:[M[0]],stays:false});take([card,M[0]]);}
      }else if(M.length===2){
        if(D&&D.month===m){landings.push({card,source:'hand',onto:M,stays:false});landings.push({card:D,source:'deck',onto:[...M,card],stays:false});take([card,...M,D]);events.push('따닥');steals+=1;deckDone=true;}
        else{const T=M.find(c=>c.id===o.handTarget)??M[0];landings.push({card,source:'hand',onto:[T],stays:false});take([card,T]);}
      }else{landings.push({card,source:'hand',onto:M,stays:false});take([card,...M]);recover(m);}
    }else if(o.kind==='bomb'){
      // 폭탄: 세 장 + 바닥 한 장을 한 묶음으로. 쪽·뻑·따닥으로는 판정하지 않는다.
      const m=o.month!;bombCards=o.bombCards??this.hands[player].filter(c=>c.month===m);
      const F=this.table.filter(c=>c.month===m);
      bombCards.forEach((b,i)=>landings.push({card:b,source:'hand',onto:[F[0],...bombCards.slice(0,i)],stays:false}));
      take([...bombCards,F[0]]);events.push('폭탄');steals+=1;
    }
    if(D&&!deckDone){
      const MD=this.table.filter(c=>c.month===D.month&&!reserved.has(c.id));
      if(MD.length===0){landings.push({card:D,source:'deck',onto:[],stays:true});left.push(D);}
      else if(MD.length===1){landings.push({card:D,source:'deck',onto:[MD[0]],stays:false});take([D,MD[0]]);}
      else if(MD.length===2){
        const T=MD.find(c=>c.id===o.deckTarget);
        if(!T)needsDeckChoice=MD;
        const target=T??MD[0];landings.push({card:D,source:'deck',onto:[target],stays:false});take([D,target]);
      }else{landings.push({card:D,source:'deck',onto:MD,stays:false});take([D,...MD]);recover(D.month);}
    }
    // 마지막 턴: 이 행동 뒤 양쪽 남은 행동(손패+기회)이 모두 0. 사용 카드를 id로 걸러 세므로 연출용으로 손패에서 먼저 뺀 뒤 계획해도 같다.
    const usedIds=new Set((o.kind==='bomb'?bombCards:card?[card]:[]).map(c=>c.id));
    const handAfter=this.hands[player].filter(c=>!usedIds.has(c.id)).length;
    const chancesAfter=this.flipChances[player]+(o.kind==='bomb'?BOMB_FLIP_CHANCES:0)-(o.kind==='flip'?1:0);
    const lastTurn=handAfter+chancesAfter===0&&this.remainingActions(other)===0;
    // 쓸: 턴 시작 시 바닥이 있었고, 바닥패를 실제로 획득했고, 확정 후 바닥이 0장. 마지막 턴 제외.
    const floorTaken=groups.flat().filter(c=>this.table.includes(c)).length;
    const floorCountAfter=this.table.length-floorTaken+left.length;
    if(this.table.length>0&&floorTaken>0&&floorCountAfter===0&&!lastTurn){events.push('쓸');steals+=1;}
    return {roundId:this.roundId,turnNo:this.turn,version:this.version,applied:false,kind:o.kind,player,card,bombCards,handTarget:o.handTarget,deckCard:D,landings,captureGroups:groups,leftOnFloor:left,events,piSteals:steals,ppeokMade,ppeokTaken,needsDeckChoice,lastTurn,floorCountAfter};
  }
  /** 계획을 상태에 적용한다(손패 제거, 더미 한 장 소비, 바닥·획득 갱신, 뻑·폭탄·기회 기록). 피 이동은 stealPi로 따로 한다. */
  applyTurn(plan:TurnPlan){
    if(this.over)throw new Error('판이 끝났습니다.');
    // 상태를 바꾸기 전에 계획이 현재 판·턴·상태와 맞는지 먼저 검사한다. 어긋나면 아무것도 바꾸지 않는다.
    if(plan.roundId!==this.roundId)throw new Error('다른 판에서 만든 계획입니다.');
    if(plan.applied)throw new Error('이미 적용한 계획입니다.');
    if(plan.turnNo!==this.turn)throw new Error(`이전 턴의 계획입니다(계획 턴 ${plan.turnNo}, 현재 턴 ${this.turn}).`);
    if(plan.version!==this.version)throw new Error('계획을 만든 뒤 상태가 바뀌었습니다(흔들기 등). 다시 계획하세요.');
    if(plan.deckCard&&this.deck[0]?.id!==plan.deckCard.id)throw new Error('더미 윗장이 계획과 다릅니다.');
    if(plan.kind==='flip'&&this.flipChances[plan.player]<=0)throw new Error('더미만 뒤집기 기회가 없습니다.');
    const hand=this.hands[plan.player];
    for(const c of plan.kind==='bomb'?plan.bombCards:plan.card?[plan.card]:[]){const i=hand.findIndex(h=>h.id===c.id);if(i>=0)hand.splice(i,1);}
    if(plan.deckCard)this.deck.shift();
    const taken=new Set(plan.captureGroups.flat().map(c=>c.id));
    this.table=this.table.filter(c=>!taken.has(c.id));
    this.table.push(...plan.leftOnFloor);
    for(const g of plan.captureGroups)this.captured[plan.player].push(...g);
    if(plan.ppeokTaken)this.ppeok.delete(plan.ppeokTaken.month);
    for(const month of new Set(plan.captureGroups.flat().map(c=>c.month)))this.ppeok.delete(month);
    if(plan.ppeokMade!==null)this.ppeok.set(plan.ppeokMade,plan.player);
    if(plan.kind==='bomb'){this.bombs[plan.player].push(plan.bombCards[0].month);this.flipChances[plan.player]+=BOMB_FLIP_CHANCES;}
    if(plan.kind==='flip')this.flipChances[plan.player]-=1;
    plan.applied=true;this.turn+=1;this.version+=1;
  }
  // ---- 상대 피 가져오기 ----
  /** 가져올 피 후보 순서: 일반 피(가치 1, id 순) → 없으면 쌍피·쌍피로 쓰는 국진(가치 2, id 순). */
  private piCandidates(from:number,pool:readonly Card[]):Card[]{
    const asPi=this.scoreOptions(from).gukjinAsPi;
    const pis=pool.filter(c=>c.kind==='피'||(asPi&&c.gukjin));
    const normal=pis.filter(c=>!c.ssangpi&&!c.gukjin).sort((a,b)=>a.id-b.id);
    const doubles=pis.filter(c=>c.ssangpi||c.gukjin).sort((a,b)=>a.id-b.id);
    return [...normal,...doubles];
  }
  /** 실제로 옮기지 않고 어떤 카드가 옮겨질지 계산(연출용). 매회 남은 패에서 같은 우선순위로 고른다. */
  peekSteal(from:number,count:number):Card[]{
    const pool=[...this.captured[from]], out:Card[]=[];
    for(let i=0;i<count;i++){const pick=this.piCandidates(from,pool)[0];if(!pick)break;pool.splice(pool.indexOf(pick),1);out.push(pick);}
    return out;
  }
  /** 상대의 피 카드를 한 장씩 옮긴다. 피가 없으면 그만두고 빚을 남기지 않는다. 옮긴 카드를 돌려준다. */
  stealPi(from:number,to:number,count:number):Card[]{
    if(this.over)throw new Error('판이 끝났습니다.');
    const moved=this.peekSteal(from,count);
    for(const c of moved){this.captured[from].splice(this.captured[from].indexOf(c),1);this.captured[to].push(c);}
    if(moved.length)this.version+=1;
    return moved;
  }
  // ---- 고/스톱 ----
  /**
   * 지금 고/스톱을 물을 수 있는가. 턴의 모든 획득과 국진 선택이 끝난 뒤에만 호출한다.
   * 조건: 판이 진행 중, 국진 선택 대기 없음, 기본 점수 7점 이상,
   * 그리고 아직 고를 하지 않았거나 직전 고 시점의 기본 점수보다 높아졌을 때.
   */
  canDecide(player:number){
    if(this.over||this.pendingGukjin(player))return false;
    const base=this.baseScore(player), prev=this.goBase[player];
    return base>=GO_STOP_THRESHOLD&&(prev===null||base>prev);
  }
  /** 고 선택 가능. 마지막 행동을 한 턴(남은 행동 0)에는 고를 할 수 없다. */
  canGo(player:number){return this.canDecide(player)&&this.remainingActions(player)>0;}
  /** 지금 스톱하면 받는 고 반영 점수(박·선언 배수 제외). */
  stopPreview(player:number){return settlementPoints(this.baseScore(player),this.goCount[player]);}
  /** 지금 스톱하면의 정산 내역(박·흔들기/폭탄 배수 포함). 상태를 바꾸지 않는다. */
  previewSettlement(player:number):Settlement{
    const loser=1-player;
    return settle(this.baseScore(player),this.goCount[player],judgeBak(this.score(player),this.score(loser),this.goCount[loser]),this.declaredMonths(player));
  }
  declareGo(player:number){
    if(!this.canDecide(player))throw new Error('지금은 고/스톱을 선택할 수 없습니다.');
    if(this.remainingActions(player)===0)throw new Error('마지막 행동을 한 턴에는 고를 선택할 수 없습니다.');
    this.goBase[player]=this.baseScore(player);
    this.goCount[player]+=1;this.version+=1;
    return this.goCount[player];
  }
  /** 스톱: 즉시 승리. 정산 내역(고 공식 → 박 배수 → 승자 선언 배수)을 이 시점에 한 번 확정해 결과에 보관한다. 이후 다시 계산하지 않는다. */
  declareStop(player:number):RoundResult{
    if(!this.canDecide(player))throw new Error('지금은 고/스톱을 선택할 수 없습니다.');
    const s=this.previewSettlement(player);
    this.result={outcome:'승리',winner:player,base:s.base,goCount:s.goCount,settled:s.goPoints,baks:s.baks,multiplier:s.multiplier,declared:s.declared,declMultiplier:s.declMultiplier,final:s.final};
    this.version+=1;
    return this.result;
  }
  /** 양쪽 남은 행동이 모두 소진됐는데 승자가 없으면 나가리로 끝낸다. 기본 점수 우열로 승자를 정하지 않는다. */
  settleIfExhausted():RoundResult|null{
    if(!this.over&&this.finished){this.result={outcome:'나가리'};this.version+=1;}
    return this.result;
  }
  /** 손패·더미·바닥·획득패를 모두 합친 카드 id(검증용). 기회 카운터는 카드가 아니므로 포함하지 않는다. */
  allCardIds():number[]{return [...this.hands.flat(),...this.deck,...this.table,...this.captured.flat()].map(c=>c.id);}
}
