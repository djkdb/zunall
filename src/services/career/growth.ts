/**
 * 성장 기록 계산 (순수 함수 — 테스트 가능).
 *
 * "이 서비스를 쓴 덕분에 나아졌는가"에 답하는 데이터를 만든다.
 * 점수 하나만 보여주면 잘하고 있는지 알 수 없다. 처음과 지금을 견주고,
 * 어느 항목에서 올랐는지까지 쪼개야 다음에 무엇을 할지 정할 수 있다.
 */

/** 저장된 스냅샷 한 점 */
export interface SnapshotInput {
  day: string | null;
  score: number;
  /** ReadinessItem[] JSON — 이미 파싱된 형태로 받는다 */
  items: Array<{ label: string; points: number; max: number }>;
  createdAt: number;
}

export interface GrowthPoint {
  day: string;
  score: number;
}

export interface ItemDelta {
  label: string;
  from: number;
  to: number;
  max: number;
  delta: number;
}

export interface Growth {
  points: GrowthPoint[];
  /** 기록이 2점 이상이어야 "변화"를 말할 수 있다 */
  hasTrend: boolean;
  firstScore: number;
  latestScore: number;
  delta: number;
  /** 첫 기록부터 며칠 지났나 */
  days: number;
  /** 가장 많이 오른 항목이 앞에 온다 */
  itemDeltas: ItemDelta[];
  bestItem: ItemDelta | null;
}

const dayOf = (snapshot: SnapshotInput): string =>
  snapshot.day ?? new Date(snapshot.createdAt).toISOString().slice(0, 10);

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * 스냅샷 목록(시간 오름차순이 아니어도 된다)에서 성장 기록을 만든다.
 * 같은 날이 여러 개면 마지막 것만 쓴다.
 */
export function buildGrowth(snapshots: SnapshotInput[]): Growth {
  if (snapshots.length === 0) {
    return {
      points: [],
      hasTrend: false,
      firstScore: 0,
      latestScore: 0,
      delta: 0,
      days: 0,
      itemDeltas: [],
      bestItem: null,
    };
  }

  const sorted = [...snapshots].sort((a, b) => a.createdAt - b.createdAt);

  // 하루에 한 점만 남긴다 (같은 날이면 나중 것이 이긴다)
  const byDay = new Map<string, SnapshotInput>();
  for (const snapshot of sorted) byDay.set(dayOf(snapshot), snapshot);
  const unique = [...byDay.values()].sort((a, b) => a.createdAt - b.createdAt);

  const first = unique[0];
  const latest = unique[unique.length - 1];

  const fromItems = new Map(first.items.map((item) => [item.label, item]));
  const itemDeltas: ItemDelta[] = latest.items.map((item) => {
    const before = fromItems.get(item.label);
    return {
      label: item.label,
      from: round1(before?.points ?? 0),
      to: round1(item.points),
      max: item.max,
      delta: round1(item.points - (before?.points ?? 0)),
    };
  });
  itemDeltas.sort((a, b) => b.delta - a.delta);

  const risen = itemDeltas.filter((item) => item.delta > 0);

  return {
    points: unique.map((snapshot) => ({ day: dayOf(snapshot), score: round1(snapshot.score) })),
    hasTrend: unique.length >= 2,
    firstScore: round1(first.score),
    latestScore: round1(latest.score),
    delta: round1(latest.score - first.score),
    days: Math.max(
      0,
      Math.round((latest.createdAt - first.createdAt) / 86_400_000),
    ),
    itemDeltas,
    bestItem: risen[0] ?? null,
  };
}

/**
 * 꺾은선에 쓸 좌표를 만든다.
 * 점이 한 개면 선을 그릴 수 없으므로 호출하는 쪽에서 hasTrend 를 먼저 본다.
 */
export function chartGeometry(
  points: GrowthPoint[],
  width: number,
  height: number,
  pad = 6,
): { coords: Array<{ x: number; y: number; point: GrowthPoint }>; min: number; max: number } {
  const scores = points.map((p) => p.score);
  // 위아래로 약간 여유를 둬야 첫·끝 점이 잘리지 않는다
  const rawMin = Math.min(...scores);
  const rawMax = Math.max(...scores);
  const span = Math.max(1, rawMax - rawMin);
  const min = Math.max(0, rawMin - span * 0.15);
  const max = Math.min(100, rawMax + span * 0.15);
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;

  const coords = points.map((point, index) => ({
    x: pad + (points.length === 1 ? usableW / 2 : (usableW * index) / (points.length - 1)),
    y: pad + usableH - (usableH * (point.score - min)) / Math.max(1, max - min),
    point,
  }));
  return { coords, min, max };
}
