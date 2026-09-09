import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { DEMO_EMAIL_SUFFIX } from "@/services/demo/seed";

export type AdminMetrics = {
  usersTotal: number;
  users7d: number;
  users30d: number;
  demoUsers: number;
  googleUsers: number;
  activities: number;
  usersWithActivity: number;
  onboarded: number;
  aiDone: number;
  essayDrafts: number;
  interviewQuestions: number;
  retrospectives: number;
  sharedPortfolios: number;
  noticeSources: number;
  noticeItems: number;
  pushDevices: number;
  fields: Array<{ key: string; count: number }>;
  types: Array<{ key: string; count: number }>;
};

type Raw = Array<Record<string, unknown>> | { rows?: Array<Record<string, unknown>> };

const rowsOf = (result: Raw) => (Array.isArray(result) ? result : (result.rows ?? []));
const num = (value: unknown) => Number(value ?? 0);

/**
 * 서비스 전체 합계. 개인이 쓴 내용은 읽지 않고 개수만 센다.
 * 둘러보기 계정(@demo.local)은 실제 사용자가 아니므로 따로 세고 나머지에서는 뺀다.
 */
export async function getAdminMetrics(now = Date.now()): Promise<AdminMetrics> {
  const demo = `%${DEMO_EMAIL_SUFFIX}`;
  const day7 = now - 7 * 86_400_000;
  const day30 = now - 30 * 86_400_000;

  // 세 번의 왕복을 동시에 보낸다 (Neon HTTP 는 쿼리 하나가 왕복 하나다)
  const [summary, fieldRows, typeRows] = await Promise.all([
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM users WHERE email NOT LIKE ${demo}) AS users_total,
        (SELECT count(*) FROM users WHERE email NOT LIKE ${demo} AND created_at > ${day7}) AS users_7d,
        (SELECT count(*) FROM users WHERE email NOT LIKE ${demo} AND created_at > ${day30}) AS users_30d,
        (SELECT count(*) FROM users WHERE email LIKE ${demo}) AS demo_users,
        (SELECT count(*) FROM users WHERE google_id IS NOT NULL AND email NOT LIKE ${demo}) AS google_users,
        (SELECT count(*) FROM users WHERE portfolio_token IS NOT NULL AND email NOT LIKE ${demo}) AS shared_portfolios,
        (SELECT count(*) FROM activities a JOIN users u ON u.id = a.user_id WHERE u.email NOT LIKE ${demo}) AS activities,
        (SELECT count(DISTINCT a.user_id) FROM activities a JOIN users u ON u.id = a.user_id WHERE u.email NOT LIKE ${demo}) AS users_with_activity,
        (SELECT count(*) FROM career_profiles c JOIN users u ON u.id = c.user_id WHERE c.onboarded_at IS NOT NULL AND u.email NOT LIKE ${demo}) AS onboarded,
        (SELECT count(*) FROM ai_reviews r JOIN users u ON u.id = r.user_id WHERE r.status = 'done' AND u.email NOT LIKE ${demo}) AS ai_done,
        (SELECT count(*) FROM essay_drafts d JOIN users u ON u.id = d.user_id WHERE u.email NOT LIKE ${demo}) AS essay_drafts,
        (SELECT count(*) FROM interview_questions i JOIN users u ON u.id = i.user_id WHERE u.email NOT LIKE ${demo}) AS interview_questions,
        (SELECT count(*) FROM retrospectives r JOIN users u ON u.id = r.user_id WHERE u.email NOT LIKE ${demo}) AS retrospectives,
        (SELECT count(*) FROM notice_sources s JOIN users u ON u.id = s.user_id WHERE u.email NOT LIKE ${demo}) AS notice_sources,
        (SELECT count(*) FROM notice_items n JOIN users u ON u.id = n.user_id WHERE u.email NOT LIKE ${demo}) AS notice_items,
        (SELECT count(*) FROM push_subscriptions p JOIN users u ON u.id = p.user_id WHERE u.email NOT LIKE ${demo}) AS push_devices
    `) as Promise<Raw>,
    db.execute(sql`
      SELECT c.study_field AS key, count(*) AS count
      FROM career_profiles c JOIN users u ON u.id = c.user_id
      WHERE c.study_field IS NOT NULL AND u.email NOT LIKE ${demo}
      GROUP BY c.study_field ORDER BY count DESC
    `) as Promise<Raw>,
    db.execute(sql`
      SELECT a.type AS key, count(*) AS count
      FROM activities a JOIN users u ON u.id = a.user_id
      WHERE u.email NOT LIKE ${demo}
      GROUP BY a.type ORDER BY count DESC
    `) as Promise<Raw>,
  ]);

  const m = rowsOf(summary)[0] ?? {};
  const toPairs = (result: Raw) =>
    rowsOf(result).map((row) => ({ key: String(row.key), count: num(row.count) }));

  return {
    usersTotal: num(m.users_total),
    users7d: num(m.users_7d),
    users30d: num(m.users_30d),
    demoUsers: num(m.demo_users),
    googleUsers: num(m.google_users),
    activities: num(m.activities),
    usersWithActivity: num(m.users_with_activity),
    onboarded: num(m.onboarded),
    aiDone: num(m.ai_done),
    essayDrafts: num(m.essay_drafts),
    interviewQuestions: num(m.interview_questions),
    retrospectives: num(m.retrospectives),
    sharedPortfolios: num(m.shared_portfolios),
    noticeSources: num(m.notice_sources),
    noticeItems: num(m.notice_items),
    pushDevices: num(m.push_devices),
    fields: toPairs(fieldRows),
    types: toPairs(typeRows),
  };
}
