// 동행복권 공식 사이트에서 로또 6/45 역대 당첨번호를 받아 data/ 폴더에 저장합니다.
// 사용법: node lotto/scripts/update-data.mjs [--open]
//   --open: 새 회차가 추가되면 브라우저로 페이지를 열어 당첨 결과를 보여줍니다
// 이미 저장된 회차는 건너뛰고 새 회차만 받아옵니다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const JSON_PATH = join(DATA_DIR, 'draws.json');
const CSV_PATH = join(DATA_DIR, 'draws.csv');
const JS_PATH = join(DATA_DIR, 'draws.js');
const API = 'https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do';
const DELAY_MS = 400; // 서버에 부담을 주지 않도록 요청 사이에 쉬어갑니다

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(params) {
  const url = `${API}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.dhlottery.co.kr/lt645/result' },
    redirect: 'manual',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const body = await res.json();
  return body?.data?.list ?? [];
}

const toDraw = (d) => ({
  round: d.ltEpsd,
  date: `${d.ltRflYmd.slice(0, 4)}-${d.ltRflYmd.slice(4, 6)}-${d.ltRflYmd.slice(6, 8)}`,
  numbers: [d.tm1WnNo, d.tm2WnNo, d.tm3WnNo, d.tm4WnNo, d.tm5WnNo, d.tm6WnNo].sort((a, b) => a - b),
  bonus: d.bnsWnNo,
  firstWinners: d.rnk1WnNope,
  firstPrize: d.rnk1WnAmt,
  // 1~5등별 [당첨자 수, 1인당 당첨금, 등수별 총 당첨금]
  ranks: [1, 2, 3, 4, 5].map((k) => [d[`rnk${k}WnNope`], d[`rnk${k}WnAmt`], d[`rnk${k}SumWnAmt`]]),
});

const existing = existsSync(JSON_PATH) ? JSON.parse(readFileSync(JSON_PATH, 'utf8')) : [];
const byRound = new Map(existing.map((d) => [d.round, d]));
// 등수별 당첨금(ranks)이 없는 옛 형식 데이터가 있으면 전체를 다시 받습니다
const complete = existing.every((d) => Array.isArray(d.ranks));
const knownMax = complete ? existing.reduce((m, d) => Math.max(m, d.round), 0) : 0;

// 최신 회차부터 과거로 10개씩 내려가며, 이미 가진 회차에 닿으면 멈춥니다
let cursor = null;
let page = await call({ srchDir: 'center', srchLtEpsd: '99999' }).catch(() => []);
if (!page.length) {
  // 'center'가 큰 회차를 못 받는 경우 대비: 오늘 기준 추정 회차로 다시 시도
  const est = Math.floor((Date.now() - Date.UTC(2002, 11, 7)) / (7 * 864e5)) + 1;
  page = await call({ srchDir: 'center', srchLtEpsd: String(est) });
}
let added = 0;
while (page.length) {
  for (const d of page) {
    if (!byRound.has(d.ltEpsd)) added++;
    byRound.set(d.ltEpsd, toDraw(d));
  }
  const minRound = Math.min(...page.map((d) => d.ltEpsd));
  if (minRound <= 1 || minRound <= knownMax) break;
  cursor = minRound;
  await sleep(DELAY_MS);
  page = await call({ srchDir: 'older', srchCursorLtEpsd: String(cursor) });
  process.stdout.write(`\r${cursor}회차까지 받는 중...`);
}

const draws = [...byRound.values()].sort((a, b) => a.round - b.round);
// 빠진 회차가 없는지 확인
const missing = [];
for (let r = 1; r <= draws.at(-1).round; r++) if (!byRound.has(r)) missing.push(r);
if (missing.length) console.warn(`\n경고: 빠진 회차 ${missing.length}개: ${missing.slice(0, 20).join(', ')}`);

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(JSON_PATH, JSON.stringify(draws, null, 0).replace(/},{/g, '},\n{') + '\n');
writeFileSync(
  CSV_PATH,
  '﻿회차,추첨일,번호1,번호2,번호3,번호4,번호5,번호6,보너스,' +
    [1, 2, 3, 4, 5].map((k) => `${k}등당첨자수,${k}등1인당당첨금`).join(',') + '\n' +
    draws.map((d) => [d.round, d.date, ...d.numbers, d.bonus, ...d.ranks.flatMap(([n, a]) => [n, a])].join(',')).join('\n') + '\n'
);
// 브라우저에서 파일로 바로 열어도(file://) 읽을 수 있도록 JS 파일로도 저장
writeFileSync(
  JS_PATH,
  '// 자동 생성 파일 — scripts/update-data.mjs로 갱신하세요\n' +
    `window.LOTTO_DRAWS = ${JSON.stringify(draws.map((d) => [d.round, d.date, ...d.numbers, d.bonus, ...d.ranks.flatMap(([n, a]) => [n, a])]))};\n`
);
console.log(`\n완료: 총 ${draws.length}회차 (1~${draws.at(-1).round}회), 새로 추가 ${added}회차`);

if (added > 0 && process.argv.includes('--open')) {
  const page = join(ROOT, 'index.html');
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', page], { detached: true, stdio: 'ignore' }).unref();
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [page], { detached: true, stdio: 'ignore' }).unref();
}
