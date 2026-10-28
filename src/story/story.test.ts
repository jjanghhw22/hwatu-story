// 이야기 데이터의 정합성과 진행 상태(저장·집중력)의 순수 계산 검증.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, CHARACTER_IDS } from '../character.ts';
import { CHAPTERS, CHAPTER_IDS, type ChapterId, chapterById, chapterLabel, isChapterId, nextChapterId, placeOpensLabel } from './chapters.ts';
import { PLACES, PLACE_IDS } from './places.ts';
import { OPPONENTS, OPPONENT_IDS, resolveOpponent } from './opponents.ts';
import { SKILLS, SKILL_IDS } from './skills.ts';
import { ITEMS, ITEM_IDS } from './items.ts';
import { type KV, STORAGE_KEY, canSpendFocus, completeChapter, deserialize, formatManWon, formatWon, initialProgress, isChapterDone, loadProgress, resetProgress, rest, saveProgress, serialize, spendFocus, withFocus } from './progress.ts';

const unique = (ids: readonly string[]) => assert.equal(new Set(ids).size, ids.length, `중복 id: ${ids.join(',')}`);

test('챕터: id 유일, 프롤로그 → 1~11장 → 에필로그 순서, 번호 연속', () => {
  unique(CHAPTER_IDS);
  assert.equal(CHAPTERS[0].id, 'prologue');
  assert.equal(CHAPTERS[CHAPTERS.length - 1].id, 'epilogue');
  CHAPTERS.forEach((c, i) => assert.equal(c.no, i));
  assert.equal(nextChapterId('prologue'), 'ch1');
  assert.equal(nextChapterId('ch1'), 'ch2');
  assert.equal(nextChapterId('epilogue'), 'epilogue');
  assert.ok(isChapterId('ch3') && !isChapterId('ch99'));
  assert.equal(chapterLabel(chapterById('ch1')), 'CHAPTER 01 · 머리부터 자르고 와라');
  assert.equal(chapterLabel(chapterById('prologue')), 'PROLOGUE · 봉투');
});

test('챕터: 장소·unlocks·상대·보상 기술이 실제 데이터를 가리키고, 장소의 열리는 시점과 맞는다', () => {
  for (const c of CHAPTERS) {
    assert.ok(c.place in PLACES, `${c.id} place`);
    for (const p of c.unlocks) {
      assert.ok(p in PLACES, `${c.id} unlocks ${p}`);
      // 바이블 2절의 "열리는 시점"은 그 장소가 무대가 되는 장(또는 집처럼 그 장 끝)이라, 이 장이거나 바로 다음 장이어야 한다
      assert.ok([c.id, nextChapterId(c.id)].includes(PLACES[p].opensAt as ChapterId), `${p}: opensAt ${PLACES[p].opensAt}, unlocked by ${c.id}`);
    }
    if (c.opponentId) assert.ok(c.opponentId in OPPONENTS, `${c.id} opponent`);
    if (c.rewardSkill) assert.ok(c.rewardSkill in SKILLS, `${c.id} reward`);
    for (const s of [...c.scenes.before, ...c.scenes.after]) if (s.kind === 'line') assert.ok(s.speaker in CHARACTERS, `${c.id} speaker ${s.speaker}`);
  }
  // 모든 장소는 처음부터 열려 있거나, 어떤 장이 끝나면 열리거나, 그 장의 무대라서 그 장에 열린다
  for (const id of PLACE_IDS) {
    const p = PLACES[id];
    if (p.opensAt === 'start') continue;
    const ch = chapterById(p.opensAt);
    assert.ok(ch.unlocks.includes(id) || ch.place === id, `${id} opensAt ${p.opensAt}`);
  }
  assert.equal(placeOpensLabel('start'), null);
  assert.equal(placeOpensLabel('ch2'), '2장에서 열림');
});

test('프롤로그는 4컷, 1장은 before·after 장면이 비어 있지 않고 바이블 대사를 담는다', () => {
  const pro = chapterById('prologue');
  assert.equal(pro.scenes.before.length, 4);
  assert.ok(pro.scenes.before.every(s => s.kind === 'cut'));
  const ch1 = chapterById('ch1');
  assert.ok(ch1.scenes.before.length > 0 && ch1.scenes.after.length > 0);
  assert.ok(ch1.scenes.before.some(s => s.kind === 'line' && s.speaker === 'barber' && s.text === '한 판 이겨. 그러면 준다.'));
  assert.ok(ch1.scenes.after.some(s => s.kind === 'line' && s.text === '네 아버지, 예전에 패 좀 만졌다.'));
  assert.equal(ch1.opponentId, 'barber');
  assert.equal(ch1.rewardSkill, 'eye');
  assert.deepEqual(ch1.unlocks, ['home', 'store']);
});

test('인물·상대: 이름은 바이블대로, 상대 프로필의 인물·정책이 유효', () => {
  unique(CHARACTER_IDS);
  assert.equal(CHARACTERS.player.name, '한도윤');
  assert.equal(CHARACTERS.barber.name, '장대식');
  assert.equal(CHARACTERS.mujin.nickname, '왕');
  for (const id of CHARACTER_IDS) assert.ok(CHARACTERS[id].portraits.normal?.startsWith('assets/characters/'), id);
  unique(OPPONENT_IDS);
  for (const id of OPPONENT_IDS) {
    const o = OPPONENTS[id];
    assert.ok(o.characterId in CHARACTERS, id);
    assert.ok(o.thinkMs > 0);
    const policy = resolveOpponent(o);
    assert.equal(policy.key, o.policy === 'beginner' ? 'beginner' : o.policy === 'easy' ? 'easy' : 'strategic');
  }
  assert.equal(OPPONENTS.barber.policy, 'beginner');
  assert.equal(OPPONENTS.bonggu.turnLimitMs, 8000);
});

test('기술 8개·아이템 10개: id 유일, 수치는 바이블대로', () => {
  unique(SKILL_IDS); assert.equal(SKILL_IDS.length, 8);
  assert.deepEqual([SKILLS.eye.cost, SKILLS.eye.suspicion, SKILLS.eye.usesPerMatch, SKILLS.eye.kind], [20, 0, 2, 'honest']);
  assert.deepEqual([SKILLS.swap.cost, SKILLS.swap.suspicion, SKILLS.swap.kind], [35, 25, 'cheat']);
  assert.ok(SKILLS.handSwap.rare && SKILLS.memory.rare);
  for (const id of SKILL_IDS) assert.ok(SKILLS[id].kind === 'cheat' ? SKILLS[id].suspicion > 0 : SKILLS[id].suspicion === 0, id);
  unique(ITEM_IDS); assert.equal(ITEMS.length, 10);
  ITEMS.forEach((it, i) => assert.equal(it.no, i + 1));
  assert.equal(ITEMS.find(i => i.id === 'riceBall')?.focus, 20);
  assert.equal(ITEMS.find(i => i.id === 'luckyCoin')?.successBonus, 15);
});

test('진행 상태: 시작값과 직렬화 왕복', () => {
  const p = initialProgress();
  assert.deepEqual(p, { day: 1, money: 120000, chapterId: 'prologue', unlockedPlaces: ['barber'], skills: [], focusMax: 100, focus: 100, flags: {}, bag: {}, serin: { affinity: 0, visits: 0, lastEventDay: 0, lastVisitDay: 0, pity: 0, seen: [] }, counters: {} });
  const back = deserialize(serialize({ ...p, skills: ['eye'], unlockedPlaces: ['barber', 'home', 'store'], chapterId: 'ch2', flags: { 'ch1.done': true }, focus: 60 }));
  assert.deepEqual(back, { ...p, skills: ['eye'], unlockedPlaces: ['barber', 'home', 'store'], chapterId: 'ch2', flags: { 'ch1.done': true }, focus: 60 });
});

test('진행 상태: 깨진 저장은 초기값, 모르는 id는 걸러내고 범위를 맞춘다', () => {
  assert.equal(deserialize('{'), null);
  assert.equal(deserialize('{"chapterId":"ch99"}'), null);
  const p = deserialize('{"chapterId":"ch1","skills":["eye","nope"],"unlockedPlaces":["moon"],"focus":500,"focusMax":120,"day":-3,"flags":{"a":true,"b":"x"}}')!;
  assert.deepEqual(p.skills, ['eye']);
  assert.deepEqual(p.unlockedPlaces, ['barber']);
  assert.equal(p.focus, 120);
  assert.equal(p.day, 1);
  assert.deepEqual(p.flags, { a: true });
});

test('진행 상태: 저장·불러오기·초기화(메모리 저장소), 저장소가 없거나 던져도 무시', () => {
  const mem = new Map<string, string>();
  const kv: KV = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); }, removeItem: k => { mem.delete(k); } };
  assert.deepEqual(loadProgress(kv), initialProgress());
  const p = rest(initialProgress());
  assert.ok(saveProgress(p, kv));
  assert.ok(mem.has(STORAGE_KEY));
  assert.deepEqual(loadProgress(kv), p);
  assert.deepEqual(resetProgress(kv), initialProgress());
  assert.equal(mem.size, 0);
  const broken: KV = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
  assert.deepEqual(loadProgress(broken), initialProgress());
  assert.equal(saveProgress(p, broken), false);
  assert.equal(saveProgress(p, undefined), false);
});

test('집중력: 휴식은 최대치·하루 경과, 기술은 비용 차감, 0 미만 불가', () => {
  const p = withFocus(initialProgress(), 30);
  const r = rest(p);
  assert.equal(r.focus, r.focusMax); assert.equal(r.day, 2);
  assert.equal(spendFocus(100, 20), 80);
  assert.equal(spendFocus(20, 20), 0);
  assert.ok(!canSpendFocus(15, 20));
  assert.equal(spendFocus(15, 20), 15, '모자라면 차감하지 않는다');
  assert.equal(withFocus(p, -5).focus, 0);
  assert.equal(withFocus(p, 999).focus, p.focusMax);
});

test('1장 완료: 눈썰미 획득, 집 열림, 다음 장은 2장, 두 번 적용해도 같다', () => {
  const p0 = { ...initialProgress(), chapterId: 'ch1' as const };
  const p1 = completeChapter(p0, chapterById('ch1'));
  assert.deepEqual(p1.skills, ['eye']);
  assert.deepEqual(p1.unlockedPlaces, ['barber', 'home', 'store']);
  assert.equal(p1.chapterId, 'ch2');
  assert.ok(isChapterDone(p1, 'ch1') && !isChapterDone(p1, 'ch2'));
  assert.equal(completeChapter(p1, chapterById('ch1')), p1);
  const p9 = completeChapter({ ...p1, chapterId: 'ch9', focus: 100 }, chapterById('ch9'));
  assert.equal(p9.focusMax, 140);
  assert.equal(p9.focus, 100);
});

test('원화 표시', () => {
  assert.equal(formatWon(120000), '120,000원');
  assert.equal(formatManWon(32000000), '3,200만 원');
  assert.equal(formatManWon(15000), '15,000원');
});
