/** 성장 기록 계산 테스트. 실행: npx tsx tests/growth.test.ts */
import assert from "node:assert/strict";
import { buildGrowth, chartGeometry, type SnapshotInput } from "@/services/career/growth";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

const DAY = 86_400_000;
const base = Date.UTC(2026, 0, 1);
const snap = (dayOffset: number, score: number, items: Array<[string, number, number]>): SnapshotInput => ({
  day: new Date(base + dayOffset * DAY).toISOString().slice(0, 10),
  score,
  items: items.map(([label, points, max]) => ({ label, points, max })),
  createdAt: base + dayOffset * DAY,
});

test("기록이 없으면 추세 없음으로 안전하게 답한다", () => {
  const g = buildGrowth([]);
  assert.equal(g.hasTrend, false);
  assert.equal(g.points.length, 0);
  assert.equal(g.delta, 0);
  assert.equal(g.bestItem, null);
});

test("기록이 하나면 점수는 있어도 추세는 없다", () => {
  const g = buildGrowth([snap(0, 35, [["실전 경험", 5, 15]])]);
  assert.equal(g.hasTrend, false, "선을 그릴 수 없다");
  assert.equal(g.latestScore, 35);
  assert.equal(g.delta, 0);
});

test("처음과 지금을 견주어 변화량과 기간을 낸다", () => {
  const g = buildGrowth([
    snap(0, 35, [["실전 경험", 5, 15]]),
    snap(30, 53, [["실전 경험", 11, 15]]),
  ]);
  assert.equal(g.hasTrend, true);
  assert.equal(g.firstScore, 35);
  assert.equal(g.latestScore, 53);
  assert.equal(g.delta, 18);
  assert.equal(g.days, 30);
});

test("어느 항목에서 올랐는지 쪼개고 큰 순서로 정렬한다", () => {
  const g = buildGrowth([
    snap(0, 30, [["목표 스킬 충족도", 10, 55], ["실전 경험", 4, 15], ["검증 가능한 근거", 2, 15]]),
    snap(20, 52, [["목표 스킬 충족도", 22, 55], ["실전 경험", 9, 15], ["검증 가능한 근거", 3, 15]]),
  ]);
  assert.deepEqual(
    g.itemDeltas.map((item) => [item.label, item.delta]),
    [["목표 스킬 충족도", 12], ["실전 경험", 5], ["검증 가능한 근거", 1]],
  );
  assert.equal(g.bestItem?.label, "목표 스킬 충족도");
  assert.equal(g.bestItem?.from, 10);
  assert.equal(g.bestItem?.to, 22);
});

test("떨어진 항목도 숨기지 않는다", () => {
  const g = buildGrowth([
    snap(0, 40, [["실전 경험", 10, 15]]),
    snap(10, 34, [["실전 경험", 4, 15]]),
  ]);
  assert.equal(g.delta, -6);
  assert.equal(g.itemDeltas[0].delta, -6, "하락도 그대로 보고한다");
  assert.equal(g.bestItem, null, "오른 항목이 없으면 없다고 한다");
});

test("새로 생긴 항목은 0에서 올라온 것으로 센다", () => {
  const g = buildGrowth([
    snap(0, 20, [["실전 경험", 5, 15]]),
    snap(5, 33, [["실전 경험", 5, 15], ["검증 가능한 근거", 8, 15]]),
  ]);
  const added = g.itemDeltas.find((item) => item.label === "검증 가능한 근거");
  assert.equal(added?.from, 0);
  assert.equal(added?.delta, 8);
});

test("순서가 뒤섞여 들어와도 시간순으로 세운다", () => {
  const g = buildGrowth([
    snap(30, 53, [["실전 경험", 11, 15]]),
    snap(0, 35, [["실전 경험", 5, 15]]),
    snap(15, 44, [["실전 경험", 8, 15]]),
  ]);
  assert.deepEqual(g.points.map((p) => p.score), [35, 44, 53]);
  assert.equal(g.firstScore, 35);
  assert.equal(g.latestScore, 53);
});

test("같은 날 기록이 여러 개면 마지막 것만 쓴다", () => {
  const morning = snap(3, 40, [["실전 경험", 6, 15]]);
  const evening = { ...morning, score: 47, createdAt: morning.createdAt + 3600_000 };
  const g = buildGrowth([snap(0, 35, [["실전 경험", 5, 15]]), morning, evening]);
  assert.equal(g.points.length, 2, "하루는 한 점");
  assert.equal(g.latestScore, 47);
});

test("좌표는 테두리 안에 들어오고 점수가 높을수록 위로 간다", () => {
  const { coords } = chartGeometry(
    [
      { day: "2026-01-01", score: 30 },
      { day: "2026-01-10", score: 60 },
      { day: "2026-01-20", score: 45 },
    ],
    200,
    60,
  );
  assert.equal(coords.length, 3);
  for (const c of coords) {
    assert.ok(c.x >= 0 && c.x <= 200, `x 범위 ${c.x}`);
    assert.ok(c.y >= 0 && c.y <= 60, `y 범위 ${c.y}`);
  }
  assert.ok(coords[1].y < coords[0].y, "60점이 30점보다 위");
  assert.ok(coords[2].y > coords[1].y, "45점이 60점보다 아래");
  assert.ok(coords[0].x < coords[1].x && coords[1].x < coords[2].x, "시간순으로 오른쪽");
});

test("모든 점수가 같아도 좌표 계산이 깨지지 않는다", () => {
  const { coords, min, max } = chartGeometry(
    [
      { day: "2026-01-01", score: 50 },
      { day: "2026-01-02", score: 50 },
    ],
    100,
    40,
  );
  assert.ok(Number.isFinite(coords[0].y) && Number.isFinite(coords[1].y));
  assert.ok(max > min, "범위가 0이 되지 않는다");
});

console.log(`\n${passed}개 통과`);
