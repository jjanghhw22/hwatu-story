import Phaser from 'phaser';
import {GameState,type GukjinChoice,type TurnEvent,type TurnPlan} from './game';
import {CARDS,type Card,kindLabel} from './cards';
import {SCENARIOS,findScenario} from './scenarios';
import type {Declared,Score} from './score';
import {type Opponent,publicView} from './ai';
import {type Rng,seededRng} from './rng';
import {type DialogEvent,DialogPolicy,EVENT_MOOD} from './dialog';
import {CHARACTERS,type Character,MOODS,type Mood,PLAYER} from './character';
import {type Chapter,ch8Choice,chapterById,chapterLabel,chapterWinVariant} from './story/chapters';
import {OPPONENTS,type OpponentProfile,resolveOpponent} from './story/opponents';
import {SKILLS,type SkillId} from './story/skills';
import {type Progress,addMoney,banPlace,bump,winsKey,canSpendFocus,formatWon,formatWonDelta,loadProgress,saveProgress,setFlag,settleStake,skillCostWithBoost,spendFocus,takeFromBag,withFocus} from './story/progress';
import {FLAGS,itemById} from './story/items';
import {provokedPolicy} from './story/policies';
import {type TauntState,afterGoStop,calm,markShown,newTauntState,pickTaunt,shouldTaunt} from './story/taunt';
import {SUSPICION,crossesWarn,isBusted,lowerSuspicion,raiseSuspicion,suspicionVisible,swapSuccessRate} from './story/suspicion';
import {type Mission,drawMission,missionCards,missionDone,missionMultiplier} from './story/mission';
import {BOKHEE_BLUFF,NEAR_MISS_LINE,SUSPICION_WARNINGS} from './story/lines';
import {markBluff,pickBluff} from './story/bluff';
import {TIMER_WARN_MS,assistAction,autoAction,autoChoice,turnLimitMs} from './story/tempo';
import {NEAR_MISS_FLAG,effectiveStake,isNearMiss,nextBigRound} from './story/bigtable';
import {completeErrand,errandById} from './story/errands';
import {CATCH_WINDOW_MS,cheatReaction,decideCheat,pickCheatCard} from './story/cheat';
import {type CaptureKind,FATHER_READ_TURN,canFold,captureStreak,fatherRead,isSkillRead,justRead,learnerPolicy,pickWatchTarget,shouldTeachFold} from './story/learner';
import {FATHER_READ,FATHER_TEACH_FOLD,TAEOH_READ} from './story/lines';
import {taeohAvailable} from './story/tempo';
import {FAKE_SHAKE_LINE,type GateNo,applyCharm,consumeBlock,fakeShake,winGate} from './story/gates';
import {type KingStage,CUT_IN_MS,KING,nextKingStage,skillCounterKey,stageCheat,stageCutIn,stageLocks,topSkills} from './story/king';
import {KING_HAND_SIGN,MUJIN_BET,MUJIN_TAUNT} from './story/lines';
import {TEACH_FOLD} from './story/learner';
import {MUJIN_APPEAR} from './story/chapters';
import type {CheatSpec} from './story/cheat';
import type {ItemId} from './story/items';
import {type TableLaunch,SCENE_KEYS,finishChapterWin,goJourney,nextBigTable,playEnding,playStory} from './scenes/flow';
import {BootScene} from './scenes/boot';
import {JourneyScene} from './scenes/journey';
import {StoryScene} from './scenes/story';
import {BUILD_TAG,CREDITS,NOT_IMPLEMENTED,RULES} from './ui/infoTexts';
import {BASE_HEIGHT,CARD,type CapturedRects,DESIGN,FLOOR_STACK_TILT,HAND_ARROW,HOLD_LIFT,MARGIN,MAX_HEIGHT,REGIONS,type Rect,type FloorLayout,type SafeInsets,LAYOUT,SKILL_BAR,TEXT_MIN,bagPopupLayout,skillRowsFor,capturedRects,configureLayout,floorLayout,handLayout,oppHandLayout,scoreBadgeRect,skillBarLayout,speechZone} from './ui/layout';
import {COLORS,type UI,box,button,label} from './ui/widgets';
import {drawCardFace,drawChanceCard} from './ui/cardView';
import {type PlayerInfoView,drawCaptured,drawPlayerInfo} from './ui/panels';
import {type PortraitView,portraitReact,preloadPortraits} from './ui/portrait';
import {drawTable} from './ui/table';
import {type ModalButton,type ModalLine,drawCapturedView,drawModal} from './ui/modals';
import {drawGallery} from './ui/gallery';
import {missingCardTextures,preloadCardAssets} from './ui/cardAssets';
import {type BannerStyle,CardFx,FX,FxSettings} from './ui/fx';
import {SlideTracker} from './ui/slide';
import {SoundFx} from './ui/sound';
import {VoiceFx} from './ui/voice';
import {type HandSlot,actionForTap,bakWarnings,bonusCards,captureKind,dealOrder,handDisplay,nearBonuses,newBonuses} from './ui/turnPlan';
const GUKJIN_ID=CARDS.find(c=>c.gukjin)!.id;
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
type Phase='dealing'|'hand'|'swap'|'catch'|'bet'|'choice'|'gukjin'|'gostop'|'busy'|'result'|'menu'|'credits'|'gallery'|'scenarios'|'capturedView'|'rules'|'devinfo';
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
  /** 모달 단계(gukjin/gostop/result/menu/credits/gallery/scenarios/capturedView/rules/devinfo)에서는 바닥·손패 입력을 받지 않는다. */
  phase:Phase='dealing';
  message='';
  /** 시작 데이터(지도·이야기 씬이 넘김): 장·상대·연습 여부·개발용 시나리오. "한 판 더"는 같은 데이터로 다시 시작한다. */
  launch:TableLaunch={};
  /** 상대 프로필(이름·초상화·정책·대사·생각 시간)과 이 대결이 속한 장. */
  profile:OpponentProfile=OPPONENTS.barber; oppChar:Character=CHARACTERS.barber; chapter?:Chapter;
  /** 집중력(이야기 진행 값, 규칙 상태가 아님): 대결 시작 때 저장된 값을 읽고 판이 끝나면 저장한다. 기술을 쓸 때만 줄어든다. */
  progress:Progress=loadProgress(); focus=0; focusMax=100;
  /** 배운 기술과 이 판에 남은 사용 횟수(배운 순서대로 기술 줄에 버튼). 안 배웠으면 버튼 자체가 없다. */
  skills:{id:SkillId;uses:number}[]=[];
  /** 캔커피 효과(다음 대결 첫 기술 비용 −10)가 살아 있는지. 첫 기술을 쓰면 꺼지고 저장한다. */
  coffeeBoost=false;
  /** 가방의 포도당 사탕 개수와 이 판 사용 여부(대결당 1회). */
  candies=0; candyUsed=false;
  /** 도발 상태(3장 마 사장). tauntNow는 지금 뜬 고/스톱 창이 도발 직후인지("(도발)" 표시). */
  taunt:TauntState=newTauntState(); tauntNow=false;
  /** 이 판의 판돈(1점당 원)과 정산된 돈 변화(결과창·지도 표시). */
  stake=0; moneyDelta=0;
  /** 의심도(0~100, 판마다 0). 게이지는 속임수 기술·투시경이 있을 때만 보인다. warned: 70 경고를 띄웠는지. */
  suspicion=0; suspicionShown=false; warned=false;
  /** 미션(플레이어만, 판 시작 추첨). missionHit: "미션!" 배너를 띄웠는지(처음 달성 순간 1회). */
  mission:Mission|null=null; missionHit=false;
  /** 장착 장비와 이 판에 쓴 장비, 투시경으로 잠깐 공개 중인 상대 카드. */
  gear:ItemId[]=[]; gearUsed=new Set<ItemId>(); xrayCard?:Card;
  /** 캔커피·동전·눈썰미 강화·숙면 안대 플래그(진행 저장에서 읽음). */
  coinBoost=false; eyePlus=false;
  /** 눈썰미로 공개한 장수(강화 시 2), 시선 돌리기(이번 턴 상대 역정보 무시, 08에서 복희가 읽는다). */
  peekCount=1; ignoreBluffThisTurn=false;
  /** 흔들기 가능 카드의 종 도형(카드 id → 도형들). draw()마다 새로 채운다. */
  bells=new Map<number,Phaser.GameObjects.GameObject[]>();
  /** 마지막 그리기의 내 정보 패널(의심도 바 흔들림·타이머 고리 위치). */
  myPanel?:PlayerInfoView;
  /** 가방 팝업(기술 줄 위로 펼쳐짐: 사탕·마스크·투시경)이 열려 있는지. */
  bagOpen=false;
  /** 시선 돌리기 뒤 다음 말풍선 하나에 "(거짓)"/"(참)"을 붙인다(복희). */
  revealBluff=false;
  /** 태오 도움(5장 동안, 판당 1회, 집중력 0). */
  taeohAvail=false; taeohUses=0;
  /** 6장 "걸릴 뻔"을 이미 보여줬는지(진행 저장 플래그). */
  nearMissShown=false;
  /** 속공 타이머(강봉구): 마감 시각·종류·고리 그래픽·갱신 이벤트·마지막으로 틱을 낸 초. */
  timerDeadline=0; timerKind?:'hand'|'choice'|'gostop'; timerGfx?:Phaser.GameObjects.Graphics; timerEvent?:Phaser.Time.TimerEvent; timerTick=-1;
  /** 남은 초 큰 숫자(손패 윗줄 위 가운데)와 고/스톱 창 제목 옆 숫자. */
  timerText?:Phaser.GameObjects.Text; timerSec?:number;
  /** 간파: 다음 상대 차례를 지켜보는 중. 상대 속임수 횟수, 진동 손목시계 경고를 썼는지, 잡기 창 대기, 잡기로 이겼는지. */
  watching=false; cheatsUsed=0; hasBuzz=false; buzzUsed=false; catchResolve?:(d:'catch'|'ignore')=>void; catchTimer?:Phaser.Time.TimerEvent;
  /** 학습형(태오): 기술별 사용 횟수, 쓴 순서(회중시계 대상), 내 차례별 먹은 분류, 저지 강화 여부. */
  skillUses:Partial<Record<SkillId,number>>={}; usedOrder:SkillId[]=[]; captureHistory:CaptureKind[][]=[]; learnerBlock=false;
  /** 아버지: 상대 차례 수(손패 읽기), 임시 접기 버튼(이 판만, 비용 0), 회중시계를 썼는지. */
  oppTurns=0; tempFold=false; foldTaught=false; watchUsed=false;
  /** 아버지: 접기를 가르친 뒤 고를 부르지 않는 남은 차례. */
  fatherHold=0;
  /** 10장 구상만: 남은 봉쇄. 서린의 부적: 장착·사용 여부. */
  blocksLeft=0; hasCharm=false; charmUsed=false;
  /** 11장 백무진: 현재 단계, 1단계 봉쇄 대상(여정에서 많이 쓴 2개), 판돈 ×2 수락, 판돈 배수, 제안 대기. */
  kingStage:KingStage=1; kingTop:SkillId[]=[]; betAccepted=false; betMult=1; betResolve?:(d:boolean)=>void;
  get names(){return [PLAYER.name,this.oppChar.name];}
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
  /** 상대 정책과 판단용 난수(덱 셔플 난수와 별개). 프로필에서 정한다(1장 장대식은 초보 정책). */
  opponent:Opponent=resolveOpponent(OPPONENTS.barber); aiRng:Rng=seededRng(1);
  /** 이 판에서 컴퓨터가 완료한 행동 수(일반 내기·폭탄·기회 패). 흔들기 공개는 세지 않는다. 새 판에서 0. */
  aiActions=0;
  dialog=new DialogPolicy(OPPONENTS.barber.lines,3);
  /** 결과창: 차례로 드러난 항목 수. 누르면 전체. */
  resultShown=0; resultTimer?:Phaser.Time.TimerEvent; restarting=false;
  /** 결과창에 보여줄 상대 반응 대사. */
  resultLine='';
  /** 큰 획득패 목록을 여는 대상 플레이어. */
  capturedViewPlayer=0;
  constructor(){super(SCENE_KEYS.table);}
  /** 시작 데이터로 상대·장·집중력을 정한다(preload 전). 시나리오 모드(개발용)는 집중력 최대·눈썰미 사용 가능으로 두고 저장하지 않는다. */
  init(data?:TableLaunch){
    this.launch=data??{};
    this.chapter=this.launch.chapterId?chapterById(this.launch.chapterId):undefined;
    this.profile=OPPONENTS[this.launch.opponentId??this.chapter?.opponentId??'barber'];
    this.oppChar=CHARACTERS[this.profile.characterId];
    this.opponent=resolveOpponent(this.profile);
    this.dialog=new DialogPolicy(this.profile.lines,3);
    this.progress=loadProgress();
    this.focusMax=this.profile.focusMax??this.progress.focusMax;
    this.focus=this.launch.scenario?this.focusMax:Math.min(this.progress.focus,this.focusMax);
    const learned:SkillId[]=this.launch.scenario?['eye','calmFace','lookAway','swap']:this.progress.skills;
    this.skills=learned.map(id=>({id,uses:SKILLS[id].usesPerMatch}));
    this.gear=this.launch.scenario?['blankMask','xrayGlasses']:[...this.progress.gear];this.gearUsed=new Set();this.xrayCard=undefined;
    this.suspicion=0;this.warned=false;this.suspicionShown=suspicionVisible(learned,this.gear);
    this.mission=null;this.missionHit=false;this.peekCount=1;this.ignoreBluffThisTurn=false;
    this.coinBoost=!this.launch.scenario&&this.progress.flags[FLAGS.coinBoost]===true;
    this.eyePlus=!this.launch.scenario&&this.progress.flags[FLAGS.eyePlus]===true;
    // 숙면 안대: 집에서 쉰 뒤 첫 대결 집중력 +30(플래그 소모, 바로 저장)
    if(!this.launch.scenario&&this.progress.flags[FLAGS.maskRested]){this.focus=Math.min(this.focusMax,this.focus+itemById('sleepMask').focus);const q=setFlag(this.progress,FLAGS.maskRested,false);saveProgress(q);this.progress=q;}
    this.coffeeBoost=!this.launch.scenario&&this.progress.flags[FLAGS.coffeeBoost]===true;
    this.candies=this.launch.scenario?1:(this.progress.bag.glucoseCandy??0);this.candyUsed=false;
    this.taunt=newTauntState();this.tauntNow=false;
    this.stake=effectiveStake(this.launch);this.moneyDelta=0;
    this.bagOpen=false;this.revealBluff=false;
    this.taeohAvail=!this.launch.scenario&&taeohAvailable(this.progress.chapterId,this.progress.flags);this.taeohUses=this.taeohAvail?1:0;
    this.watching=false;this.cheatsUsed=0;this.hasBuzz=this.gear.includes('buzzWatch');this.buzzUsed=false;this.catchResolve=undefined;this.catchTimer=undefined;
    this.skillUses={};this.usedOrder=[];this.captureHistory=[];this.learnerBlock=false;
    this.oppTurns=0;this.tempFold=false;this.foldTaught=false;this.watchUsed=false;this.timerSec=undefined;this.fatherHold=0;
    this.blocksLeft=this.profile.blocks??0;this.hasCharm=this.gear.includes('serinCharm');this.charmUsed=false;
    this.kingStage=this.launch.kingFinal?4:1;this.kingTop=topSkills(this.progress);this.betAccepted=false;this.betMult=1;this.betResolve=undefined;
    // 기술 버튼이 5개(가방 제외)를 넘으면 기술 줄 두 줄: 배운 기술 + 태오 + (아버지 판에서 아직 접기를 안 배웠으면) 임시 접기. 판 시작 전에 한 번 정한다
    const nBtns=this.skills.length+(this.taeohAvail?1:0)+(this.profile.teachesFold&&!this.skills.some(x=>x.id==='fold')?1:0);
    configureLayout(DESIGN.height,LAYOUT.insets,skillRowsFor(nBtns));
    this.nearMissShown=this.progress.flags[NEAR_MISS_FLAG]===true;
    this.timerDeadline=0;this.timerKind=undefined;this.timerEvent=undefined;this.timerTick=-1;
    // 도발형 상대는 고/스톱 정책을 래퍼로 감싼다(도발에 응하면 공격적). 규칙 함수(canDecide/canGo)는 그대로.
    if(this.profile.taunt)this.opponent=provokedPolicy(this.opponent,()=>this.taunt.provoked);
    // 학습형(태오): 내가 3턴 연속 같은 분류를 먹으면 저지 강화(공개 정보만)
    if(this.profile.learner)this.opponent=learnerPolicy(this.opponent,()=>this.learnerBlock);
    // 백무진 2단계: 판돈 ×2를 받으면 고 정책이 공격적(최대 2고)
    if(this.profile.king)this.opponent=provokedPolicy(this.opponent,()=>this.betAccepted,KING.stage2MaxGo);
  }
  preload(){preloadCardAssets(this.load);preloadPortraits(this.load,[this.oppChar,PLAYER]);}
  create(){
    this.timerGfx=this.add.graphics().setDepth(50);
    this.timerText=this.add.text(DESIGN.width/2,0,'',{fontFamily:'"NanumGothic", sans-serif',fontSize:40,fontStyle:'bold',color:COLORS.text,stroke:'#000000',strokeThickness:6}).setOrigin(0.5).setDepth(51).setVisible(false);
    this.scenarioKey=this.launch.scenario;
    const sc=this.scenarioKey?findScenario(this.scenarioKey):undefined;
    this.state=new GameState(sc?.setup);
    this.phase=sc?'hand':'dealing';this.message=sc?`[시나리오] ${sc.title}: ${sc.desc}`:'';
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
    // 무작위 판은 인트로 창 없이 바로 패 나누기 연출(이야기는 지도·이야기 씬이 맡는다). 시나리오 판은 연출 없이 바로 시작.
    if(!sc)void this.deal();
  }
  /** 상단 띠 제목: 시나리오 → 연습 → 장 제목 → 자유 대결. */
  get title(){
    if(this.scenarioKey)return `시나리오 · ${findScenario(this.scenarioKey)?.title??''}`;
    if(this.launch.practice)return `연습 대결 · ${this.oppChar.name}`;
    if(this.launch.errand)return `심부름 · ${errandById(this.launch.errand).title}`;
    if(this.launch.gate)return `초대전 ${this.launch.gate} — ${this.oppChar.name}`;
    if(this.profile.king)return this.launch.kingFinal?'왕이 없는 밤 · 추가 승부(4단계)':`왕이 없는 밤 · ${this.kingStage}단계`;
    if(this.launch.bigRound)return `큰 판 ${this.launch.bigRound}/2 · 1점 ${formatWon(this.launch.stake??0)}`;
    return this.chapter?chapterLabel(this.chapter):'자유 대결';
  }
  /** 이전 판의 트윈·배너·말풍선·예약 작업·소리·음성 예약을 모두 정리한다. 세대 번호를 올려 남은 비동기 처리가 새 판에 반영되지 않게 한다. */
  teardown(){this.stopTurnTimer();this.catchTimer?.remove(false);this.catchResolve=undefined;this.betResolve=undefined;this.gen++;this.fx.clear();this.slides.reset();this.killArrows();this.time.removeAllEvents();this.tweens.killAll();this.sfx.cancel();this.voice.cancel();this.choiceResolve=undefined;this.gukjinResolve=undefined;this.gostopResolve=undefined;this.resultTimer=undefined;this.moodTimer=undefined;}
  /** 새 판(같은 장·상대·연습 여부, 시나리오는 지정한 것으로). 결과창 버튼이 여러 번 눌려도 한 번만 동작한다. */
  restart(scenario?:string){if(this.restarting)return;this.restarting=true;const next:TableLaunch={...this.launch,scenario};this.scene.restart(next);}
  /** "한 판 더": 시작 데이터 그대로(이야기 장면 반복 없음). */
  again(){if(this.restarting)return;this.restarting=true;this.scene.restart(this.launch);}
  toJourney(){if(this.restarting)return;this.restarting=true;goJourney(this,{moneyDelta:this.moneyDelta||undefined});}
  /** 장 대결 승리 → after 장면 → 보상 → 지도. */
  continueChapter(){
    if(this.restarting||!this.chapter)return;this.restarting=true;
    // 6장 큰 판: 1판째를 이기면 짧은 컷 뒤 2판째, 2판째를 이기면 장 완료
    const nextRound=this.launch.bigRound?nextBigRound(this.launch.bigRound):null;
    if(nextRound){nextBigTable(this,this.launch,nextRound);return;}
    // 7장: 잡기로 이기면 원본/아니면 사본, 9장: 접었는지/이겼는지에 따라 after 앞 장면과 플래그가 다르다
    const r=this.state.result;
    const won=r?.outcome==='승리'&&r.winner===0, folded=r?.outcome==='승리'&&r.endKind==='fold';
    finishChapterWin(this,this.chapter,chapterWinVariant(this.chapter.id,{caught:r?.outcome==='승리'&&r.endKind==='caught',folded,untaught:this.chapter.id==='ch9'&&!this.foldTaught,lost:!won&&!folded}));
  }
  /** 10장 초대전 승리: 다음 문이 열린다. 셋째(구상만)를 이기면 백무진 등장 장면 → 지도의 선택 창. */
  finishGate(){
    if(this.restarting||!this.launch.gate)return;this.restarting=true;
    const n=this.launch.gate as GateNo;saveProgress(winGate(loadProgress(),n));
    if(n<3){goJourney(this,{notice:{title:`초대전 ${n} 통과`,lines:[`${this.oppChar.name}을 넘었다. 다음 문지기가 기다린다. 쉬었다 가도 된다.`]}});return;}
    playStory(this,'왕의 식탁',MUJIN_APPEAR,s=>goJourney(s,{kingChoice:true}));
  }
  /** 11장 승리: 본 판이면 after 장면("한 번 더.") → 마지막 선택, 추가 승부(4단계)면 엔딩 B. */
  finishKing(extra:boolean){
    if(this.restarting||!this.chapter)return;this.restarting=true;
    if(extra){playEnding(this,'B');return;}
    playStory(this,chapterLabel(this.chapter),this.chapter.scenes.after,s=>goJourney(s,{finalChoice:true}));
  }
  /** 8장 승리 뒤 선택: 받아들인다(9장부터 태오 버튼) / 자료만 받는다. */
  chooseCh8(accept:boolean){if(this.restarting||!this.chapter)return;this.restarting=true;finishChapterWin(this,this.chapter,ch8Choice(accept));}
  /** 기술 배우기 대결(박 기사 → 간파) 승리: 기술 습득 + 진동 손목시계 상점 해금 → 지도. */
  finishLesson(){
    if(this.restarting||!this.launch.lesson)return;this.restarting=true;
    const id=this.launch.lesson, q=loadProgress();
    saveProgress(setFlag({...q,skills:q.skills.includes(id)?q.skills:[...q.skills,id]},'ch7.courier'));
    goJourney(this,{notice:{title:`${SKILLS[id].name}를 배웠다`,lines:[SKILLS[id].desc,'상점에 진동 손목시계(12,000원)가 들어왔다.']}});
  }
  /** 심부름 대결 승리: 심부름 완료 → 지도(안내 한 줄). */
  finishErrand(){
    if(this.restarting||!this.launch.errand)return;this.restarting=true;
    const e=errandById(this.launch.errand);saveProgress(completeErrand(loadProgress(),e.id));
    goJourney(this,{notice:{title:`심부름 · ${e.title}`,lines:[e.after]},openPlace:undefined});
  }
  /** 판이 끝났을 때 집중력·돈(판돈 정산: 최종 점수 × 판돈, 진 쪽은 가진 만큼만)·목욕탕 승수를 저장한다(시나리오 모드는 저장하지 않음). */
  saveOutcome(){
    if(this.launch.scenario)return;
    const r=this.state.result;
    let p=withFocus(loadProgress(),this.focus);
    if(r?.outcome==='승리'&&this.stake>0){const m=addMoney(p,settleStake(this.finalPoints(r),this.stake,r.winner===0));p=m.progress;this.moneyDelta=m.applied;}
    if(r?.outcome==='승리'&&r.winner===0&&this.stake>0&&this.launch.placeId&&!this.chapter&&!this.launch.errand)p=bump(p,winsKey(this.launch.placeId)); // 장소별 일반 대결 승수(목욕탕 → 마 사장, 항구 → 봉구)
    saveProgress(p);
  }
  /** 기술 비용: 캔커피 효과가 살아 있으면 첫 기술 −10. */
  skillCost(id:SkillId){if(id==='fold'&&this.tempFold)return 0;return skillCostWithBoost(SKILLS[id].cost,this.coffeeBoost);}
  /** 학습형 상대에게 읽혀 잠긴 기술(같은 기술 두 번 뒤). */
  isRead(id:SkillId){return (!!this.profile.learner&&isSkillRead(this.skillUses,id))||this.kingLocked(id);}
  /** 백무진 단계별 봉쇄: 1단계 많이 쓴 2개, 4단계 정직 기술 전부. */
  kingLocked(id:SkillId){return !!this.profile.king&&stageLocks(this.kingStage,this.kingTop).includes(id);}
  /** 지금 상대의 속임수 설정(백무진은 단계별). */
  get cheatSpec():CheatSpec|undefined{return this.profile.king?stageCheat(this.kingStage):this.profile.cheat;}
  canUseSkill(sk:{id:SkillId;uses:number}){
    if(this.phase!=='hand'||sk.uses<=0||!canSpendFocus(this.focus,this.skillCost(sk.id))||this.isRead(sk.id))return false;
    if(sk.id==='readThrough')return !this.watching;
    if(sk.id==='fold')return canFold(this.state);
    if(sk.id==='eye')return this.state.deck.length>0;
    if(sk.id==='calmFace')return !this.taunt.calmed||this.suspicion>0;
    if(sk.id==='lookAway')return !this.ignoreBluffThisTurn;
    if(sk.id==='swap')return this.state.deck.length>0&&this.state.hands[0].length>0;
    return false; // 간파·접기는 08
  }
  /** 기술 사용(규칙 상태는 바꾸지 않는다). 눈썰미: 더미 윗장 1장 공개(판당 2회, 예전 "다음 패 보기"와 같은 동작). 태연한 얼굴: 이번 판 남은 도발 차단(판당 1회). */
  useSkill(id:SkillId){
    const sk=this.skills.find(x=>x.id===id), s=this.state;
    if(!sk||!this.canUseSkill(sk))return;
    // 바꿔치기는 패를 고른 뒤(doSwap) 비용을 치른다(취소하면 무료)
    if(id==='swap'){this.phase='swap';this.message='바꿀 패를 고르세요 (취소: 바꿔치기 버튼)';this.draw();return;}
    this.focus=spendFocus(this.focus,this.skillCost(id));sk.uses-=1;this.consumeCoffee();this.noteSkillUse(id);
    if(this.blockSkill(id))return;
    if(id==='fold'){this.stopTurnTimer();this.state.forfeit(0,{kind:'fold'});this.showResult('불리한 판을 접었습니다.');return;}
    if(id==='readThrough'){this.watching=true;this.message=`${SKILLS.readThrough.name}: 다음 상대 차례를 지켜본다.`;}
    if(id==='eye'){
      this.peek=true;this.peekCount=this.eyePlus?2:1;
      const shown=s.deck.slice(0,this.peekCount).map(n=>`${n.month}월 ${n.name} ${n.title}(${kindLabel(n)})`);
      this.message=`${SKILLS.eye.name}${this.eyePlus?' 강화':''}: 다음 더미 패는 ${shown.join(', ')}`;
    }
    if(id==='calmFace'){this.taunt=calm(this.taunt);this.lowerSusp(SUSPICION.calmFace);this.message=`${SKILLS.calmFace.name}: 이번 판 도발에 흔들리지 않는다.${this.suspicionShown?` 의심도 ${this.suspicion}.`:''}`;}
    if(id==='lookAway'){
      // 이번 턴 상대 역정보 무시(08의 복희가 읽는 플래그) + 상대 손패의 월 집합 중 무작위 3개 힌트(장수는 알려주지 않음)
      this.ignoreBluffThisTurn=true;this.revealBluff=true; // 이 판의 다음 상대 말풍선 하나에 (거짓)/(참)
      const months=Array.from(new Set(s.hands[1].map(c=>c.month))).sort((a,b)=>a-b);
      const pick:number[]=[];const pool=[...months];while(pick.length<3&&pool.length)pick.push(pool.splice(pickIndexSafe(this.aiRng,pool.length),1)[0]);
      pick.sort((a,b)=>a-b);
      this.message=pick.length?`${SKILLS.lookAway.name}: 상대 손패에 ${pick.join('·')}월이 있다. 이번 턴 상대 말은 믿지 않는다.`:`${SKILLS.lookAway.name}: 상대 손패가 비었다.`;
    }
    this.draw();
  }
  /** 가방: 포도당 사탕(대결 중 집중력 +25, 대결당 1회). 가방에서 바로 빼서 저장한다. */
  useCandy(){
    if(this.phase!=='hand'||this.candyUsed||this.candies<=0)return;
    this.candies-=1;this.candyUsed=true;
    const before=this.focus;this.focus=Math.min(this.focusMax,this.focus+itemById('glucoseCandy').focus);
    if(!this.launch.scenario){const p=takeFromBag(loadProgress(),'glucoseCandy');if(p)saveProgress(p);}
    this.message=`포도당 사탕: 집중력 ${before} → ${this.focus}`;this.bagOpen=false;this.draw();
  }
  /** 기술 사용 기록(학습형 잠김·회중시계). 태오에게 두 번째로 쓴 순간 "그거 또 쓸 줄 알았어." */
  noteSkillUse(id:SkillId){
    this.skillUses={...this.skillUses,[id]:(this.skillUses[id]??0)+1};this.usedOrder.push(id);
    // 여정 전체 기술 사용 기록(11장 1단계 봉쇄 대상)
    if(!this.launch.scenario){const q=loadProgress();saveProgress({...q,counters:{...q.counters,[skillCounterKey(id)]:(q.counters[skillCounterKey(id)]??0)+1}});}
    if(this.profile.learner&&justRead(this.skillUses,id)){this.setMood('happy');this.fx.speech(TAEOH_READ,speechZone());}
  }
  /** 기술 줄 버튼 순서(그리기와 같다): 임시 접기 → 태오 → 배운 순서. */
  buttonKeys():string[]{
    const keys:string[]=this.skills.map(x=>x.id);
    if(this.taeohAvail)keys.unshift('taeoh');
    const fi=keys.indexOf('fold');if(this.tempFold&&fi>0)keys.unshift(...keys.splice(fi,1));
    return keys;
  }
  /** 구상만 봉쇄: 남은 봉쇄가 있으면 이번 기술은 무효(집중력은 이미 소모). 막힌 기술 버튼에 X 300ms. */
  blockSkill(id:SkillId):boolean{
    const b=consumeBlock(this.blocksLeft);if(!b.blocked)return false;
    this.blocksLeft=b.left;this.message=`${this.names[1]}이 막았다 (남은 봉쇄 ${this.blocksLeft})`;this.setMood('happy');this.draw();
    const keys=this.buttonKeys(), r=skillBarLayout(REGIONS.skillBar,keys.length).buttons[keys.indexOf(id)];
    if(r){const x=this.add.text(r.x+r.w/2,r.y+r.h/2,'✕',{fontFamily:'sans-serif',fontSize:40,color:'#e03a3a',fontStyle:'bold',stroke:'#000000',strokeThickness:4}).setOrigin(0.5).setDepth(60);this.time.delayedCall(300,()=>x.destroy());}
    return true;
  }
  /** 낡은 회중시계(대결당 1회): 이번 판에 쓴 정직 기술 하나(가장 최근)의 남은 횟수 +1. 속임수·희귀 기술 제외. */
  useWatch(){
    if(this.phase!=='hand'||this.watchUsed||!this.gear.includes('pocketWatch'))return;
    const id=pickWatchTarget(this.usedOrder,this.skills);if(!id)return;
    const sk=this.skills.find(x=>x.id===id)!;sk.uses+=1;this.watchUsed=true;this.bagOpen=false;
    this.message=`낡은 회중시계: ${SKILLS[id].name}를 한 번 더 쓸 수 있다.`;this.draw();
  }
  /** 가방 팝업 항목: 포도당 사탕(가방에 있으면), 장착한 무표정 마스크·투시경. 쓴 것은 비활성. */
  bagItems():{name:string;on:boolean;onTap:()=>void}[]{
    const out:{name:string;on:boolean;onTap:()=>void}[]=[];
    const hand=this.phase==='hand';
    if(this.candies>0||this.candyUsed)out.push({name:this.candyUsed?'사탕 · 씀':`사탕 ${this.candies}`,on:hand&&!this.candyUsed&&this.candies>0,onTap:()=>this.useCandy()});
    if(this.gear.includes('blankMask')){const used=this.gearUsed.has('blankMask');out.push({name:used?'마스크 · 씀':'마스크',on:hand&&!used&&this.suspicion>0,onTap:()=>this.useMask()});}
    if(this.gear.includes('pocketWatch'))out.push({name:this.watchUsed?'회중시계 · 씀':'회중시계',on:hand&&!this.watchUsed&&pickWatchTarget(this.usedOrder,this.skills)!==null,onTap:()=>this.useWatch()});
    if(this.gear.includes('xrayGlasses')){const used=this.gearUsed.has('xrayGlasses');out.push({name:used?'투시경 · 씀':'투시경',on:hand&&!used&&this.state.hands[1].length>0,onTap:()=>this.useXray()});}
    return out;
  }
  toggleBag(){if(this.phase!=='hand')return;this.bagOpen=!this.bagOpen;this.draw();}
  /**
   * 태오 도움(5장, 판당 1회, 집중력 0): 이번 내 차례 행동을 전략 정책이 대신 고른다(공개 정보만, story/tempo.assistAction).
   * 고른 손패를 400ms 강조한 뒤 사람과 같은 runPlayerTurn으로 실행한다.
   */
  async useTaeoh(){
    if(this.phase!=='hand'||this.taeohUses<=0)return;
    const gen=this.gen, s=this.state;
    const a=assistAction(s,this.aiRng);if(!a)return;
    this.taeohUses-=1;this.phase='busy';this.bagOpen=false;this.message='태오: “이건 내가 칠게.”';this.draw();
    const cards=a.kind==='normal'?[s.hands[0][a.index]]:a.kind==='bomb'?s.hands[0].filter(c=>c.month===a.month):[];
    if(cards.length)await this.fx.highlight(this.handRects(0,cards),400,0x8eb4e3);
    if(gen!==this.gen)return;
    this.phase='hand';void this.runPlayerTurn(a);
  }
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
    label(ui,MARGIN,top.h/2,this.title,TEXT_MIN,COLORS.goldDim,560,[0,0.5],true);
    if(this.missingTextures.length)label(ui,DESIGN.width/2,top.h/2,`카드 그림 누락 ${this.missingTextures.length}장`,12,COLORS.danger,300,[0.5,0.5]);
    button(ui,DESIGN.width-MARGIN-90,4,90,'메뉴',()=>this.openMenu(),this.phase==='hand',32,TEXT_MIN);
    // 2~3. 상대: 큰 초상화·이름·점수·대사 자리·손패 뒷면(내용은 공개하지 않음), 획득 패
    const stable=this.phase==='hand';
    const opp=drawPlayerInfo(ui,REGIONS.oppInfo,{character:this.oppChar,mood:this.mood,score:theirs,goCount:s.goCount[1],gukjin:s.gukjinUse(1),handCount:s.hands[1].length,flipChances:s.flipChances[1],active:this.phase==='busy'&&this.turnOwner===1,activeText:'상대 차례',ppeokCount:this.ppeokCount(1),declared:s.declaredMonths(1),big:true,first:false,handVisible:s.hands[1].map(c=>!this.hidden.has(c.id)),money:this.oppMoney(),extraChips:this.profile.blocks?[{text:`봉쇄 ${this.blocksLeft}`,color:this.blocksLeft>0?0x6b7f8f:0x3a3a36}]:undefined});
    this.scoreTexts[1]=opp.scoreText;this.oppPortrait=opp.portrait;
    this.lastCaptured[1]=drawCaptured(ui,REGIONS.oppCaptured,theirs,{hidden:this.hidden,warnings:bakWarnings(s,1),onTap:stable?()=>this.openCapturedView(1):undefined,place});
    // 4. 화투판(가운데 더미는 뒷면, 뻑 묶음 표시)
    // 분배 연출 중에는 아직 도착하지 않은 카드(hidden에 남은 분배 카드)를 더해 48 → 20으로 줄어드는 장수를 보여준다(상태는 그대로)
    const deckShown=s.deck.length+(this.phase==='dealing'?this.hidden.size:0);
    const haveIds=new Set(s.captured[0].map(c=>c.id));
    const missionView=this.mission?{cards:missionCards(this.mission),have:haveIds,done:missionDone(this.mission,haveIds),multiplier:this.mission.def.multiplier}:undefined;
    this.lastFloor=drawTable(ui,{table:s.table,deckCount:deckShown,message:this.message,selectable:this.phase==='choice'?this.selectable:[],onPick:id=>this.pick(id),prevSlots:this.floorSlots,hidden:this.hidden,ppeok:s.ppeok,mission:missionView});
    // 투시경: 상대 손패 한 장을 잠깐 공개(상대 패널 오른쪽 구역 위, 말풍선 자리에 겹쳐 3초)
    if(this.xrayCard){const z=speechZone();drawCardFace(ui,{x:z.x,y:REGIONS.oppInfo.y+4,w:CARD.peek.w,h:CARD.peek.h},this.xrayCard);label(ui,z.x+CARD.peek.w+6,REGIONS.oppInfo.y+4+CARD.peek.h/2,'투시경',TEXT_MIN,COLORS.gold,90,[0,0.5],true);}
    this.floorSlots=this.lastFloor.slots;
    // 5~6. 내 정보(집중력 바, 기술 버튼 포함)와 획득 패(족보 완성 직전 힌트는 내 손패·획득패·공개 바닥패만으로 판단)
    const my=REGIONS.myInfo;
    this.myPanel=drawPlayerInfo(ui,my,{character:PLAYER,mood:'normal',score:mine,goCount:s.goCount[0],gukjin:s.gukjinUse(0),flipChances:s.flipChances[0],active:this.myTurn,activeText:this.phase==='choice'?'바닥패 선택':this.phase==='swap'?'바꿀 패 선택':'내 차례',ppeokCount:this.ppeokCount(0),declared:s.declaredMonths(0),big:false,first:true,focus:{cur:this.focus,max:this.focusMax},suspicion:this.suspicionShown?this.suspicion:undefined});
    this.scoreTexts[0]=this.myPanel.scoreText;
    // 기술 줄(내 정보 아래): 배운 기술마다 버튼(비용·남은 횟수. 집중력·횟수가 모자라면 비활성), 공개한 더미 패는 그 오른쪽에 내 차례 동안, 가방(사탕) 버튼은 오른쪽 끝.
    // 기술 줄(높이 52): 배운 기술(+ 5장 태오) 버튼 최대 5개, 이름 18, 오른쪽 위 작은 배지에 비용·남은 횟수(14). 맨 오른쪽 가방 버튼 → 팝업(사탕·마스크·투시경)
    type Btn={key:string;name:string;badge:string;on:boolean;onTap:()=>void;fill?:number};
    const btns:Btn[]=this.skills.map(sk=>{
      const def=SKILLS[sk.id], cost=this.skillCost(sk.id);
      if(sk.id==='swap'&&this.phase==='swap')return {key:sk.id,name:'취소',badge:'',on:true,onTap:()=>this.cancelSwap(),fill:0xe0875a};
      if(this.isRead(sk.id))return {key:sk.id,name:def.short,badge:this.kingLocked(sk.id)?'왕이 봤다':'읽혔다',on:false,onTap:()=>undefined};
      return {key:sk.id,name:def.short,badge:sk.uses>0?`${cost}${this.coffeeBoost?'*':''}·${sk.uses}`:'다 씀',on:this.canUseSkill(sk),onTap:()=>this.useSkill(sk.id),fill:sk.id==='fold'&&this.tempFold?0xffe08a:undefined};
    });
    if(this.taeohAvail)btns.unshift({key:'taeoh',name:'태오',badge:this.taeohUses>0?'0·1':'다 씀',on:this.phase==='hand'&&this.taeohUses>0,onTap:()=>{void this.useTaeoh();},fill:0x8eb4e3});
    // 임시 접기는 윗줄 맨 앞(눈에 띄게)
    const fi=btns.findIndex(b=>b.key==='fold');if(this.tempFold&&fi>0)btns.unshift(...btns.splice(fi,1));
    const sbL=skillBarLayout(REGIONS.skillBar,btns.length);
    btns.slice(0,sbL.buttons.length).forEach((b,i)=>{
      const r=sbL.buttons[i];
      button(ui,r.x,r.y,r.w,b.name,b.onTap,b.on,r.h,SKILL_BAR.textSize,b.fill);
      if(b.badge){const bw=Math.max(30,b.badge.length*9+10);box(ui,r.x+r.w-bw-2,r.y-6,bw,18,0x111111,0.92,COLORS.brassDim);label(ui,r.x+r.w-bw/2-2,r.y+3,b.badge,SKILL_BAR.badgeSize,b.on?COLORS.gold:'#8d8577',bw,[0.5,0.5],true);}
    });
    const next=s.deck[0];
    if(this.peek&&next){drawCardFace(ui,sbL.preview,next);if(this.peekCount>=2&&s.deck[1])drawCardFace(ui,sbL.preview2,s.deck[1]);}
    const bagItems=this.bagItems();
    button(ui,sbL.bag.x,sbL.bag.y,sbL.bag.w,this.bagOpen?'닫기':'가방',()=>this.toggleBag(),this.phase==='hand'&&(bagItems.length>0||this.bagOpen),sbL.bag.h,SKILL_BAR.textSize);
    if(bagItems.length){const n=bagItems.filter(b=>b.on).length;if(n){const cx=sbL.bag.x+sbL.bag.w-6,cy=sbL.bag.y+2;ui.layer.add(this.add.circle(cx,cy,11,0xc0392b));label(ui,cx,cy,String(n),14,'#ffffff',22,[0.5,0.5],true);}}

    this.lastCaptured[0]=drawCaptured(ui,REGIONS.myCaptured,mine,{hidden:this.hidden,near:nearBonuses(s.captured[0],s.hands[0],s.table),warnings:bakWarnings(s,0),onTap:stable?()=>this.openCapturedView(0):undefined,place});
    // 7. (안내 줄 없음: 조작 안내는 메뉴 > 규칙 안내. 그 자리는 손패 윗줄 위 여백으로 써 화살표가 패널과 겹치지 않는다)
    // 8. 내 손패: 월순 정렬 + 기회 패(남은 뒤집기 기회만큼), 아랫줄 주 줄 6장 + 윗줄. 먹을 수 있는 패(state.matches)에는 파란 화살표(hand 단계만, 폭탄·흔들기 배지와 함께).
    //    사용한 패의 빈자리는 남은 패가 짧게 미끄러져 메운다. 기회 패는 손패 끝에 차례로 나타난다. 배지·화살표는 'dealing' 중에는 그리지 않는다.
    const slots=this.displaySlots();
    const lay=handLayout(slots.length);
    this.bells=new Map();
    const inHand=this.phase==='hand';
    const bombMonths=inHand?s.bombCandidates(0):[], shakeMonths=inHand?s.shakeCandidates(0):[];
    const dim=this.phase!=='hand'&&this.phase!=='busy'&&this.phase!=='dealing';
    const arrows:{cx:number;tipY:number}[]=[]; // 화살표는 카드를 모두 그린 뒤 따로 그려 윗줄 카드에 가려지지 않게 한다
    slots.forEach((slot,i)=>{
      const mo=slot.kind==='card'?slot.card.month:-1;
      if(slot.kind==='card'){
        if(this.hidden.has(slot.card.id))return;
        const card=slot.card, r=lay[i], canTake=inHand&&s.matches(card).length>0;
        // 폭탄 가능: 주황 배지. 흔들기 가능: 금색 테두리 + 오른쪽 위 종 모양(누르면 흔들림 + 종소리 뒤 세 장 공개)
        const mark=bombMonths.includes(mo)?{badge:'폭탄',badgeColor:0xf0923a}:shakeMonths.includes(mo)?{bell:(parts:Phaser.GameObjects.GameObject[])=>this.bells.set(card.id,parts)}:{};
        const onTap=inHand?()=>this.play(slot.index):this.phase==='swap'?()=>{void this.doSwap(card.id);}:undefined;
        this.slides.place(ui,`hand:${card.id}`,r,u=>{
          box(u,r.x+3,r.y+4,r.w,r.h,0x000000,0.3);
          drawCardFace(u,r,card,{dim:dim&&this.phase!=='swap',...mark,onTap});
        });
        if(canTake)arrows.push({cx:r.x+r.w/2,tipY:r.y-HAND_ARROW.above});
      }
      else this.slides.place(ui,'chance:0',lay[i],u=>drawChanceCard(u,lay[i],{dim,count:s.flipChances[0],onTap:inHand?()=>this.flipOnly():undefined}),'fade',0);
    });
    for(const a of arrows)this.drawArrow(ui,a.cx,a.tipY);
    // 가방 팝업(모달 아님): 기술 줄 바로 위로 펼쳐진다. 항목을 쓰거나 가방 버튼을 다시 누르면 닫힌다
    if(this.bagOpen&&this.phase==='hand'){
      const items=this.bagItems(), pop=bagPopupLayout(REGIONS.skillBar,items.length);
      box(ui,pop.panel.x,pop.panel.y,pop.panel.w,pop.panel.h,0x101410,0.95,COLORS.brass,2);
      if(!items.length)label(ui,pop.panel.x+pop.panel.w/2,pop.panel.y+pop.panel.h/2,'비었음',TEXT_MIN,COLORS.muted,pop.panel.w,[0.5,0.5]);
      items.forEach((it,i)=>{const r=pop.items[i];button(ui,r.x,r.y,r.w,it.name,it.onTap,it.on,r.h,TEXT_MIN);});
    }
    this.drawModals(mine.total,theirs.total);
  }
  drawModals(myBase:number,theirBase:number){
    const ui=this.ui, s=this.state;
    if(this.phase==='bet'){
      drawModal(ui,{title:MUJIN_BET,titleColor:COLORS.gold,edgeColor:0xb08d4a,alpha:.7,lines:[{text:'받으면 이 판 최종 점수가 두 배(누가 이기든). 백무진은 더 공격적으로 고를 부른다.',size:TEXT_MIN,color:COLORS.text},{text:'거절하면 도발 한 번. 태연한 얼굴로 막을 수 있다.',size:TEXT_MIN}],buttons:[
        {text:'받는다 (×2)',onTap:()=>this.decideBet(true),fill:0xe0875a},
        {text:'거절한다',onTap:()=>this.decideBet(false)},
      ]});
    }
    if(this.phase==='catch'){
      drawModal(ui,{title:'속임수다!',titleColor:'#e03a3a',edgeColor:0xc0392b,alpha:.6,lines:[{text:`${this.names[1]}의 손이 더미 윗장으로 간다. 지금 잡을까?`,size:20,color:COLORS.text},{text:'2.5초 안에 고르지 않으면 모른 척한다.',size:TEXT_MIN}],buttons:[
        {text:'잡는다',onTap:()=>this.decideCatch('catch'),fill:0xe03a3a},
        {text:'모른 척한다',onTap:()=>this.decideCatch('ignore')},
      ]});
    }
    if(this.phase==='gukjin'){
      const p=s.previewGukjin(0);
      drawModal(ui,{title:'9월 국진을 어떻게 사용할까요?',card:GUKJIN_ID,lines:[{text:'한 번 정하면 이 판에서는 바꿀 수 없습니다. 열끗과 피 중 한쪽에만 계산됩니다.'}],buttons:[
        {text:`열끗으로 사용  ·  예상 합계 ${p.열끗}점`,onTap:()=>this.decideGukjin('열끗'),fill:0xe8c84a},
        {text:`쌍피로 사용  ·  예상 합계 ${p.피}점`,onTap:()=>this.decideGukjin('피'),fill:0xe0875a},
      ]});
    }
    if(this.phase==='gostop'){
      const base=s.baseScore(0), n=s.goCount[0], pv=s.previewSettlement(0);
      const mult=[...(pv.baks.length?[`${pv.baks.join('·')} ${pv.multiplier}배`]:[]),...(pv.declared.length?[`선언(${declText(pv.declared)}) ${pv.declMultiplier}배`]:[])];
      const bak=mult.length?`  ×  ${mult.join(' × ')}  =  ${pv.final}점`:'';
      drawModal(ui,{title:'고 또는 스톱?',titleRight:this.timerKind==='gostop'&&this.timerSec!==undefined?{text:`${this.timerSec}초`,color:this.timerSec<=3?'#e03a3a':COLORS.text,size:24}:undefined,lines:[
        ...(this.tauntNow&&!this.taunt.calmed?[{text:'(도발)',size:13,color:COLORS.orange,bold:true}]:[]),
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
      const lines=this.resultLines(r);
      const shown=lines.slice(0,this.resultShown);
      const title=r.outcome!=='승리'?'나가리':r.endKind==='fold'?'접음':r.endKind==='caught'?'잡았다!':r.forfeit?'들통':r.winner===0?'승리':'패배';
      drawModal(ui,{title,titleColor:r.outcome==='승리'?(r.winner===0?COLORS.gold:COLORS.danger):COLORS.muted,alpha:.82,onTap:()=>this.revealResult(),minBodyH:lines.length*36+70,lines:[
        ...shown,
        ...(this.resultShown>=lines.length?[{text:`기본 점수  나 ${myBase}점  /  ${this.names[1]} ${theirBase}점  ·  ${this.message}`,size:14}]:[]),
      ],buttons:this.resultButtons(r.outcome==='승리'&&r.winner===0)});
    }
    if(this.phase==='menu'){
      const on=this.sfx.enabled, reduced=this.fxSettings.reduced;
      drawModal(ui,{title:'메뉴',lines:[{text:`소리: ${on?'켜짐':'꺼짐'}${on&&!this.sfx.ready?' (첫 터치 뒤 활성화)':''}  ·  연출 줄이기: ${reduced?'켜짐':'꺼짐'}`}],buttons:[
        {text:'새 판 시작',onTap:()=>this.restart()},
        {text:'지도로 (이 판 포기)',onTap:()=>this.toJourney()},
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
        {text:`빌드 ${BUILD_TAG}  ·  상대 ${this.profile.id}(${this.opponent.key})  ·  이번 판 상대 행동 ${this.aiActions}회  ·  ${this.launch.practice?'연습':this.chapter?this.chapter.id:'자유'}  ·  집중력 ${this.focus}/${this.focusMax}`,size:14,color:COLORS.text},
        {text:`미구현: ${NOT_IMPLEMENTED}. 표정 그림·음성 파일 없음(자리 표시·연결 지점만). AI 판단 이유는 콘솔 debug 로그.`,size:13},
        {text:`의심도 ${this.suspicion}(배율 ${this.profile.sharpness}, 게이지 ${this.suspicionShown?'표시':'숨김'})  ·  미션 ${this.mission?`${this.mission.def.name} ×${this.mission.def.multiplier} [${this.mission.cardIds.join(',')}]`:'없음'}  ·  장비 ${this.gear.join(',')||'없음'}  ·  판돈 ${formatWon(this.stake)}`,size:12},
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
      drawCapturedView(ui,`${this.names[p]}의 획득 패 · 기본 ${sc.total}점`,[
        {kind:'광',cards:sc.광.cards,note:note(sc.광)},{kind:'열끗',cards:sc.열끗.cards,note:note(sc.열끗)},{kind:'띠',cards:sc.띠.cards,note:note(sc.띠)},
        {kind:'피',cards:sc.피.cards,note:`${sc.피.cards.length}장 · 가치 ${sc.피.value} · ${sc.피.points}점`},
      ],()=>this.switchModal('capturedView','hand'));
    }
  }
  /** 결과창 줄: 승패 → 상대 반응 → 기본 → 고 → 박 → 선언 배수 → (미션 ×N) → 최종(미션 반영) → (판돈 정산). 확정 결과 객체만 읽고, 미션 배수는 story 계층이 곱한다. */
  resultLines(r:NonNullable<GameState['result']>):ModalLine[]{
    if(r.outcome!=='승리')return [{text:`“${this.resultLine}”`,size:17,color:COLORS.gold},{text:'나가리. 양쪽 행동이 모두 소진될 때까지 아무도 스톱하지 않았습니다. 승자 없음, 박·정산 없음, 다음 판 이월 없음(미션 무효).',size:17,color:COLORS.text}];
    const mult=this.missionMult();
    return [{text:`“${this.resultLine}”`,size:17,color:COLORS.gold},
      {text:r.endKind==='fold'?`접음: ${this.names[1]} 기본 점수 ${r.base}점 그대로(고·박·배수 없음)`:r.endKind==='caught'?`잡았다: ${this.names[1]}의 속임수를 잡아 판 몰수. 기준 점수 ${r.base}점(최소 7)`:r.forfeit?`들통: 내 손이 잡혀 즉시 패배. 승자 기본 점수 ${r.base}점(최소 7, 박·선언 배수 없음)`:`기본 점수 ${r.base}점`,size:19,color:COLORS.text},
      {text:r.goCount===0?'고 없음':r.goCount<=2?`${r.goCount}고  +${r.goCount}점 → ${r.settled}점`:`${r.goCount}고 → ${r.settled}점`,size:19,color:COLORS.text},
      {text:r.baks.length?`박: ${r.baks.map(b=>`${b} ×2`).join(' · ')}`:'박 없음',size:19,color:r.baks.length?COLORS.danger:COLORS.muted},
      {text:r.declared.length?`선언 배수: ${declText(r.declared)} ×${r.declMultiplier}`:'선언 배수 없음',size:19,color:r.declared.length?COLORS.danger:COLORS.muted},
      ...(mult>1?[{text:`미션 ×${mult}`,size:19,color:COLORS.gold,bold:true}]:[]),
      ...(this.betMult>1?[{text:`판돈 ×${this.betMult}(백무진 제안 수락)`,size:19,color:COLORS.danger,bold:true}]:[]),
      {text:`최종 ${this.finalPoints(r)}점`,size:34,color:COLORS.gold,bold:true},
      ...(this.moneyDelta!==0?[{text:`판돈 정산 ${formatWonDelta(this.moneyDelta)}`,size:18,color:this.moneyDelta>0?COLORS.gold:COLORS.danger,bold:true}]:[])];
  }
  /** 미션 배수: 내가 이겼고 미션 카드를 전부 가졌을 때만(나가리 무효). */
  missionMult(){const r=this.state.result;if(!r||r.outcome!=='승리'||r.winner!==0)return 1;return missionMultiplier(this.mission,this.mission?missionDone(this.mission,new Set(this.state.captured[0].map(c=>c.id))):false,'승리');}
  /** 최종 점수(미션 반영). 돈도 이 점수로 정산한다. */
  finalPoints(r:NonNullable<GameState['result']>){return r.outcome==='승리'?r.final*this.missionMult()*this.betMult:0;}
  /** 상대 소지금(표시용): 프로필 값, 일반 상대는 내 소지금의 1.5배. 0이면 표시하지 않는다. */
  oppMoney():number|undefined{const m=this.profile.money??(this.profile.id==='stranger'?Math.round(this.progress.money*1.5):undefined);return m&&m>0?m:undefined;}
  /** 결과창 버튼: 시나리오 [새 판 시작/지도로], 연습 [한 판 더/지도로], 장 대결은 승리 [계속] · 패배·나가리 [한 판 더/지도로](1장은 패배 비용 없음). */
  resultButtons(won:boolean):ModalButton[]{
    if(this.launch.scenario)return [{text:'새 판 시작',onTap:()=>this.restart(this.launch.scenario)},{text:'지도로',onTap:()=>this.toJourney()}];
    if(this.launch.errand&&won)return [{text:'계속',onTap:()=>this.finishErrand()}];
    if(this.launch.lesson&&won)return [{text:'계속',onTap:()=>this.finishLesson()}];
    const r=this.state.result, folded=r?.outcome==='승리'&&r.endKind==='fold';
    if(this.chapter?.id==='ch8'&&!this.launch.practice&&won)return [{text:'받아들인다',onTap:()=>this.chooseCh8(true)},{text:'자료만 받는다',onTap:()=>this.chooseCh8(false)}];
    // 9장은 접어도 완료(접기를 배우는 판)
    // 9장: 접어도 이겨도 완료. 판에서 가르칠 순간이 한 번도 안 왔으면 져도 완료(after 앞에서 가르친다)
    if(this.chapter?.id==='ch9'&&!this.launch.practice&&(won||folded||!this.foldTaught))return [{text:'계속',onTap:()=>this.continueChapter()}];
    if(this.launch.gate&&won)return [{text:'계속',onTap:()=>this.finishGate()}];
    if(this.profile.king&&this.launch.kingFinal&&won)return [{text:'계속',onTap:()=>this.finishKing(true)}];
    if(this.profile.king&&won)return [{text:'계속',onTap:()=>this.finishKing(false)}];
    if(this.chapter&&!this.launch.practice&&won)return [{text:'계속',onTap:()=>this.continueChapter()}];
    return [{text:'한 판 더',onTap:()=>this.again()},{text:'지도로',onTap:()=>this.toJourney()}];
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
    this.rollMission();
    this.phase='hand';this.turnOwner=0;this.message='내 차례입니다. 손패를 누르세요.';this.draw();
    this.startTurnTimer('hand');
  }
  /** 손패 표시 슬롯: 월순 카드 + 기회 패는 한 장(남은 횟수는 숫자 배지). handDisplay(순수 함수)는 그대로 두고 화면에서만 합친다. */
  displaySlots():HandSlot[]{return handDisplay(this.state,0).filter(sl=>sl.kind==='card'||sl.n===0);}
  /**
   * 미션 추첨(분배 직후, 'hand' 진입 전): 내 손패에 없는 카드 중에서, 장 번호에 따라 허용된 유형으로. 연습·시나리오·이야기 판(대식·아버지)에는 없다.
   * 시드는 판 ID와 시각으로 만들어 판마다 다르다(미션은 AI가 모르는 플레이어만의 목표).
   */
  rollMission(){
    if(this.launch.scenario||this.launch.practice||this.launch.kingFinal||this.profile.id==='barber'||this.profile.id==='father'){this.mission=null;return;}
    const no=this.chapter?.no??chapterById(this.progress.chapterId).no;
    this.mission=drawMission(seededRng(((this.state.roundId*7919)^Date.now())>>>0),new Set(this.state.hands[0].map(c=>c.id)),Math.max(1,no));
    this.missionHit=false;
  }
  /** 미션 달성 순간(내 획득패에 전부 들어온 처음) 금색 "미션!" 배너. 패널은 draw()가 상태로 그린다. */
  async checkMission(){
    if(!this.mission||this.missionHit)return;
    if(!missionDone(this.mission,new Set(this.state.captured[0].map(c=>c.id))))return;
    this.missionHit=true;this.draw();
    const c=this.tableCenter();this.sfx.play('combo');
    await this.fx.banner('미션!',c.x,c.y,FX.bannerCombo,{style:'gold',size:56});
  }
  // ---- 의심도 ----
  /**
   * 속임수로 의심도가 오른다: 기본값 × 상대 sharpness. 바가 흔들리고 상대 초상화가 놀라며, 70을 처음 넘으면 경고 말풍선 1회.
   * 100이면 들통 → 즉시 패배(bust). true를 돌려주면 판이 끝났다.
   */
  async applySuspicion(base:number):Promise<boolean>{
    if(!this.suspicionShown||this.profile.sharpness<=0)return false;
    const gen=this.gen, before=this.suspicion;
    this.suspicion=raiseSuspicion(before,base,this.profile.sharpness);
    this.draw();
    const bar=this.myPanel?.suspicionBar;
    if(bar&&!this.fxSettings.reduced)this.tweens.add({targets:bar,x:bar.x+3,duration:Math.round(FX.suspicionShake/4),yoyo:true,repeat:3});
    this.setMood('surprised');
    if(isNearMiss(this.chapter?.id==='ch6',before,this.suspicion,this.nearMissShown))this.nearMiss();
    else if(crossesWarn(before,this.suspicion)&&!this.warned){this.warned=true;const lines=SUSPICION_WARNINGS[this.profile.id]??SUSPICION_WARNINGS.DEFAULT;this.fx.speech(lines[pickIndexSafe(this.aiRng,lines.length)],speechZone());}
    // 서린의 부적(판당 1회): 100에 닿는 순간 70으로
    const ch=applyCharm(this.suspicion,this.hasCharm,this.charmUsed);
    if(ch.saved){this.suspicion=ch.value;this.charmUsed=true;this.message=`서린의 부적이 손을 감쌌다 — 의심 ${this.suspicion}`;this.draw();return false;}
    if(!isBusted(this.suspicion))return false;
    await this.bust();return gen!==this.gen||true;
  }
  /** 들통: forfeit(0)으로 즉시 패배, 붉은 막 + 먹물 "들통!" 600ms → 결과창. 일반 대결이면 그 장소 하루 출입 금지(장 대결은 금지 없음). */
  async bust(){
    const s=this.state;
    if(s.over)return;
    // showResult와 같이 세대 번호를 올려 진행 중이던 연출·대기 중인 선택을 모두 버린다(상대 턴 중이어도 남은 처리가 끝난 판을 건드리지 않게)
    this.stopTurnTimer();this.gen++;const gen=this.gen;
    this.fx.clear();this.hidden.clear();this.bagOpen=false;
    this.selectable=[];this.choiceResolve=undefined;this.gukjinResolve=undefined;this.gostopResolve=undefined;
    this.phase='busy';this.message='들통!';this.draw();
    s.forfeit(0);this.voice.play('스톱');
    const veil=this.add.rectangle(0,0,DESIGN.width,DESIGN.height,0x7a0a0a,0.35).setOrigin(0).setDepth(900);
    const c=this.tableCenter();
    await this.fx.banner('들통!',c.x,c.y,this.fxSettings.ms(FX.bust),{style:'ink',size:72,shakeText:true});
    veil.destroy();if(gen!==this.gen)return;
    if(!this.launch.scenario&&this.stake>0&&this.launch.placeId&&!this.chapter)saveProgress(banPlace(loadProgress(),this.launch.placeId));
    this.showResult('속임수가 들통나 즉시 패배했습니다.');
  }
  /** 6장 "걸릴 뻔"(1회): 화면 전체 0.3 어둡게 600ms, 상대 말풍선 "…방금 뭐였지?", 낮은 '쿵'. 흐름은 멈추지 않는다. */
  nearMiss(){
    this.nearMissShown=true;
    if(!this.launch.scenario)saveProgress(setFlag(loadProgress(),NEAR_MISS_FLAG));
    const veil=this.add.rectangle(0,0,DESIGN.width,DESIGN.height,0x000000,0.3).setOrigin(0).setDepth(800);
    this.time.delayedCall(this.fxSettings.ms(FX.bust),()=>veil.destroy());
    this.sfx.play('thud');this.setMood('surprised');
    this.fx.speech(NEAR_MISS_LINE,speechZone());
  }
  lowerSusp(amount:number){if(!this.suspicionShown)return;this.suspicion=lowerSuspicion(this.suspicion,amount);}
  // ---- 장비 ----
  /** 무표정 마스크: 의심도 −30, 대결당 1회(들통을 막지는 못한다 = 이미 100이면 늦다). */
  useMask(){if(this.phase!=='hand'||this.gearUsed.has('blankMask')||!this.gear.includes('blankMask'))return;this.gearUsed.add('blankMask');this.bagOpen=false;this.lowerSusp(SUSPICION.mask);this.message=`무표정 마스크: 의심도 ${this.suspicion}`;this.draw();}
  /** 투시경 안경: 상대 손패 무작위 1장을 3초 공개, 대결당 1회, 의심도 +20(들통날 수 있다). */
  useXray(){
    if(this.phase!=='hand'||this.gearUsed.has('xrayGlasses')||!this.gear.includes('xrayGlasses'))return;
    const hand=this.state.hands[1];if(!hand.length)return;
    this.gearUsed.add('xrayGlasses');this.bagOpen=false;
    const card=hand[pickIndexSafe(this.aiRng,hand.length)];
    this.xrayCard=card;this.message=`투시경: 상대 손패에 ${card.month}월 ${card.name} ${card.title}`;
    const gen=this.gen;this.time.delayedCall(FX.xray,()=>{if(gen!==this.gen)return;this.xrayCard=undefined;if(this.phase!=='result')this.draw();});
    void this.applySuspicion(SUSPICION.xray);
  }
  // ---- 바꿔치기 ----
  cancelSwap(){if(this.phase!=='swap')return;this.phase='hand';this.message='';this.draw();}
  /**
   * 바꿔치기: 고른 손패를 더미 윗장과 교환(GameState.swapHandWithDeck, 상태 동작). 성공률 70%(+동전 15%p, 최대 90%).
   * 성공: 손패가 더미로 가고 더미 윗장이 뒤집혀 손패로 들어오는 연출, 의심도 +25. 실패: 교환 없이 의심도 +40. 들통이면 판이 끝난다.
   */
  async doSwap(cardId:number){
    if(this.phase!=='swap')return;
    const gen=this.gen, s=this.state, sk=this.skills.find(x=>x.id==='swap');
    if(!sk||sk.uses<=0||!canSpendFocus(this.focus,this.skillCost('swap'))||s.deck.length===0){this.cancelSwap();return;}
    this.phase='busy';
    this.focus=spendFocus(this.focus,this.skillCost('swap'));sk.uses-=1;this.consumeCoffee();this.noteSkillUse('swap');
    if(this.blockSkill('swap')){this.phase='hand';this.draw();return;}
    const coin=this.coinBoost;if(coin){this.coinBoost=false;if(!this.launch.scenario)saveProgress(setFlag(loadProgress(),FLAGS.coinBoost,false));}
    const ok=this.aiRng()<swapSuccessRate(coin);
    if(ok){
      const given=s.hands[0].find(c=>c.id===cardId)!;
      const from=this.handRects(0,[given])[0];
      const {taken}=s.swapHandWithDeck(0,cardId);
      this.slides.forget(`hand:${given.id}`);this.hidden.add(taken.id);this.draw();
      const sp=this.fx.spawn(given,from);
      await this.fx.moveTo(sp,this.holdRect());if(gen!==this.gen)return;
      this.fx.remove(sp); // 준 패는 더미 윗장이 된다(더미는 뒷면이라 그대로 사라진다)
      const dk=this.fx.spawn(null,this.lastFloor.deck);
      await this.fx.moveTo(dk,this.holdRect());if(gen!==this.gen)return;
      await this.fx.flipTo(dk,taken);if(gen!==this.gen)return;this.sfx.play('flip');
      await this.fx.fly(dk,this.handRects(0,[taken])[0]);if(gen!==this.gen)return;
      this.fx.remove(dk);this.hidden.delete(taken.id);
      this.message=`바꿔치기 성공: ${given.month}월 ${given.name} ↔ ${taken.month}월 ${taken.name}`;this.draw();
      if(await this.applySuspicion(SUSPICION.swapSuccess))return;
    }else{
      this.message='바꿔치기 실패! 상대가 손을 쳐다본다.';this.draw();
      if(await this.applySuspicion(SUSPICION.swapFail))return;
    }
    if(gen!==this.gen||s.over)return;
    this.phase='hand';this.draw();
  }
  consumeCoffee(){if(this.coffeeBoost){this.coffeeBoost=false;if(!this.launch.scenario){const p=loadProgress();saveProgress({...p,flags:{...p.flags,[FLAGS.coffeeBoost]:false}});}}}
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
    // 내 흔들기: 그 카드의 종이 좌우로 흔들리며 종소리(합성) → 세 장 공개 연출. 연출 줄이기에서는 소리만
    if(player===0){const parts=cards.flatMap(c=>this.bells.get(c.id)??[]);this.sfx.play('bell');if(parts.length&&!this.fxSettings.reduced){await this.tweenBell(parts);if(gen!==this.gen)return;}}
    this.phase='busy';this.message=`${player===0?'내가':this.names[1]+'이'} ${month}월 세 장으로 흔들었습니다.`;this.draw();
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
  /** 종 흔들림: 각도 −18°↔+18° 왕복, 총 FX.bell. */
  tweenBell(parts:Phaser.GameObjects.GameObject[]){return new Promise<void>(res=>{this.tweens.add({targets:parts,angle:{from:-18,to:18},duration:Math.round(FX.bell/4),yoyo:true,repeat:1,ease:'Sine.easeInOut',onComplete:()=>res()});});}
  /** 모달 사이 이동. 현재 단계가 from일 때만 바꿔 중복 입력을 막는다. */
  switchModal(from:Phase,to:Phase){if(this.phase!==from)return;this.phase=to;this.draw();}
  // ---- 선택 대기: 모달 버튼이 resolve를 호출해 비동기 턴 흐름을 이어간다 ----
  pick(id:number){if(this.phase!=='choice'||!this.selectable.includes(id))return;this.stopTurnTimer();const r=this.choiceResolve;this.choiceResolve=undefined;this.phase='busy';this.selectable=[];r?.(id);}
  decideGukjin(c:GukjinChoice){if(this.phase!=='gukjin')return;const r=this.gukjinResolve;this.gukjinResolve=undefined;this.phase='busy';r?.(c);}
  decideGoStop(d:'go'|'stop'){if(this.phase!=='gostop')return;this.stopTurnTimer();const r=this.gostopResolve;this.gostopResolve=undefined;this.phase='busy';r?.(d);}
  askChoice(ids:number[],msg:string){return new Promise<number>(res=>{this.choiceResolve=res;this.phase='choice';this.selectable=ids;this.message=msg;this.draw();this.startTurnTimer('choice');});}
  askGukjin(){return new Promise<GukjinChoice>(res=>{this.gukjinResolve=res;this.phase='gukjin';this.message='9월 국진을 획득했습니다. 사용 방식을 선택하세요.';this.draw();});}
  askGoStop(){return new Promise<'go'|'stop'>(res=>{this.gostopResolve=res;this.phase='gostop';this.message=`기본 점수 ${this.state.baseScore(0)}점. 고 또는 스톱을 선택하세요.`;this.draw();this.startTurnTimer('gostop');});}
  // ---- 속공 타이머(강봉구 turnLimitMs) ----
  /**
   * 내 차례(손패)·바닥패 선택·고/스톱 창이 열릴 때 시작한다. 내 초상화 둘레에 원형 고리(남은 비율), 마지막 3초는 빨강 + 1초마다 틱.
   * 시간이 다 되면: 손패 → 가장 왼쪽 손패의 합법 행동(story/tempo.autoAction), 바닥패 선택 → 첫 후보, 고/스톱 → 스톱. 다른 상대는 제한 없음.
   */
  startTurnTimer(kind:'hand'|'choice'|'gostop'){
    const limit=turnLimitMs(this.profile);
    this.stopTurnTimer();
    if(!limit||this.launch.scenario)return;
    this.timerKind=kind;this.timerDeadline=this.time.now+limit;this.timerTick=-1;
    const gen=this.gen;
    this.timerEvent=this.time.addEvent({delay:100,loop:true,callback:()=>{
      if(gen!==this.gen){this.stopTurnTimer();return;}
      const left=this.timerDeadline-this.time.now;
      this.drawTimerRing(left/limit,left<=TIMER_WARN_MS);
      const sec=Math.ceil(left/1000);
      if(left<=TIMER_WARN_MS&&left>0&&sec!==this.timerTick){this.timerTick=sec;this.sfx.play('select');}
      this.showTimerNumber(kind,Math.max(0,sec),left<=TIMER_WARN_MS);
      if(left<=0)this.onTimerExpire(kind);
    }});
  }
  // ---- 11장 백무진 단계 ----
  /**
   * 단계 전환(한 판 안에서 상대 프로필 교체): 1→2 더미 ≤ 14 또는 내 기본 ≥ 5, 2→3 더미 ≤ 6 또는 무진 기본 ≥ 5. 매 차례 끝(내 차례 뒤·무진 차례 뒤)에 확인한다.
   * 단계가 오를 때마다 컷인 한 장(0.8초). 2단계: 판돈 ×2 제안 창(받으면 최종 ×2 + 공격적 고, 거절하면 도발 1회), 봉쇄 해제. 3단계: '!' + "손끝이 멈췄다", 속임수 활성.
   */
  async checkKingStage(){
    if(!this.profile.king||this.launch.kingFinal||this.state.over)return;
    const s=this.state, gen=this.gen;
    const target=nextKingStage(this.kingStage,s.deck.length,s.baseScore(0),s.baseScore(1));
    while(this.kingStage<target){
      this.kingStage=(this.kingStage+1) as KingStage;this.draw();
      const cut=stageCutIn(this.kingStage,this.progress.flags['taeoh.accepted']===true);
      if(cut){await this.cutIn(cut);if(gen!==this.gen)return;}
      if(this.kingStage===2){
        this.fx.speech(MUJIN_BET,speechZone());
        const ok=await this.askBet();if(gen!==this.gen)return;
        if(ok){this.betAccepted=true;this.betMult=KING.betMultiplier;this.message='판돈 ×2. 백무진이 웃는다.';}
        else if(!this.taunt.calmed){this.fx.speech(MUJIN_TAUNT,speechZone());this.message='거절했다.';}
        else this.message='거절했다. 도발에 흔들리지 않는다.';
      }
      if(this.kingStage===3){this.setMood('surprised');this.message=KING_HAND_SIGN;}
      this.draw();
    }
  }
  /** 컷인 한 장: 화면 아래 대화창만, 0.8초 뒤 자동으로 사라진다(입력 없음). */
  cutIn(text:string){return new Promise<void>(res=>{
    const w=680,h=110,x=(DESIGN.width-w)/2,y=DESIGN.height-h-40;
    const bg=this.add.rectangle(x,y,w,h,0x101410,0.92).setOrigin(0).setStrokeStyle(2,0xb08d4a).setDepth(950);
    const tx=this.add.text(x+24,y+h/2,text,{fontFamily:'"NanumGothic", sans-serif',fontSize:24,color:COLORS.text,wordWrap:{width:w-48}}).setOrigin(0,0.5).setDepth(951);
    this.time.delayedCall(this.fxSettings.ms(CUT_IN_MS)*(this.fxSettings.reduced?2:1),()=>{bg.destroy();tx.destroy();res();});
  });}
  askBet(){return new Promise<boolean>(res=>{this.betResolve=res;this.stopTurnTimer();this.phase='bet';this.draw();});}
  decideBet(ok:boolean){if(this.phase!=='bet')return;const r=this.betResolve;this.betResolve=undefined;this.phase='busy';this.draw();r?.(ok);}
  /** 잡기 창: 2.5초 안에 [잡는다]/[모른 척한다], 시간 초과는 모른 척. */
  askCatch(){return new Promise<'catch'|'ignore'>(res=>{
    this.catchResolve=res;this.phase='catch';this.draw();
    const gen=this.gen;this.catchTimer=this.time.delayedCall(CATCH_WINDOW_MS,()=>{if(gen!==this.gen)return;this.decideCatch('ignore');});
  });}
  decideCatch(d:'catch'|'ignore'){if(this.phase!=='catch')return;this.catchTimer?.remove(false);this.catchTimer=undefined;const r=this.catchResolve;this.catchResolve=undefined;this.phase='busy';this.draw();r?.(d);}
  /** 잡았다: 상대 들통 → forfeit(1, caught)로 내 승리(기준 점수 max(내 기본, 7)). 붉은 막 대신 금색 막 + "잡았다!". */
  async caught(){
    const s=this.state;if(s.over)return;
    this.stopTurnTimer();this.gen++;const gen=this.gen;
    this.fx.clear();this.hidden.clear();this.selectable=[];this.choiceResolve=undefined;this.gukjinResolve=undefined;this.gostopResolve=undefined;
    s.forfeit(1,{kind:'caught'});this.phase='busy';this.message='잡았다!';this.setMood('defeated');this.draw();
    const veil=this.add.rectangle(0,0,DESIGN.width,DESIGN.height,0xe0b64f,0.28).setOrigin(0).setDepth(900);
    const c=this.tableCenter();
    await this.fx.banner('잡았다!',c.x,c.y,this.fxSettings.ms(FX.bust),{style:'gold',size:72});
    veil.destroy();if(gen!==this.gen)return;
    this.showResult(`${this.names[1]}의 속임수를 잡았습니다.`);
  }
  /** 아버지: 아직 접기를 안 배웠고 아버지 기본 ≥ 5, 내 점수가 낮은 첫 순간 "불리할 땐 접는 거다." + 임시 접기 버튼(이 판만, 비용 0). */
  checkTeachFold(){
    if(!this.profile.teachesFold||this.state.over)return;
    const learned=this.skills.some(x=>x.id==='fold');
    if(!shouldTeachFold(learned,this.state.baseScore(1),this.state.baseScore(0),this.foldTaught,this.state.goCount[1]))return;
    this.foldTaught=true;this.tempFold=true;this.fatherHold=TEACH_FOLD.holdTurns;this.skills.push({id:'fold',uses:1});
    this.fx.speech(FATHER_TEACH_FOLD,speechZone());
    this.draw();
    const keys=this.buttonKeys(), idx=keys.indexOf('fold'), lay=skillBarLayout(REGIONS.skillBar,keys.length); // 임시 접기는 맨 앞
    const rect=lay.buttons[idx];if(rect)void this.fx.highlight([rect],this.fxSettings.ms(600),0xffe08a);
  }
  /** 내 차례에 먹은 분류 기록(학습형): 3턴 연속 같은 분류면 태오가 저지를 강화한다. */
  noteCaptures(plan:TurnPlan){
    if(!this.profile.learner)return;
    const opt=this.state.scoreOptions(0);
    const kinds=Array.from(new Set(plan.captureGroups.flat().map(c=>captureKind(c,opt)))) as CaptureKind[];
    this.captureHistory.push(kinds);
    if(!this.learnerBlock&&captureStreak(this.captureHistory)){this.learnerBlock=true;aiLog('학습형','3턴 연속 같은 분류 → 저지 ×1.5');}
  }
  stopTurnTimer(){this.timerEvent?.remove(false);this.timerEvent=undefined;this.timerKind=undefined;this.timerGfx?.clear();this.timerText?.setVisible(false);this.timerSec=undefined;}
  /**
   * 남은 초 표시: 손패·바닥패 선택 단계는 손패 윗줄 위 가운데 큰 숫자(40, 굵게, 아이보리 → 마지막 3초 빨강 + 1.15배 맥동),
   * 고/스톱 창은 창 제목 오른쪽 숫자(24, 초가 바뀔 때만 다시 그린다).
   */
  showTimerNumber(kind:'hand'|'choice'|'gostop',sec:number,warn:boolean){
    const changed=sec!==this.timerSec;this.timerSec=sec;
    if(kind==='gostop'){this.timerText?.setVisible(false);if(changed&&this.phase==='gostop')this.draw();return;}
    const tx=this.timerText;if(!tx)return;
    tx.setVisible(true).setText(String(sec)).setColor(warn?'#e03a3a':COLORS.text).setPosition(DESIGN.width/2,REGIONS.hand.y+8);
    if(changed&&warn&&!this.fxSettings.reduced){tx.setScale(1);this.tweens.add({targets:tx,scale:1.15,duration:140,yoyo:true,ease:'Quad.easeOut'});}
  }
  drawTimerRing(ratio:number,warn:boolean){
    const g=this.timerGfx, pv=this.myPanel?.portrait;if(!g||!pv)return;
    g.clear();g.lineStyle(6,warn?0xe03a3a:0xe0b64f,1);
    g.beginPath();g.arc(pv.cx,pv.cy,pv.r+8,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,ratio)),false);g.strokePath();
  }
  onTimerExpire(kind:'hand'|'choice'|'gostop'){
    this.stopTurnTimer();
    if(kind==='choice'&&this.phase==='choice'){this.message='시간 초과: 첫 패를 가져갑니다.';this.pick(autoChoice(this.selectable));return;}
    if(kind==='gostop'&&this.phase==='gostop'){this.message='시간 초과: 스톱.';this.decideGoStop('stop');return;}
    if(kind!=='hand')return;
    if(this.phase==='swap')this.cancelSwap();
    if(['menu','capturedView','rules','credits','devinfo','gallery','scenarios'].includes(this.phase))this.phase='hand';
    if(this.phase!=='hand')return;
    const a=autoAction(this.state);if(!a)return;
    this.message='시간 초과: 가장 왼쪽 패를 냅니다.';this.bagOpen=false;
    void this.runPlayerTurn(a);
  }
  /** 판 종료 화면. 대기 중인 선택과 연출을 모두 버려 상대 턴이 실행되지 않게 한다. 결과 항목은 차례로 드러난다. 상대 반응 대사·표정을 정한다. */
  showResult(note:string){
    this.stopTurnTimer();
    this.gen++;this.fx.clear();this.hidden.clear();
    this.phase='result';this.selectable=[];this.choiceResolve=undefined;this.gukjinResolve=undefined;this.gostopResolve=undefined;this.peek=false;
    this.message=note;
    this.saveOutcome();
    const r=this.state.result;
    const ev:DialogEvent=r?.outcome==='승리'?(r.winner===0?'playerWin':'aiWin'):'draw';
    this.resultLine=this.dialog.pick(ev,this.state.turn,this.aiRng)??'';
    this.setMood(EVENT_MOOD[ev]);
    this.startResultReveal(r?this.resultLines(r).length:2);
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
    if(player===0){const slots=this.displaySlots();const lay=handLayout(slots.length);return cards.map(c=>lay[slots.findIndex(sl=>sl.kind==='card'&&sl.card.id===c.id)]);}
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
      this.message=`${player===0?'손패 없이':this.names[1]+'이 손패 없이'} 더미만 뒤집습니다.`;this.draw();
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
      else{const d=this.opponent.chooseGukjin(publicView(s,1));s.chooseGukjin(1,d.choice);aiLog('국진',d.reason);this.message=`${this.names[1]}은 국진을 ${d.choice==='피'?'쌍피':'열끗'}으로 씁니다.`;}
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
        this.message=player===0?`상대 피 ${cards.length}장을 가져왔습니다.`:`${this.names[1]}이 내 피 ${cards.length}장을 가져갔습니다.`;
      }else this.message='가져올 상대 피가 없습니다.';
      this.draw();this.pulseScores();
    }
    if(player===0){await this.checkMission();if(gen!==this.gen)return null;}
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
    this.stopTurnTimer();this.bagOpen=false;
    this.phase='busy';this.peek=false;this.peekCount=1;this.turnOwner=0;this.message='';
    // 자동 흔들기: 공개 연출을 먼저 끝내고(version 증가) 그 뒤에 일반 턴 계획을 만든다. 손패는 소비되지 않으므로 index는 그대로다.
    if(action.kind==='normal'&&action.shakeMonth!==undefined){await this.shake(0,action.shakeMonth,false);if(gen!==this.gen||this.state.over)return;}
    const plan=await this.runTurn(0,action,(cands,card)=>this.askChoice(cands.map(c=>c.id),`${card.month}월: 가져올 바닥패를 선택하세요.`));
    if(!plan||gen!==this.gen)return;
    this.noteCaptures(plan);this.checkTeachFold();
    await this.checkKingStage();if(gen!==this.gen||s.over)return;
    // 10) 고/스톱: 카드·피 이동과 점수 갱신이 끝난 최종 상태로 판단
    if(s.over)return;
    if(s.canDecide(0)){
      if(!s.canGo(0)){s.declareStop(0);this.voice.play('스톱');this.showResult('마지막 행동이라 고를 할 수 없어 스톱으로 정산했습니다.');return;}
      // 도발(3장 마 사장): 고/스톱 창 직전에 판당 1회 말풍선. 태연한 얼굴을 썼으면 뜨지 않는다. 응해서 고를 외치면 상대 고/스톱 정책이 공격적으로 바뀐다(provokedPolicy).
      const tauntLines=this.profile.taunts??[];
      const taunted=tauntLines.length>0&&shouldTaunt(this.profile,this.taunt);
      if(taunted){
        this.taunt=markShown(this.taunt);this.tauntNow=true;
        this.setMood('happy');this.fx.speech(pickTaunt(tauntLines,this.aiRng),speechZone());
        await sleep(this,this.fxSettings.ms(FX.taunt));if(gen!==this.gen)return;
      }
      const d=await this.askGoStop();if(gen!==this.gen)return;
      this.taunt=afterGoStop(this.taunt,d,taunted);this.tauntNow=false;
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
    this.phase='busy';this.turnOwner=1;this.message=`${this.names[1]}이 패를 고르고 있습니다…`;this.draw();
    // 역정보형(복희): 차례 시작 때 bluff 확률로 실제 상태(상대 기본 점수)의 반대를 말한다. 시선 돌리기 뒤의 다음 말풍선 하나에는 (거짓)/(참)
    // 시선 돌리기를 쓴 턴(ignoreBluffThisTurn)에는 말풍선을 그대로 보여 주되 (거짓)/(참)을 붙여 꿰뚫어 본다
    // 차유라: 가짜 흔들기 예고(말풍선 + 종소리만, 실제 선언 없음 → 규칙 상태 그대로). 시선 돌리기를 쓴 판이면 "(거짓)"
    if(fakeShake(this.aiRng,this.profile.fakeShake)){
      this.sfx.play('bell');this.fx.speech(markBluff({text:FAKE_SHAKE_LINE,truthful:false},this.revealBluff||this.ignoreBluffThisTurn||this.usedOrder.includes('lookAway')),speechZone());
    }else if(this.profile.bluff){
      const l=pickBluff(this.aiRng,this.profile.bluff,s.baseScore(1),this.profile.bluffLines??BOKHEE_BLUFF);
      this.fx.speech(markBluff(l,this.revealBluff||this.ignoreBluffThisTurn),speechZone());this.revealBluff=false;
    }
    await sleep(this,this.fxSettings.ms(this.profile.thinkMs));if(gen!==this.gen)return;
    this.oppTurns+=1;
    // 아버지: 3번째 차례에 내 실제 손패의 월 하나를 짚는다(이야기 장면이라 이 상대만 비공개 정보 허용)
    if(this.profile.readsHand&&this.oppTurns===FATHER_READ_TURN){const rd=fatherRead(s.hands[0],this.aiRng,FATHER_READ);if(rd)this.fx.speech(rd.text,speechZone());}
    // 상대 속임수(뱀눈): 차례 시작에 rng로 정하고, 바닥과 맞지 않는 손패 1장을 더미 윗장과 바꾼다(공개 정보만으로 고름).
    // 간파로 지켜보는 중이면 실행 직전 잡기 창(2.5초), 아니면 진동 손목시계 경고(판당 1회). 그 뒤 평소대로 행동한다.
    let cheated=false;
    if(s.remainingActions(1)>0&&s.deck.length>0&&decideCheat(this.aiRng,this.cheatSpec,this.cheatsUsed)){
      const card=pickCheatCard(publicView(s,1));
      if(card){
        cheated=true;this.cheatsUsed+=1;
        const react=cheatReaction(true,this.watching,this.hasBuzz,this.buzzUsed);
        if(react==='catch'){const d=await this.askCatch();if(gen!==this.gen)return;if(d==='catch'){await this.caught();return;}this.message='모른 척했다.';}
        if(react==='buzz'){this.buzzUsed=true;this.message='손목이 떨린다 — 뭔가 바뀌었다';this.sfx.play('thud');}
        s.swapHandWithDeck(1,card.id);this.draw();
      }
    }
    if(this.watching){if(!cheated){this.message='지켜봤지만 아무 일도 없었다.';this.draw();}this.watching=false;}
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
    // 아버지: 접기를 가르친 뒤 1턴은 고/스톱을 부르지 않는다(플레이어가 접을 시간). 마지막 행동이면 규칙대로 스톱
    const holding=this.fatherHold>0&&s.canGo(1);if(this.fatherHold>0)this.fatherHold-=1;
    if(s.canDecide(1)&&holding)this.message=`${this.names[1]}이 패를 내려다본다.`;
    else if(s.canDecide(1)){
      if(!s.canGo(1)){s.declareStop(1);this.showResult(`${this.names[1]}이 마지막 행동이라 스톱했습니다.`);return;}
      const d=this.opponent.decideGoStop(publicView(s,1));aiLog(d.decision==='go'?'고':'스톱',d.reason);
      if(d.decision==='stop'){s.declareStop(1);this.showResult(`${this.names[1]}이 스톱했습니다.`);return;}
      const n=s.declareGo(1);this.message=`${this.names[1]}: ${n}고!`;this.draw();
      const c=this.tableCenter();await this.fx.banner(`${this.names[1]} ${s.goCount[1]}고!`,c.x,c.y,FX.bannerGo,{style:'red',size:52});if(gen!==this.gen)return;
    }
    if(s.settleIfExhausted()){this.showResult('양쪽 행동이 모두 소진되었습니다.');return;}
    if(s.remainingActions(0)===0){s.turn+=1;await this.runOpponentTurn();return;} // 내 행동이 없으면 상대가 이어서 진행
    this.ignoreBluffThisTurn=false; // 시선 돌리기는 '이번 턴'까지
    this.checkTeachFold();
    await this.checkKingStage();if(gen!==this.gen||s.over)return;
    this.phase='hand';this.turnOwner=0;this.message='내 차례입니다. 손패나 기회 패를 누르세요.';this.draw();
    this.startTurnTimer('hand');
  }
}
/** pickIndex와 같되 빈 목록이면 0. */
function pickIndexSafe(rng:Rng,n:number){return n<=0?0:Math.min(n-1,Math.floor(rng()*n));}
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
  // 첫 씬(boot)이 진행 상태를 읽어 프롤로그 또는 여정 지도로 보낸다. 대결(table)은 지도·이야기 씬이 시작 데이터와 함께 연다.
  new Phaser.Game({type:Phaser.AUTO,parent:'app',width:DESIGN.width,height:DESIGN.height,backgroundColor:'#141a14',scene:[BootScene,JourneyScene,StoryScene,TableScene],audio:{noAudio:true},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH}});
}
const fontsReady=typeof document!=='undefined'&&'fonts' in document
  ?Promise.all(['16px "NanumGothic"','bold 16px "NanumGothic"','16px "NanumBrushScript"'].map(f=>document.fonts.load(f).catch(()=>[]))).then(()=>undefined)
  :Promise.resolve();
void Promise.race([fontsReady,new Promise<void>(r=>setTimeout(r,1500))]).then(startGame);
