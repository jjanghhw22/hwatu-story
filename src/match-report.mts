// 개발용: 초보 AI 대 전략 AI 고정 시드 대결 집계. node --experimental-strip-types src/match-report.mts [판수] [시드]
import { STRATEGIC } from './ai.ts';
import { BEGINNER } from './beginner.ts';
import { playMatch } from './sim.ts';
const rounds = Number(process.argv[2] ?? 200), seed = Number(process.argv[3] ?? 1);
const m = playMatch(BEGINNER, STRATEGIC, rounds, seed);
console.log(JSON.stringify({ rounds: m.rounds, draws: m.draws, beginner: m.seats.beginner, strategic: m.seats.strategic, seed }, null, 1));
