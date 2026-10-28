import Phaser from 'phaser';
import {GameState,GO_STOP_THRESHOLD,type GukjinChoice,type TurnEvent,type TurnPlan} from './game';
import {CARDS,type Card,kindLabel} from './cards';
import {SCENARIOS,findScenario} from './scenarios';
import type {Declared,Score} from './score';
import {type Opponent,publicView} from './ai';
import {BEGINNER} from './beginner';
import {type Rng,seededRng} from './rng';
import {BARBER_LINES,type DialogEvent,DialogPolicy,EVENT_MOOD} from './dialog';
import {BARBER,MOODS,type Mood,PLAYER} from './character';
import {BASE_HEIGHT,CARD,type CapturedRects,DESIGN,FLOOR_STACK_TILT,HAND_ARROW,HOLD_LIFT,MARGIN,MAX_HEIGHT,REGIONS,type Rect,type FloorLayout,type SafeInsets,capturedRects,configureLayout,floorLayout,handLayout,oppHandLayout,peekButtonRect,scoreBadgeRect,speechZone} from './ui/layout';
import {COLORS,type UI,box,button,label} from './ui/widgets';
import {drawCardFace,drawChanceCard} from './ui/cardView';
import {drawCaptured,drawPlayerInfo} from './ui/panels';
import {type PortraitView,portraitReact,preloadPortraits} from './ui/portrait';
import {drawTable} from './ui/table';
import {type ModalLine,drawCapturedView,drawModal} from './ui/modals';
import {drawGallery} from './ui/gallery';
import {missingCardTextures,preloadCardAssets} from './ui/cardAssets';
import {type BannerStyle,CardFx,FX,FxSettings} from './ui/fx';
import {SlideTracker} from './ui/slide';
import {SoundFx} from './ui/sound';
import {VoiceFx} from './ui/voice';
import {actionForTap,bakWarnings,bonusCards,captureKind,dealOrder,handDisplay,nearBonuses,newBonuses} from './ui/turnPlan';
const INTRO_MESSAGE='네 아버지 얘기가 궁금하면, 앉아라. 한 판 치면서 하자.';
const CHAPTER='CHAPTER 01 · 골목의 이발소';
const NAMES=[PLAYER.name,BARBER.name];
const GUKJIN_ID=CARDS.find(c=>c.gukjin)!.id;
/** 미구현 항목. 일반 화면에는 두지 않고 메뉴의 규칙 안내·개발 정보에서만 보여준다. */
const NOT_IMPLEMENTED='멍박·총통·첫뻑·연속뻑 미적용';
/** 빌드 표식. 메뉴 > 개발 정보에서만 보인다. 규칙이 바뀔 때마다 올린다. */
const BUILD_TAG='v0.18 긴 화면';
/** 개발용 AI 판단 로그(브라우저 콘솔 debug 수준). */
const AI_LOG=true;
const aiLog=(what:string,why:string)=>{if(AI_LOG)console.debug(`[AI ${what}] ${why}`);};
const EVENT_TEXT:Record<TurnEvent,string>={'쪽':'쪽!','뻑':'뻑!','따닥':'따닥!','쓸':'쓸!','뻑회수':'뻑 회수!','자뻑회수':'자뻑 회수!','폭탄':'폭탄!'};
/** 사건별 배너 스타일·시간. 한곳에서 조절한다. */
const EVENT_BANNER:Record<TurnEvent,{style:BannerStyle;ms:number;size:number;shakeText?:boolean}>={
  '쪽':{style:'gold',ms:FX.bannerJjok,size:60},'뻑':{style:'ink',ms:FX.bannerPpeok,size:68,shakeText:true},'따닥':{style:'ink',ms:FX.bannerShort,size:62},
  '쓸':{style:'green',ms:FX.bannerShort,size:64},'뻑회수':{style:'gold',ms:FX.bannerShort,size:52},'자뻑회수':{style:'gold',ms:FX.bannerShort,size:52},'폭탄':{style:'orange',ms:FX.bannerBomb,size:70},
};
/** 선언 근거 요약: "1월 흔들기+폭탄, 3월 폭탄". */
const declText=(d:Declared[])=>d.map(x=>`${x.month}월 ${x.kinds.join('+')}`).join(', ');
/** 제작자·출처 화면 내용. THIRD_PARTY_NOTICES.md와 같은 내용을 유지한다. */
const CREDITS=[
  {text:'화투 도안',size:18,color:COLORS.gold},
  {text:'원작: Marcus Richert, based on artwork by Louie Mantia, Jr.\nSVG 최적화: Spenĉjo',size:15,color:COLORS.text},
  {text:'출처: https://commons.wikimedia.org/wiki/File:Hwatu_overview.svg\n라이선스: CC BY-SA 4.0',size:13},
  {text:'· 전체 도안을 48장 PNG로 분리, 흰 바탕 추가, 11월 오동·12월 비 순서로 연결, 붉은 뒷면 추가',size:13,color:COLORS.text},
  {text:'글꼴',size:18,color:COLORS.gold},
  {text:'나눔고딕·나눔붓 (NHN Corporation, SIL Open Font License 1.1)\nassets/fonts/OFL.txt',size:13,color:COLORS.text},
  {text:'엔진: Phaser 3 (MIT). 효과음은 외부 음원 없이 합성. 초상화는 자리 표시 도형(일러스트 미완). 자세한 내용은 THIRD_PARTY_NOTICES.md.',size:13},
];
/** 규칙 안내(메뉴). 플레이에 필요한 요약만. */
const RULES=[
  {text:`기본 점수 ${GO_STOP_THRESHOLD}점부터 고/스톱. 고는 기본 점수가 그때보다 올라야 다시 고를 수 있고, 마지막 행동에서는 고를 할 수 없다. 양쪽 행동이 다 끝나면 나가리.`,size:15,color:COLORS.text},
  {text:'광 3장 3점(비광 포함 2점)·4장 4점·5장 15점. 열끗·띠 5장부터 1점씩, 고도리 +5, 홍단·청단·초단 +3. 피 10장부터 1점씩(쌍피 2장).',size:15,color:COLORS.text},
  {text:'쪽·따닥·쓸·폭탄·뻑 회수는 상대 피 1장(자뻑 회수 2장). 피박: 상대 피 1~7장 ×2. 광박: 상대 광 0장 ×2. 고박: 고한 뒤 지면 ×2. 흔들기·폭탄 월마다 ×2.',size:15,color:COLORS.text},
  {text:'조작: 손패를 누르면 한 장 내기. 폭탄 표시 카드는 세 장 폭탄, 흔들기 표시 카드는 세 장 공개 뒤 한 장 내기. 붉은 기회 패는 손패 없이 더미만 뒤집기. 획득 패를 누르면 크게 본다.',size:15,color:COLORS.text},
  {text:NOT_IMPLEMENTED+'. 보너스 패 없음.',size:13},
];
type Phase='intro'|'dealing'|'hand'|'choice'|'gukjin'|'gostop'|'busy'|'result'|'menu'|'credits'|'gallery'|'scenarios'|'capturedView'|'rules'|'devinfo';
/** 플레이어(사람·컴퓨터)가 자기 턴에 고르는 행동. target: 같은 월 바닥패 2장 중 미리 고른 id(컴퓨터). */
type Action={kind:'normal';index:number;shakeMonth?:number;target?:number}|{kind:'bomb';month:number}|{kind:'flip'};
/** 바닥패 2장 중 고르기. 사람은 선택창, 컴퓨터는 공개된 카드(손패 또는 뒤집은 더미 패)와 공개 정보로 판단한다. */
type PickChoice=(cands:Card[],card:Card)=>Promise<number>;
const sleep=(scene:Phaser.Scene,ms:number)=>new Promise<void>(r=>scene.time.delayedCall(ms,r));
/**
 * 세로형 대결 화면. 규칙은 GameState가 갖고, 이 씬은 턴 흐름·연출·그리기만 담당한다.
 * 턴은 runTurn 하나의 비동기 흐름이다. GameState.planTurn/planBomb/planFlip이 손패와 더미 결과를 함께 판정한 계획을 주면
 * 그 계획대로만 연출(선택 피드백 → 놓기·접촉 → 뒤집기 → 사건 배너 → 획득 → 쓸)하고, 연출이 끝난 뒤 applyTurn/stealPi를 한 번씩 호출한다.
 * 연출은 규칙을 다시 판단하거나 점수·패를 바꾸지 않는다. 모든 await 뒤에 세대 번호(gen)를 확인해 새 판·씬 종료 후 남은 연출이 상태를 건드리지 못하게 한다.
 * 컴퓨터 판단은 src/ai.ts·src/beginner.ts의 순수 함수가 공개 정보(publicView)만 보고 하며, 실행은 사람과 같은 runTurn을 쓴다.
 */
class TableScene extends Phaser.Scene {
  state!:GameState; layer!:Phaser.GameObjects.Container; fx!:CardFx; sfx=new SoundFx(); voice=new VoiceFx(); fxSettings=new FxSettings(); slides!:SlideTracker;
  /** 모달 단계(gukjin/gostop/result/menu/credits/gallery/scenarios/intro/capturedView/rules/devinfo)에서는 바닥·손패 입력을 받지 않는다. */
  phase:Phase='intro';
  message=INTRO_MESSAGE;
  selectable:number[]=[]; peek=false;
  /** 대기 중인 선택의 resolve. 모달 버튼이 이것을 호출해 흐름을 이어간다. */
  choiceResolve?:(id:number)=>void; gukjinResolve?:(c:GukjinChoice)=>void; gostopResolve?:(d:'go'|'stop')=>void;
  /** 현재 차례(0 나, 1 상대). 화면 표시용. */
  turnOwner:0|1=0;
  missingTextures:number[]=[];
  /** 바닥패 월→칸 배정. 턴이 지나도 기존 묶음이 같은 칸에 남도록 유지한다. 새 판에서 비운다. */
  floorSlots:Map<number,number>=new Map();
  /** 마지막 그리기의 바닥 배치(연출 출발·도착 좌표용). */
  lastFloor!:FloorLayout;
  /** 마지막 그리기의 획득 패 배치(카드 id → 자리). */
  lastCaptured:[CapturedRects,CapturedRects]=[{cells:[],rects:new Map()},{cells:[],rects:new Map()}];
  /** 마지막 그리기의 점수 글자(점수 강조용)와 상대 초상화(표정 반응용). */
  scoreTexts:(Phaser.GameObjects.Text|undefined)[]=[undefined,undefined];
  oppPortrait?:PortraitView;
  /** 화면에 마지막으로 반영한 기본 점수. 바뀐 만큼만 강조한다. */
  shownBase=[0,0];
  /** 상대 표정 상태(데이터). 사건 때 바뀌고 일정 시간 뒤 평상시로. */
  mood:Mood='normal'; moodTimer?:Phaser.Time.TimerEvent;
  /** 연출 중이라 정적 화면에서 숨길 카드 id. */
  hidden=new Set<number>();
  /** 세대 번호. 새 판·씬 종료 시 증가. */
  gen=0;
  /** 먹을 수 있는 손패 화살표의 왕복 트윈. 화살표는 draw()마다 새로 만들어지므로 draw() 시작과 teardown에서 정리한다. */
  arrowTweens=new Set<Phaser.Tweens.Tween>();
  /** 개발용 시나리오 키(없으면 무작위 배분). */
  scenarioKey?:string;
  /** 상대 정책과 판단용 난수(덱 셔플 난수와 별개). 첫 상대는 초보 정책. */
  opponent:Opponent=BEGINNER; aiRng:Rng=seededRng(1);
  /** 이 판에서 컴퓨터가 완료한 행동 수(일반 내기·폭탄·기회 패). 흔들기 공개는 세지 않는다. 새 판에서 0. */
  aiActions=0;
  dialog=new DialogPolicy(BARBER_LINES,3);
  /** 결과창: 차례로 드러난 항목 수. 누르면 전체. */
  resultShown=0; resultTimer?:Phaser.Time.TimerEvent; restarting=false;
  /** 결과창에 보여줄 상대 반응 대사. */
  resultLine='';
  /** 큰 획득패 목록을 여는 대상 플레이어. */
  capturedViewPlayer=0;
  constructor(){super('table');}
  preload(){preloadCardAssets(this.load);preloadPortraits(this.load,[BARBER,PLAYER]);}
  create(data?:{scenario?:string}){
    this.scenarioKey=data?.scenario;
    const sc=this.scenarioKey?findScenario(this.scenarioKey):undefined;
    this.state=new GameState(sc?.setup);
    this.phase=sc?'hand':'intro';this.message=sc?`[시나리오] ${sc.title}: ${sc.desc}`:INTRO_MESSAGE;
    this.selectable=[];this.peek=false;this.turnOwner=0;this.floorSlots=new Map();this.hidden=new Set();
    this.choiceResolve=undefined;this.gukjinResolve=undefined;this.gostopResolve=undefined;
    this.gen++;this.restarting=false;this.resultShown=0;this.resultTimer=undefined;this.resultLine='';
    this.mood='normal';this.moodTimer=undefined;this.oppPortrait=undefined;
    this.aiActions=0;this.dialog.reset();this.aiRng=seededRng((Date.now()^Math.floor(Math.random()*0x7fffffff))>>>0);
    this.shownBase=[this.state.baseScore(0),this.state.baseScore(1)];
    this.fx=new CardFx(this,this.add.container(),this.fxSettings);
    this.slides=new SlideTracker(this,()=>this.fxSettings.ms(FX.slide));
    this.missingTextures=missingCardTextures(this.textures);if(this.missingTextures.length)console.warn('카드 그림 누락 id:',this.missingTextures);
    // 첫 사용자 입력 뒤 소리 활성화(브라우저 정책)
    this.input.on('pointerdown',()=>this.sfx.unlock());
    // 새 판(restart)·씬 종료 시 진행 중인 연출과 예약 작업 정리
    this.events.once('shutdown',()=>this.teardown());this.events.once('destroy',()=>this.teardown());
    this.draw();
  }
  /** 이전 판의 트윈·배너·말풍선·예약 작업·소리·음성 예약을 모두 정리한다. 세대 번호를 올려 남은 비동기 처리가 새 판에 반영되지 않게 한다. */
  teardown(){this.gen++;this.fx.clear();this.slides.reset();this.killArrows();this.time.removeAllEvents();this.tweens.killAll();this.sfx.cancel();this.voice.cancel();this.choiceResolve=undefined;this.gukjinResolve=undefined;this.gostopResolve=undefined;this.resultTimer=undefined;this.moodTimer=undefined;}
  /** 새 판. 결과창 버튼이 여러 번 눌려도 한 번만 동작한다. */
  restart(scenario?:string){if(this.restarting)return;this.restarting=true;this.scene.restart(scenario?{scenario}:{});}
  get ui():UI{return {scene:this,layer:this.layer};}
  get myTurn(){return this.phase==='hand'||this.phase==='choice'||this.phase==='gukjin'||this.phase==='gostop';}
  ppeokCount(player:number){let n=0;for(const o of this.state.ppeok.values())if(o===player)n++;return n;}
  killArrows(){for(const t of this.arrowTweens)t.remove();this.arrowTweens.clear();}
  /** 먹을 수 있는 손패 표시: 카드 위쪽 가운데의 파란 아래 방향 삼각형. 연출 줄이기가 아니면 위아래로 짧게 왕복한다(트윈은 목록에 보관). */
  drawArrow(u:UI,cx:number,tipY:number){
    const a=HAND_ARROW;
    const tri=u.scene.add.triangle(cx,tipY-a.h/2,0,0,a.w,0,a.w/2,a.h,a.color).setStrokeStyle(a.edgeW,a.edge);
    u.layer.add(tri);
    if(!this.fxSettings.reduced)this.arrowTweens.add(u.scene.tweens.add({targets:tri,y:tri.y-a.bob,duration:FX.arrowBob/2,yoyo:true,repeat:-1,ease:'Sine.easeInOut'}));
  }
  draw(){
    this.slides.killTweens();this.killArrows();
    this.layer?.destroy(true);this.layer=this.add.container();
    this.children.bringToTop(this.fx.layer); // 연출 스프라이트는 항상 정적 화면 위
    const ui=this.ui, s=this.state;
    box(ui,0,0,DESIGN.width,DESIGN.height,COLORS.bg);
    const mine=s.score(0),theirs=s.score(1);
    const place=(key:string,r:Rect,fn:(u:UI)=>void)=>this.slides.place(ui,key,r,fn);
    // 1. 상단: 작은 챕터 제목(시나리오 모드는 작은 시나리오 표시), 메뉴
    const top=REGIONS.topBar;
    label(ui,MARGIN,top.h/2,this.scenarioKey?`시나리오 · ${findScenario(this.scenarioKey)?.title??''}`:CHAPTER,15,COLORS.goldDim,500,[0,0.5],true);
    if(this.missingTextures.length)label(ui,DESIGN.width/2,top.h/2,`카드 그림 누락 ${this.missingTextures.length}장`,12,COLORS.danger,300,[0.5,0.5]);
    button(ui,DESIGN.width-MARGIN-90,5,90,'메뉴',()=>this.openMenu(),this.phase==='hand',30,16);
    // 2~3. 상대: 큰 초상화·이름·점수·대사 자리·손패 뒷면(내용은 공개하지 않음), 획득 패
    const stable=this.phase==='hand';
    const opp=drawPlayerInfo(ui,REGIONS.oppInfo,{character:BARBER,mood:this.mood,score:theirs,goCount:s.goCount[1],gukjin:s.gukjinUse(1),handCount:s.hands[1].length,flipChances:s.flipChances[1],active:this.phase==='busy'&&this.turnOwner===1,activeText:'상대 차례',ppeokCount:this.ppeokCount(1),declared:s.declaredMonths(1),big:true,first:false,handVisible:s.hands[1].map(c=>!this.hidden.has(c.id))});
    this.scoreTexts[1]=opp.scoreText;this.oppPortrait=opp.portrait;
    this.lastCaptured[1]=drawCaptured(ui,REGIONS.oppCaptured,theirs,{hidden:this.hidden,warnings:bakWarnings(s,1),onTap:stable?()=>this.openCapturedView(1):undefined,place});
    // 4. 화투판(가운데 더미는 뒷면, 뻑 묶음 표시)
    // 분배 연출 중에는 아직 도착하지 않은 카드(hidden에 남은 분배 카드)를 더해 48 → 20으로 줄어드는 장수를 보여준다(상태는 그대로)
    const deckShown=s.deck.length+(this.phase==='dealing'?this.hidden.size:0);
    this.lastFloor=drawTable(ui,{table:s.table,deckCount:deckShown,message:this.message,selectable:this.phase==='choice'?this.selectable:[],onPick:id=>this.pick(id),prevSlots:this.floorSlots,hidden:this.hidden,ppeok:s.ppeok});
    this.floorSlots=this.lastFloor.slots;
    // 5~6. 내 정보(다음 패 보기 버튼 포함)와 획득 패(족보 완성 직전 힌트는 내 손패·획득패·공개 바닥패만으로 판단)
    const my=REGIONS.myInfo;
    this.scoreTexts[0]=drawPlayerInfo(ui,my,{character:PLAYER,mood:'normal',score:mine,goCount:s.goCount[0],gukjin:s.gukjinUse(0),flipChances:s.flipChances[0],active:this.myTurn,activeText:this.phase==='choice'?'바닥패 선택':'내 차례',ppeokCount:this.ppeokCount(0),declared:s.declaredMonths(0),big:false,first:true}).scoreText;
    const canPeek=this.phase==='hand'&&!s.peekUsed&&s.deck.length>0;
    const next=s.deck[0];
    const pb=peekButtonRect(my);
    if(this.peek&&next)drawCardFace(ui,{x:pb.x-CARD.peek.w-8,y:my.y+my.h/2-CARD.peek.h/2,w:CARD.peek.w,h:CARD.peek.h},next);
    button(ui,pb.x,pb.y,pb.w,s.peekUsed?'다음 패 · 사용함':'다음 패 보기 1회',()=>{if(this.phase!=='hand'||s.peekUsed)return;s.peekUsed=true;this.peek=true;const n=s.deck[0];if(n)this.message=`다음 더미 패: ${n.month}월 ${n.name} ${n.title}(${kindLabel(n)})`;this.draw();},canPeek,pb.h,14);
    this.lastCaptured[0]=drawCaptured(ui,REGIONS.myCaptured,mine,{hidden:this.hidden,near:nearBonuses(s.captured[0],s.hands[0],s.table),warnings:bakWarnings(s,0),onTap:stable?()=>this.openCapturedView(0):undefined,place});
    // 7. (안내 줄 없음: 조작 안내는 메뉴 > 규칙 안내. 그 자리는 손패 윗줄 위 여백으로 써 화살표가 패널과 겹치지 않는다)
    // 8. 내 손패: 월순 정렬 + 기회 패(남은 뒤집기 기회만큼), 아랫줄 주 줄 6장 + 윗줄. 먹을 수 있는 패(state.matches)에는 파란 화살표(hand 단계만, 폭탄·흔들기 배지와 함께).
    //    사용한 패의 빈자리는 남은 패가 짧게 미끄러져 메운다. 기회 패는 손패 끝에 차례로 나타난다. 배지·화살표는 'dealing' 중에는 그리지 않는다.
    const slots=handDisplay(s,0);
    const lay=handLayout(slots.length);
    const inHand=this.phase==='hand';
    const bombMonths=inHand?s.bombCandidates(0):[], shakeMonths=inHand?s.shakeCandidates(0):[];
    const dim=this.phase!=='hand'&&this.phase!=='busy'&&this.phase!=='dealing';
    const arrows:{cx:number;tipY:number}[]=[]; // 화살표는 카드를 모두 그린 뒤 따로 그려 윗줄 카드에 가려지지 않게 한다
    slots.forEach((slot,i)=>{
      const mo=slot.kind==='card'?slot.card.month:-1;
      const mark=bombMonths.includes(mo)?{badge:'폭탄',badgeColor:0xf0923a}:shakeMonths.includes(mo)?{badge:'흔들기',badgeColor:0xe0b64f}:{};
      if(slot.kind==='card'){
        if(this.hidden.has(slot.card.id))return;
        const r=lay[i], canTake=inHand&&s.matches(slot.card).length>0;
        this.slides.place(ui,`hand:${slot.card.id}`,r,u=>{
          box(u,r.x+3,r.y+4,r.w,r.h,0x000000,0.3);
          drawCardFace(u,r,slot.card,{dim,...mark,onTap:inHand?()=>this.play(slot.index):undefined});
        });
        if(canTake)arrows.push({cx:r.x+r.w/2,tipY:r.y-HAND_ARROW.above});
      }
      else this.slides.place(ui,`chance:${slot.n}`,lay[i],u=>drawChanceCard(u,lay[i],{dim,onTap:inHand?()=>this.flipOnly():undefined}),'fade',slot.n*90);
    });
    for(const a of arrows)this.drawArrow(ui,a.cx,a.tipY);
    this.drawModals(mine.total,theirs.total);
  }
  drawModals(myBase:number,theirBase:number){
    const ui=this.ui, s=this.state;
    if(this.phase==='intro'){
      drawModal(ui,{title:'아버지의 수첩, 첫 번째 이름',alpha:.92,lines:[
        {text:'고향의 식당에서 발견한 낡은 수첩.\n첫 이름을 따라 찾아온 곳은 골목 끝 이발소였다.',size:19,color:COLORS.text},
        {text:'“네 아버지 얘기가 궁금하면, 앉아라.\n한 판 치면서 하자.”',size:20,color:COLORS.gold},
      ],buttons:[{text:'첫 판 시작',onTap:()=>{if(this.phase!=='intro')return;void this.deal();}}]});
    }
    if(this.phase==='gukjin'){
      const p=s.previewGukjin(0);
      drawModal(ui,{title:'9월 국진을 어떻게 사용할까요?',card:GUKJIN_ID,lines:[{text:'한 번 정하면 이 판에서는 바꿀 수 없습니다. 열끗과 피 중 한쪽에만 계산됩니다.'}],buttons:[
        {text:`열끗으로 사용  ·  예상 합계 ${p.열끗}점`,onTap:()=>this.decideGukjin('열끗')},
        {text:`쌍피로 사용  ·  예상 합계 ${p.피}점`,onTap:()=>this.decideGukjin('피')},
      ]});
    }
    if(this.phase==='gostop'){
      const base=s.baseScore(0), n=s.goCount[0], pv=s.previewSettlement(0);
      const mult=[...(pv.baks.length?[`${pv.baks.join('·')} ${pv.multiplier}배`]:[]),...(pv.declared.length?[`선언(${declText(pv.declared)}) ${pv.declMultiplier}배`]:[])];
      const bak=mult.length?`  ×  ${mult.join(' × ')}  =  ${pv.final}점`:'';
      drawModal(ui,{title:'고 또는 스톱?',lines:[
        {text:`기본 점수 ${base}점  ·  현재 ${n}고  ·  지금 스톱하면 ${pv.goPoints}점${bak}`,color:COLORS.text},
        {text:'고를 외치면 기본 점수가 지금보다 올라야 다시 선택할 수 있습니다.',size:15},
      ],buttons:[
        {text:`고  ·  ${n+1}고로 계속`,onTap:()=>this.decideGoStop('go'),fill:0xe0875a},
        {text:`스톱  ·  ${pv.final}점으로 승리`,onTap:()=>this.decideGoStop('stop')},
      ]});
    }
    if(this.phase==='result'&&s.result){
      // 확정된 결과 객체만 읽는다(재정산 없음). 항목은 승패 → 상대 반응 → 기본 → 고 → 박 → 선언 배수 → 최종 순으로 차례로 드러나고, 누르면 전체.
      const r=s.result;
      const lines:ModalLine[]=r.outcome==='승리'
        ?[{text:`“${this.resultLine}”`,size:17,color:COLORS.gold},
          {text:`기본 점수 ${r.base}점`,size:19,color:COLORS.text},
          {text:r.goCount===0?'고 없음':r.goCount<=2?`${r.goCount}고  +${r.goCount}점 → ${r.settled}점`:`${r.goCount}고 → ${r.settled}점`,size:19,color:COLORS.text},
          {text:r.baks.length?`박: ${r.baks.map(b=>`${b} ×2`).join(' · ')}`:'박 없음',size:19,color:r.baks.length?COLORS.danger:COLORS.muted},
          {text:r.declared.length?`선언 배수: ${declText(r.declared)} ×${r.declMultiplier}`:'선언 배수 없음',size:19,color:r.declared.length?COLORS.danger:COLORS.muted},
          {text:`최종 ${r.final}점`,size:34,color:COLORS.gold,bold:true}]
        :[{text:`“${this.resultLine}”`,size:17,color:COLORS.gold},{text:'나가리. 양쪽 행동이 모두 소진될 때까지 아무도 스톱하지 않았습니다. 승자 없음, 박·정산 없음, 다음 판 이월 없음.',size:17,color:COLORS.text}];
      const shown=lines.slice(0,this.resultShown);
      drawModal(ui,{title:r.outcome==='승리'?(r.winner===0?'승리':'패배'):'나가리',titleColor:r.outcome==='승리'?(r.winner===0?COLORS.gold:COLORS.danger):COLORS.muted,alpha:.82,onTap:()=>this.revealResult(),minBodyH:lines.length*36+70,lines:[
        ...shown,
        ...(this.resultShown>=lines.length?[{text:`기본 점수  나 ${myBase}점  /  ${NAMES[1]} ${theirBase}점  ·  ${this.message}`,size:14}]:[]),
      ],buttons:[{text:'새 판 시작',onTap:()=>this.restart()}]});
    }
    if(this.phase==='menu'){
      const on=this.sfx.enabled, reduced=this.fxSettings.reduced;
      drawModal(ui,{title:'메뉴',lines:[{text:`소리: ${on?'켜짐':'꺼짐'}${on&&!this.sfx.ready?' (첫 터치 뒤 활성화)':''}  ·  연출 줄이기: ${reduced?'켜짐':'꺼짐'}`}],buttons:[
        {text:'새 판 시작',onTap:()=>this.restart()},
        {text:on?'소리 끄기':'소리 켜기',onTap:()=>{if(this.phase!=='menu')return;this.sfx.setEnabled(!on);this.voice.enabled=!on;if(!on)this.sfx.play('deal');this.draw();}},
        {text:reduced?'연출 줄이기 끄기':'연출 줄이기 켜기',onTap:()=>{if(this.phase!=='menu')return;this.fxSettings.setReduced(!reduced);this.draw();}},
        {text:'규칙 안내',onTap:()=>this.switchModal('menu','rules')},
        {text:'제작자·출처',onTap:()=>this.switchModal('menu','credits')},
        {text:'개발 정보',onTap:()=>this.switchModal('menu','devinfo')},
        {text:'닫기',onTap:()=>this.switchModal('menu','hand')},
      ]});
    }
    if(this.phase==='rules'){
      drawModal(ui,{title:'규칙 안내',alpha:.92,lines:RULES,buttons:[{text:'닫기',onTap:()=>this.switchModal('rules','menu')}]});
    }
    if(this.phase==='credits'){
      drawModal(ui,{title:'제작자·출처',alpha:.92,lines:CREDITS,buttons:[{text:'닫기',onTap:()=>this.switchModal('credits','menu')}]});
    }
    if(this.phase==='devinfo'){
      drawModal(ui,{title:'개발 정보',alpha:.92,lines:[
        {text:`빌드 ${BUILD_TAG}  ·  상대 정책 ${this.opponent.key}  ·  이번 판 상대 행동 ${this.aiActions}회`,size:14,color:COLORS.text},
        {text:`미구현: ${NOT_IMPLEMENTED}. 초상화 일러스트·음성 파일 없음(자리 표시·연결 지점만). AI 판단 이유는 콘솔 debug 로그.`,size:13},
        {text:'연출 줄이기는 화면 흔들림·충격 고리·섬광·궤적을 끄고 이동 시간을 절반으로 줄인다. 규칙 처리 순서와 결과는 같다.',size:13},
      ],buttons:[
        {text:'카드 목록',onTap:()=>this.switchModal('devinfo','gallery')},
        {text:'시나리오',onTap:()=>this.switchModal('devinfo','scenarios')},
        {text:'닫기',onTap:()=>this.switchModal('devinfo','menu')},
      ]});
    }
    if(this.phase==='gallery'){
      drawGallery(ui,()=>this.switchModal('gallery','devinfo'));
    }
    if(this.phase==='scenarios'){
      drawModal(ui,{title:'개발용 시나리오',alpha:.92,lines:[{text:'고정된 패 구성으로 특수 상황을 재현합니다. 선택하면 그 구성으로 새 판을 시작합니다.',size:14}],buttons:[
        ...SCENARIOS.map(sc=>({text:sc.title,onTap:()=>this.restart(sc.key)})),
        {text:'닫기',onTap:()=>this.switchModal('scenarios','devinfo')},
      ]});
    }
    if(this.phase==='capturedView'){
      const p=this.capturedViewPlayer, sc=s.score(p);
      const note=(g:{cards:Card[];points:number;bonuses:string[]})=>`${g.cards.length}장 · ${g.points}점${g.bonuses.length?' · '+g.bonuses.join(' '):''}`;
      drawCapturedView(ui,`${NAMES[p]}의 획득 패 · 기본 ${sc.total}점`,[
        {kind:'광',cards:sc.광.cards,note:note(sc.광)},{kind:'열끗',cards:sc.열끗.cards,note:note(sc.열끗)},{kind:'띠',cards:sc.띠.cards,note:note(sc.띠)},
        {kind:'피',cards:sc.피.cards,note:`${sc.피.cards.length}장 · 가치 ${sc.피.value} · ${sc.피.points}점`},
      ],()=>this.switchModal('capturedView','hand'));
    }
  }
  openMenu(){if(this.phase!=='hand')return;this.phase='menu';this.draw();}
  /** 획득 패 큰 목록. 내 차례의 안정된 상태(hand)에서만 열리며 게임 흐름을 바꾸지 않는다. */
  openCapturedView(player:number){if(this.phase!=='hand')return;this.capturedViewPlayer=player;this.phase='capturedView';this.draw();}
  /** 결과창 항목을 차례로 드러낸다. 누르면 전체 즉시. */
  startResultReveal(total:number){
    this.resultShown=0;this.resultTimer?.remove(false);
    const step=this.fxSettings.reduced?Math.round(FX.resultStep*0.5):FX.resultStep;
    const gen=this.gen;
    this.resultTimer=this.time.addEvent({delay:step,repeat:total,callback:()=>{if(gen!==this.gen||this.phase!=='result')return;if(this.resultShown<total){this.resultShown++;this.draw();}}});
  }
  revealResult(){if(this.phase!=='result')return;this.resultTimer?.remove(false);this.resultShown=99;this.draw();}
  /**
   * 패 나누기 연출(무작위 판). 분배는 GameState 생성자에서 이미 끝났으므로 정해진 결과를 보여주기만 한다: 모든 손패·바닥패를 숨긴 뒤
   * 더미 자리에서 상대 5 → 나 5 → 바닥 4 → 상대 5 → 나 5 → 바닥 4 순(dealOrder)으로 뒷면을 날리고, 나·바닥 패는 도착 뒤 앞면으로 뒤집는다(바닥은 자리 기울기 적용).
   * 도착한 카드는 숨김에서 빼고 정적 화면에 넣은 뒤 스프라이트를 지운다. 모든 await 뒤에 세대 번호를 확인하고, 중단 시 스프라이트 정리는 fx.clear()에 맡긴다.
   * 'dealing' 중에는 메뉴·손패 입력이 막히고(hand 아님), 끝나면 hand 단계·내 차례.
   */
  async deal(){
    const gen=this.gen, s=this.state;
    this.phase='dealing';this.turnOwner=0;this.message='';
    for(const c of [...s.hands[0],...s.hands[1],...s.table])this.hidden.add(c.id);
    this.draw();
    const dealMs=this.fxSettings.ms(FX.deal), stepMs=this.fxSettings.ms(FX.dealStep);
    const arrivals:Promise<void>[]=[];
    for(const {card,to} of dealOrder(s)){
      const sp=this.fx.spawn(null,this.lastFloor.deck);
      const dest=to==='opp'?oppHandLayout(REGIONS.oppInfo,s.hands[1].length,true)[s.hands[1].indexOf(card)]
        :to==='me'?this.handRects(0,[card])[0]
        :this.lastFloor.cards[s.table.indexOf(card)];
      arrivals.push((async()=>{
        await this.fx.fly(sp,dest,dealMs);if(gen!==this.gen)return;
        this.sfx.play('deal');
        if(to!=='opp'){await this.fx.flipTo(sp,card);if(gen!==this.gen)return;}
        this.hidden.delete(card.id);this.draw();this.fx.remove(sp);
      })());
      await sleep(this,stepMs);if(gen!==this.gen)return;
    }
    await Promise.all(arrivals);if(gen!==this.gen)return;
    this.hidden.clear();
    this.phase='hand';this.turnOwner=0;this.message='내 차례입니다. 손패를 누르세요.';this.draw();
  }
  /** 기회 패 누르기: 기회 1회를 써서 손패 없이 더미 한 장만 처리한다. 단계가 hand일 때만 받으며 runPlayerTurn이 즉시 busy로 바꿔 연속 클릭을 막는다. 기회는 applyTurn이 성공할 때만 차감된다. */
  flipOnly(){if(this.phase!=='hand'||!this.state.canFlipOnly(0))return;void this.runPlayerTurn({kind:'flip'});}
  /**
   * 선언 → 세 장을 부채처럼 살짝 펼쳐 공개 + 금색 "흔들기!" → 손패로 복귀. 카드·턴은 바뀌지 않는다(version만 증가). 연출 중 입력은 busy로 막는다.
   * 턴 흐름의 일부로 불리면(standalone=false) 끝나도 입력 단계로 돌리지 않고 이어서 카드를 낸다(차례가 바뀌지 않는다).
   */
  async shake(player:number,month:number,standalone=true){
    const gen=this.gen, s=this.state;
    if(!s.canShake(player,month))return;
    const cards=s.declareShake(player,month);
    this.phase='busy';this.message=`${player===0?'내가':NAMES[1]+'이'} ${month}월 세 장으로 흔들었습니다.`;this.draw();
    const from=this.handRects(player,cards);
    const c=this.tableCenter(), w=CARD.hand.w, h=CARD.hand.h;
    const dest=cards.map((_,i)=>({x:c.x-(w*3+4)/2+i*(w+2),y:c.y-h/2+Math.abs(i-1)*10,w,h}));
    const angles=[-9,0,9];
    const sprites=cards.map((card,i)=>this.fx.spawn(card,from[i]));
    this.sfx.play('flip');
    await Promise.all(sprites.flatMap((sp,i)=>[this.fx.moveTo(sp,dest[i]),this.fx.tiltTo(sp,angles[i])]));if(gen!==this.gen)return;
    await this.fx.banner('흔들기!',c.x,c.y-h/2-70,FX.bannerShake,{style:'gold',size:60});if(gen!==this.gen)return;
    await sleep(this,this.fxSettings.ms(250));if(gen!==this.gen)return;
    await Promise.all(sprites.flatMap((sp,i)=>[this.fx.moveTo(sp,from[i]),this.fx.tiltTo(sp,0)]));if(gen!==this.gen)return;
    sprites.forEach(sp=>this.fx.remove(sp));
    this.sfx.play('deal');
    if(player===0&&standalone){this.phase='hand';this.draw();}
  }
  /** 모달 사이 이동. 현재 단계가 from일 때만 바꿔 중복 입력을 막는다. */
  switchModal(from:Phase,to:Phase){if(this.phase!==from)return;this.phase=to;this.draw();}
  // ---- 선택 대기: 모달 버튼이 resolve를 호출해 비동기 턴 흐름을 이어간다 ----
  pick(id:number){if(this.phase!=='choice'||!this.selectable.includes(id))return;const r=this.choiceResolve;this.choiceResolve=undefined;this.phase='busy';this.selectable=[];r?.(id);}
  decideGukjin(c:GukjinChoice){if(this.phase!=='gukjin')return;const r=this.gukjinResolve;this.gukjinResolve=undefined;this.phase='busy';r?.(c);}
  decideGoStop(d:'go'|'stop'){if(this.phase!=='gostop')return;const r=this.gostopResolve;this.gostopResolve=undefined;this.phase='busy';r?.(d);}
  askChoice(ids:number[],msg:string){return new Promise<number>(res=>{this.choiceResolve=res;this.phase='choice';this.selectable=ids;this.message=msg;this.draw();});}
  askGukjin(){return new Promise<GukjinChoice>(res=>{this.gukjinResolve=res;this.phase='gukjin';this.message='9월 국진을 획득했습니다. 사용 방식을 선택하세요.';this.draw();});}
  askGoStop(){return new Promise<'go'|'stop'>(res=>{this.gostopResolve=res;this.phase='gostop';this.message=`기본 점수 ${this.state.baseScore(0)}점. 고 또는 스톱을 선택하세요.`;this.draw();});}
  /** 판 종료 화면. 대기 중인 선택과 연출을 모두 버려 상대 턴이 실행되지 않게 한다. 결과 항목은 차례로 드러난다. 상대 반응 대사·표정을 정한다. */
  showResult(note:string){
    this.gen++;this.fx.clear();this.hidden.clear();
    this.phase='result';this.selectable=[];this.choiceResolve=undefined;this.gukjinResolve=undefined;this.gostopResolve=undefined;this.peek=false;
    this.message=note;
    const r=this.state.result;
    const ev:DialogEvent=r?.outcome==='승리'?(r.winner===0?'playerWin':'aiWin'):'draw';
    this.resultLine=this.dialog.pick(ev,this.state.turn,this.aiRng)??'';
    this.setMood(EVENT_MOOD[ev]);
    this.startResultReveal(r?.outcome==='승리'?6:2);
    this.draw();
  }
  /** 상대 표정을 바꾸고(데이터) 초상화에 작은 움직임을 건다. 일정 시간 뒤 평상시로 돌아온다. */
  setMood(mood:Mood){
    this.mood=mood;this.moodTimer?.remove(false);this.moodTimer=undefined;
    this.draw();
    if(this.oppPortrait)portraitReact(this,this.oppPortrait,mood,this.fxSettings.reduced);
    const hold=MOODS[mood].holdMs;
    if(hold>0){const gen=this.gen;this.moodTimer=this.time.delayedCall(hold,()=>{if(gen!==this.gen||this.mood!==mood)return;this.mood='normal';if(this.phase!=='result')this.draw();});}
  }
  /** 상대 반응: 대사 정책이 허락하면 말풍선(미리 비워 둔 자리)과 표정. 흐름을 멈추지 않는다. */
  say(event:DialogEvent){
    const text=this.dialog.pick(event,this.state.turn,this.aiRng);
    if(!text)return;
    this.setMood(EVENT_MOOD[event]);
    this.fx.speech(text,speechZone());
  }
  /** 점수 숫자 강조: 화면에 마지막으로 반영한 기본 점수와 실제 계산값의 차이만큼 "+N/−N"을 띄운다(피를 빼앗겨 줄어든 경우 포함). */
  pulseScores(){
    for(const p of [0,1]){
      const base=this.state.baseScore(p), delta=base-this.shownBase[p];
      if(delta===0)continue;
      this.shownBase[p]=base;
      const t=this.scoreTexts[p];
      // 점수 배지 왼쪽 바깥(배지 x − 10, 오른쪽 정렬, 세로 가운데)에서 떠오른다. 배지 안으로는 들어오지 않는다
      const sb=scoreBadgeRect(p===0?REGIONS.myInfo:REGIONS.oppInfo,p===1);
      this.fx.scorePulse(t,sb.x-10,sb.y+sb.h/2,delta,1);
    }
  }
  // ---- 연출 좌표 ----
  /** 바닥 위에 카드를 잠시 들고 있는 자리(더미 위쪽 HOLD_LIFT만큼 올려 장수 배지를 가리지 않음, 기울기 없음). 뒤집기와 바닥패 선택 대기에 쓴다. */
  holdRect(offset=0):Rect{const d=this.lastFloor.deck;return {x:d.x+offset*(d.w+6),y:d.y-Math.round(d.h*HOLD_LIFT),w:d.w,h:d.h,angle:0};}
  floorRectOf(card:Card):Rect{return this.lastFloor.cards[this.state.table.indexOf(card)];}
  /** 손패(또는 상대 손패 뒷면) 안에서 카드들의 현재 자리. 내 손패는 화면 표시 순서(월순 + 기회 패)를 따른다. */
  handRects(player:number,cards:Card[]):Rect[]{
    const hand=this.state.hands[player];
    if(player===0){const slots=handDisplay(this.state,0);const lay=handLayout(slots.length);return cards.map(c=>lay[slots.findIndex(sl=>sl.kind==='card'&&sl.card.id===c.id)]);}
    const lay=oppHandLayout(REGIONS.oppInfo,hand.length,true);
    return cards.map(c=>lay[hand.indexOf(c)]);
  }
  /** 아직 바닥에 없는 월의 카드가 놓일 칸. 같은 배정 규칙을 써서 실제 그리기와 일치한다. */
  newFloorRect(card:Card,extraMonths:number[]=[]):Rect{const months=[...this.state.table.map(c=>c.month),...extraMonths,card.month];return floorLayout(months,undefined,this.floorSlots).cards[months.length-1];}
  /** 카드가 획득 패 패널에서 갖게 될 최종 자리. pending(함께 들어올 카드)을 더한 배치로 계산해 패널 그리기와 일치한다. */
  capturedRect(player:number,card:Card,pending:Card[]):Rect{
    const s=this.state, opt=s.scoreOptions(player);
    const all=[...s.captured[player],...pending.filter(c=>!s.captured[player].includes(c))];
    const groups={광:[] as Card[],열끗:[] as Card[],띠:[] as Card[],피:[] as Card[]};
    for(const c of all)groups[captureKind(c,opt)].push(c);
    return capturedRects(player===0?REGIONS.myCaptured:REGIONS.oppCaptured,groups).rects.get(card.id)!;
  }
  tableCenter(){const t=REGIONS.table;return {x:t.x+t.w/2,y:t.y+t.h/2};}
  /** 획득 패 패널 가운데(족보 배너 자리). */
  capturedCenter(player:number){const r=player===0?REGIONS.myCaptured:REGIONS.oppCaptured;return {x:r.x+r.w/2,y:r.y+r.h/2};}
  /**
   * 턴 하나의 연출과 처리. 행동 종류에 따라 계획을 만들고(일반 planTurn / 폭탄 planBomb / 더미만 planFlip)
   * 순서: 선택 피드백(들어올리기) → 손패 날리기·접촉(폭탄은 세 장 연속 → 주황 충격파·"폭탄!") → 더미 뒤집기·놓기(따닥은 2회 타격, 쪽은 두 패 사이 섬광) → 사건 배너(쪽·뻑·따닥·회수)
   * → 획득 묶음 강조·이동 → 쓸(궤적, 바닥이 빈 것이 보인 뒤) → applyTurn 1회 → 국진 선택 → 새로 완성된 족보 → 상대 피 이동(stealPi) → 점수 변화 강조.
   * 고/스톱 판단은 호출한 쪽이 한다. 더미 패는 뒤집기 연출의 절반 지점까지 앞면을 보이지 않는다. 선택 대기 중에는 큰 효과를 띄우지 않는다.
   */
  async runTurn(player:number,action:Action,pickChoice:PickChoice):Promise<TurnPlan|null>{
    const gen=this.gen, s=this.state;
    const placed=new Map<number,Rect>(); // 이번 턴에 놓인 손패·더미 패의 위치
    const sprites=new Map<number,Phaser.GameObjects.Image>();
    const landRect=(l:{card:Card;onto:Card[]})=>{
      if(l.onto.length===0)return this.newFloorRect(l.card,[...placed.keys()].map(id=>CARDS[id].month).filter(m=>m!==l.card.month));
      const last=l.onto[l.onto.length-1];
      const base=placed.get(last.id)??this.floorRectOf(last);
      return {x:base.x+Math.round(base.w*CARD.floor.stackDx),y:base.y,w:base.w,h:base.h,angle:(base.angle??0)+FLOOR_STACK_TILT};
    };
    const scoreBefore:Score=s.score(player);
    let plan:TurnPlan;
    let bannerDone:TurnEvent[]=[];
    if(action.kind==='normal'){
      const card=s.hands[player][action.index];
      // 1) 손패 분석: 같은 월 2장이고 따닥이 아니면 먼저 고른다(컴퓨터는 미리 고른 target 사용)
      const an=s.analyzeHand(card);
      const from=this.handRects(player,[card])[0];
      const sprite=this.fx.spawn(player===0?card:null,from);sprites.set(card.id,sprite);
      if(player===0){this.hidden.add(card.id);this.draw();this.sfx.play('select');await this.fx.lift(sprite);if(gen!==this.gen)return null;this.hidden.delete(card.id);}
      s.hands[player].splice(action.index,1);this.slides.forget(`hand:${card.id}`);this.draw();
      if(player===1){await this.fx.moveTo(sprite,this.holdRect());if(gen!==this.gen)return null;await this.fx.flipTo(sprite,card);if(gen!==this.gen)return null;this.sfx.play('flip');}
      let handTarget:number|undefined;
      if(an.needsChoice){
        if(action.target!==undefined&&an.matches.some(c=>c.id===action.target))handTarget=action.target;
        else{
          if(player===0){await this.fx.moveTo(sprite,this.holdRect());if(gen!==this.gen)return null;}
          handTarget=await pickChoice(an.matches,card);if(gen!==this.gen)return null;
        }
      }
      plan=s.planTurn(player,card,handTarget);
      // 2) 손패 날리기 + 접촉
      const hr=landRect(plan.landings[0]);placed.set(card.id,hr);
      await this.fx.fly(sprite,hr);if(gen!==this.gen)return null;
      this.sfx.play('deal');await this.fx.impact(sprite,hr);if(gen!==this.gen)return null;
    }else if(action.kind==='bomb'){
      plan=s.planBomb(player,action.month);
      const cards=plan.bombCards;
      const from=this.handRects(player,cards);
      for(const c of cards){const i=s.hands[player].indexOf(c);if(i>=0)s.hands[player].splice(i,1);this.slides.forget(`hand:${c.id}`);}
      this.draw();
      const sps=cards.map((c,i)=>{const sp=this.fx.spawn(player===0?c:null,from[i]);sprites.set(c.id,sp);return sp;});
      if(player===1){
        await Promise.all(sps.map((sp,i)=>this.fx.moveTo(sp,this.holdRect(i-1))));if(gen!==this.gen)return null;
        await Promise.all(sps.map((sp,i)=>this.fx.flipTo(sp,cards[i])));if(gen!==this.gen)return null;this.sfx.play('flip');
      }
      // 세 장을 짧은 간격으로 연속 접촉. 마지막 장에서 주황 충격파와 최대 100ms의 약한 화면 흔들림(연출 줄이기에서는 없음). 전체 화면 섬광은 없다.
      for(let i=0;i<cards.length;i++){
        const l=plan.landings[i];const r=landRect(l);placed.set(cards[i].id,r);
        await this.fx.fly(sps[i],r,this.fxSettings.ms(FX.fly));if(gen!==this.gen)return null;
        if(i<cards.length-1){this.sfx.play('deal');await this.fx.impact(sps[i],r);}
        else{this.sfx.play('bomb');this.voice.play('폭탄');this.fx.shakeScreen();await this.fx.impact(sps[i],r,2);}
        if(gen!==this.gen)return null;
      }
      const c=this.tableCenter(), eb=EVENT_BANNER['폭탄'];
      if(player===0)this.say('playerBomb');
      await this.fx.banner(EVENT_TEXT['폭탄'],c.x,c.y,eb.ms,{style:eb.style,size:eb.size});if(gen!==this.gen)return null;
      bannerDone=['폭탄'];
    }else{
      plan=s.planFlip(player);
      this.message=`${player===0?'손패 없이':NAMES[1]+'이 손패 없이'} 더미만 뒤집습니다.`;this.draw();
    }
    // 3) 더미 뒤집기·놓기(필요하면 뒤집은 뒤 선택). 앞면은 뒤집기 절반 지점에 교체된다.
    if(plan.deckCard){
      const D=plan.deckCard;
      const deckSprite=this.fx.spawn(null,this.lastFloor.deck);sprites.set(D.id,deckSprite);
      await this.fx.moveTo(deckSprite,this.holdRect(),this.fxSettings.ms(FX.flip/2));if(gen!==this.gen)return null;
      await this.fx.flipTo(deckSprite,D);if(gen!==this.gen)return null;
      this.sfx.play('flip');
      if(plan.needsDeckChoice){
        const deckTarget=await pickChoice(plan.needsDeckChoice,D);if(gen!==this.gen)return null;
        plan=s.replanDeckChoice(plan,deckTarget); // 손패는 연출용으로 이미 뺐으므로 원래 계획의 카드로 다시 계획
      }
      const dl=plan.landings.find(l=>l.source==='deck')!;
      const dr=landRect(dl);placed.set(D.id,dr);
      await this.fx.fly(deckSprite,dr);if(gen!==this.gen)return null;
      if(plan.events.includes('따닥')){
        // 따닥: 카드 접촉에 맞춘 두 번의 작은 충격. 착지음은 2회 타격음 하나로 대신해 같은 접촉음이 겹치지 않는다.
        this.sfx.play('ttadak');this.voice.play('따닥');await this.fx.impact(deckSprite,dr);if(gen!==this.gen)return null;
        const hs=plan.card?sprites.get(plan.card.id):undefined;
        if(hs?.active)await this.fx.impact(hs,placed.get(plan.card!.id)!);else await this.fx.impact(deckSprite,dr);
      }else{this.sfx.play('deal');await this.fx.impact(deckSprite,dr);}
      if(gen!==this.gen)return null;
      // 쪽: 일치한 두 패(손패·더미 패) 사이의 짧은 금빛 섬광
      if(plan.events.includes('쪽')&&plan.card){this.fx.flash(placed.get(plan.card.id)!,dr);this.voice.play('쪽');}
    }
    // 4) 사건 배너(순서대로, 겹치지 않게). 이미 보여준 것(폭탄)과 쓸(획득 뒤)은 제외. 뻑은 세 장을 바닥에 남긴 채 먹물 배경과 글자 떨림.
    const c=this.tableCenter();
    for(const ev of plan.events){
      if(bannerDone.includes(ev)||ev==='쓸')continue;
      const eb=EVENT_BANNER[ev];
      if(player===0&&ev==='쪽')this.say('playerJjok');
      if(player===1&&ev==='뻑')this.say('aiPpeok');
      await this.fx.banner(EVENT_TEXT[ev],c.x,c.y,eb.ms,{style:eb.style,size:eb.size,shakeText:eb.shakeText});if(gen!==this.gen)return null;
    }
    // 5) 획득 묶음: 겹쳐진 상태를 잠깐 강조 → 해당 분류의 최종 자리로 함께 이동. 바닥에 남는 패(일반 놓기·뻑)는 그대로 둔다(금색 이동 없음).
    if(plan.captureGroups.length){
      const all=plan.captureGroups.flat();
      const rects=all.map(x=>placed.get(x.id)??this.floorRectOf(x));
      await this.fx.highlight(rects);if(gen!==this.gen)return null;
      const flights:Promise<void>[]=[];
      const sseul=plan.events.includes('쓸');
      all.forEach((x,i)=>{
        let sp=sprites.get(x.id);
        if(!sp){sp=this.fx.spawn(x,this.floorRectOf(x));sprites.set(x.id,sp);this.hidden.add(x.id);}
        const to=this.capturedRect(player,x,all);
        if(sseul&&i===all.length-1)this.fx.trail(rects[i],to); // 쓸: 마지막 패가 떠날 때 얇은 초록빛 궤적
        flights.push(this.fx.fly(sp!,to,this.fxSettings.ms(FX.capture),2));
      });
      this.draw();
      await Promise.all(flights);if(gen!==this.gen)return null;
      this.sfx.play('capture');
      // 쓸: 바닥을 비운 사실이 보인 다음 표시(새 패가 깔리기 전, 이 턴 안에서)
      if(sseul){const eb=EVENT_BANNER['쓸'];this.voice.play('싹쓸이');if(player===0)this.say('playerSseul');await this.fx.banner(EVENT_TEXT['쓸'],c.x,c.y,eb.ms,{style:eb.style,size:eb.size});if(gen!==this.gen)return null;}
    }
    for(const sp of sprites.values())this.fx.remove(sp);
    // 6) 상태 적용(한 번). 날아간 카드는 패널의 최종 자리에서 바로 나타난다.
    for(const x of plan.captureGroups.flat())this.slides.forget(`cap:${x.id}`);
    s.applyTurn(plan);this.hidden.clear();this.draw();
    // 7) 국진 선택(필요할 때). 컴퓨터는 공개 정보로 판단하고 이미 결정된 판에서는 묻지 않는다.
    if(s.pendingGukjin(player)){
      if(player===0){const ch=await this.askGukjin();if(gen!==this.gen)return null;s.chooseGukjin(0,ch);this.message=`국진을 ${ch==='피'?'쌍피':'열끗'}으로 사용합니다.`;}
      else{const d=this.opponent.chooseGukjin(publicView(s,1));s.chooseGukjin(1,d.choice);aiLog('국진',d.reason);this.message=`${NAMES[1]}은 국진을 ${d.choice==='피'?'쌍피':'열끗'}으로 씁니다.`;}
      this.draw();
    }
    // 8) 새로 완성된 족보만 표시: 실제 구성 패 강조 → 금색 이름 → 점수 변화. 보유 중인 족보는 반복하지 않는다.
    const scoreAfter=s.score(player);
    for(const name of newBonuses(scoreBefore,scoreAfter)){
      const rects=bonusCards(scoreAfter,name).map(x=>this.lastCaptured[player].rects.get(x.id)).filter((r):r is Rect=>!!r);
      await this.fx.highlight(rects,this.fxSettings.ms(FX.highlight*2),0xfff1c2);if(gen!==this.gen)return null;
      const cc=this.capturedCenter(player);this.sfx.play('combo');
      if(player===0)this.say('playerCombo');
      await this.fx.banner(`${name}!`,cc.x,cc.y,FX.bannerCombo,{style:'gold',size:48});if(gen!==this.gen)return null;
    }
    this.pulseScores();
    // 9) 상대 피 이동: 상대 획득 칸에서 내 획득 칸으로 한 장씩. 점수가 줄어든 쪽도 실제 감소량을 표시한다.
    if(plan.piSteals>0){
      const other=1-player;
      const cards=s.peekSteal(other,plan.piSteals);
      if(cards.length){
        const flights:Promise<void>[]=[];
        for(const x of cards){
          const r=this.lastCaptured[other].rects.get(x.id)!;
          const sp=this.fx.spawn(x,r);this.hidden.add(x.id);
          flights.push(this.fx.fly(sp,this.capturedRect(player,x,cards),this.fxSettings.ms(FX.capture),2).then(()=>this.fx.remove(sp)));
          this.slides.forget(`cap:${x.id}`);
        }
        this.draw();
        await Promise.all(flights);if(gen!==this.gen)return null;
        this.sfx.play('capture');
        s.stealPi(other,player,plan.piSteals);this.hidden.clear();
        this.message=player===0?`상대 피 ${cards.length}장을 가져왔습니다.`:`${NAMES[1]}이 내 피 ${cards.length}장을 가져갔습니다.`;
      }else this.message='가져올 상대 피가 없습니다.';
      this.draw();this.pulseScores();
    }
    return plan;
  }
  /** 일반 손패 누르기: 폭탄 가능하면 세 장 폭탄, 아니면 흔들기 가능한 월이면 자동 흔들기 뒤 그 한 장 내기, 그 외 한 장 내기. 기회 패는 flipOnly로 따로 받는다. */
  play(index:number){
    if(this.phase!=='hand')return;
    void this.runPlayerTurn(actionForTap(this.state,0,index));
  }
  async runPlayerTurn(action:Action){
    const gen=this.gen, s=this.state;
    if(this.phase!=='hand')return;
    this.phase='busy';this.peek=false;this.turnOwner=0;this.message='';
    // 자동 흔들기: 공개 연출을 먼저 끝내고(version 증가) 그 뒤에 일반 턴 계획을 만든다. 손패는 소비되지 않으므로 index는 그대로다.
    if(action.kind==='normal'&&action.shakeMonth!==undefined){await this.shake(0,action.shakeMonth,false);if(gen!==this.gen||this.state.over)return;}
    const plan=await this.runTurn(0,action,(cands,card)=>this.askChoice(cands.map(c=>c.id),`${card.month}월: 가져올 바닥패를 선택하세요.`));
    if(!plan||gen!==this.gen)return;
    // 10) 고/스톱: 카드·피 이동과 점수 갱신이 끝난 최종 상태로 판단
    if(s.over)return;
    if(s.canDecide(0)){
      if(!s.canGo(0)){s.declareStop(0);this.voice.play('스톱');this.showResult('마지막 행동이라 고를 할 수 없어 스톱으로 정산했습니다.');return;}
      const d=await this.askGoStop();if(gen!==this.gen)return;
      if(d==='stop'){s.declareStop(0);this.voice.play('스톱');this.showResult('스톱을 선택했습니다.');return;}
      const n=s.declareGo(0);this.message=`${n}고! 기본 점수가 ${s.goBase[0]}점보다 올라야 다시 고/스톱을 선택할 수 있습니다.`;this.draw();
      // 실제 고 횟수(상태의 goCount)를 붉은 붓터치로 크게
      const c=this.tableCenter();this.voice.play('고');this.say('playerGo');
      await this.fx.banner(`${s.goCount[0]}고!`,c.x,c.y,FX.bannerGo,{style:'red',size:72});if(gen!==this.gen)return;
    }
    if(s.settleIfExhausted()){this.showResult('양쪽 행동이 모두 소진되었습니다.');return;}
    await this.runOpponentTurn();
  }
  /**
   * 컴퓨터 차례. 판단은 상대 정책(초보: beginner.ts, 전략: ai.ts)이 공개 정보(publicView)만 보고 하고, 실행은 사람과 같은 runTurn을 쓴다.
   * 더미는 뒤집기 전까지 판단에 쓰지 않는다. 고른 카드의 월이 흔들기 대상일 때만 공개 뒤 그 장을 낸다(다른 월은 흔들지 않는다).
   */
  async runOpponentTurn(){
    const gen=this.gen, s=this.state;
    if(s.over)return;
    this.phase='busy';this.turnOwner=1;this.message=`${NAMES[1]}이 패를 고르고 있습니다…`;this.draw();
    await sleep(this,this.fxSettings.ms(FX.think));if(gen!==this.gen)return;
    const aiPick:PickChoice=(cands,card)=>{const d=this.opponent.chooseFloorTarget(publicView(s,1),card,cands);aiLog(`바닥패 선택 ${card.month}월`,d.reason);return Promise.resolve(d.targetId);};
    if(s.remainingActions(1)>0){
      const a=this.opponent.chooseAction(publicView(s,1),this.aiRng,this.aiActions);
      aiLog(a.kind==='bomb'?'폭탄':a.kind==='flip'?'기회 패':'손패',a.reason);
      let plan:TurnPlan|null;
      if(a.kind==='bomb')plan=await this.runTurn(1,{kind:'bomb',month:a.month},aiPick);
      else if(a.kind==='flip')plan=await this.runTurn(1,{kind:'flip'},aiPick);
      else{
        const index=s.hands[1].findIndex(c=>c.id===a.cardId);
        if(index<0){console.error('AI가 손패에 없는 카드를 골랐습니다.',a);return;}
        const card=s.hands[1][index];
        if(s.canShake(1,card.month)){await this.shake(1,card.month,false);if(gen!==this.gen||s.over)return;}
        plan=await this.runTurn(1,{kind:'normal',index,target:a.targetId},aiPick);
      }
      if(!plan||gen!==this.gen)return;
      this.aiActions+=1;
    }else{s.turn+=1;} // 행동이 없으면 차례를 넘긴다
    if(s.over)return;
    if(s.canDecide(1)){
      if(!s.canGo(1)){s.declareStop(1);this.showResult(`${NAMES[1]}이 마지막 행동이라 스톱했습니다.`);return;}
      const d=this.opponent.decideGoStop(publicView(s,1));aiLog(d.decision==='go'?'고':'스톱',d.reason);
      if(d.decision==='stop'){s.declareStop(1);this.showResult(`${NAMES[1]}이 스톱했습니다.`);return;}
      const n=s.declareGo(1);this.message=`${NAMES[1]}: ${n}고!`;this.draw();
      const c=this.tableCenter();await this.fx.banner(`${NAMES[1]} ${s.goCount[1]}고!`,c.x,c.y,FX.bannerGo,{style:'red',size:52});if(gen!==this.gen)return;
    }
    if(s.settleIfExhausted()){this.showResult('양쪽 행동이 모두 소진되었습니다.');return;}
    if(s.remainingActions(0)===0){s.turn+=1;await this.runOpponentTurn();return;} // 내 행동이 없으면 상대가 이어서 진행
    this.phase='hand';this.turnOwner=0;this.message='내 차례입니다. 손패나 기회 패를 누르세요.';this.draw();
  }
}
/** 로컬 한글 폰트가 준비된 뒤 게임을 만든다(시스템 폰트 차이로 글자 배치가 흔들리지 않게). 폰트가 없거나 늦어도 1.5초 뒤에는 시작한다. */
/** 기기 안전 여백(노치·홈바): 보이지 않는 probe 요소의 env(safe-area-inset-top/bottom)을 읽어 디자인 단위(× 720 / innerWidth)로 바꾼다. 못 읽으면 0. */
function safeInsets():SafeInsets{
  try{
    const el=document.createElement('div');
    el.style.cssText='position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
    document.body.appendChild(el);
    const cs=getComputedStyle(el);
    const top=parseFloat(cs.paddingTop)||0, bottom=parseFloat(cs.paddingBottom)||0;
    el.remove();
    const k=DESIGN.width/Math.max(1,window.innerWidth);
    return {top:Math.round(top*k),bottom:Math.round(bottom*k)};
  }catch{return {top:0,bottom:0};}
}
/** 디자인 높이: 세로 화면이면 기기 비율에 맞춰 1280~1600(폭 720 고정), 가로 화면이면 1280. 비율이 더 긴 기기에서만 위아래 띠가 남는다. */
function designHeight(){
  const iw=window.innerWidth, ih=window.innerHeight;
  if(!(iw>0&&ih>0)||iw>ih)return BASE_HEIGHT;
  return Math.min(MAX_HEIGHT,Math.max(BASE_HEIGHT,Math.round(DESIGN.width*ih/iw)));
}
/** 처음 한 번만 배치를 계산해 게임을 만든다. 회전·창 크기 변경은 판 중간에 배치를 바꾸지 않도록 debug 로그만 남긴다(새로고침 필요). */
function startGame(){
  const insets=safeInsets();
  configureLayout(designHeight(),insets);
  console.debug(`[layout] 높이 ${DESIGN.height} · 안전 여백 위 ${insets.top} 아래 ${insets.bottom} · 화투판 ${REGIONS.table.h} · 손패 y ${REGIONS.hand.y}`);
  const ratio0=window.innerWidth/Math.max(1,window.innerHeight);
  window.addEventListener('resize',()=>{const r=window.innerWidth/Math.max(1,window.innerHeight);if(Math.abs(r-ratio0)/ratio0>=0.1)console.debug('[layout] 화면 비율이 10% 이상 바뀌었습니다. 판 중간에는 배치를 바꾸지 않습니다(새로고침하면 새 비율로 시작).');});
  new Phaser.Game({type:Phaser.AUTO,parent:'app',width:DESIGN.width,height:DESIGN.height,backgroundColor:'#141a14',scene:TableScene,audio:{noAudio:true},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH}});
}
const fontsReady=typeof document!=='undefined'&&'fonts' in document
  ?Promise.all(['16px "NanumGothic"','bold 16px "NanumGothic"','16px "NanumBrushScript"'].map(f=>document.fonts.load(f).catch(()=>[]))).then(()=>undefined)
  :Promise.resolve();
void Promise.race([fontsReady,new Promise<void>(r=>setTimeout(r,1500))]).then(startGame);
