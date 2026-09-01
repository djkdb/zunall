// Career OS 도메인 상수: 목표 유형, 스킬 카탈로그, 근거 종류, 역할 템플릿.
// 점수는 services/score/* 의 규칙 기반 레이어에서만 계산한다.

export const GOAL_TYPES = {
  ROLE: "직무 목표",
  COMPANY: "기업 목표",
  INDUSTRY: "산업 목표",
  GENERAL: "일반 목표",
} as const;
export type GoalType = keyof typeof GOAL_TYPES;

export const GOAL_PRIORITIES = {
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
} as const;
export type GoalPriority = keyof typeof GOAL_PRIORITIES;

export const SKILL_CATEGORIES = {
  tech: "기술",
  domain: "도메인",
  soft: "소프트 스킬",
} as const;
export type SkillCategory = keyof typeof SKILL_CATEGORIES;

/**
 * 기본 스킬 카탈로그. aliases는 공고문/문서에서 해당 역량을 감지하는 키워드.
 * 사용자는 카탈로그 외 스킬도 직접 추가할 수 있다.
 */
export interface CatalogSkill {
  name: string;
  category: SkillCategory;
  aliases: string[];
}

export const SKILL_CATALOG: CatalogSkill[] = [
  { name: "AI 활용", category: "tech", aliases: ["ai", "인공지능", "llm", "gpt", "claude", "머신러닝", "생성형", "프롬프트", "chatgpt", "딥러닝"] },
  { name: "Frontend", category: "tech", aliases: ["frontend", "프론트엔드", "react", "리액트", "next", "vue", "웹 개발", "html", "css", "javascript", "typescript", "ui 개발"] },
  { name: "Backend", category: "tech", aliases: ["backend", "백엔드", "서버", "api", "node", "spring", "django", "database", "데이터베이스", "sql"] },
  { name: "Cloud / 배포", category: "tech", aliases: ["cloud", "클라우드", "aws", "gcp", "azure", "배포", "vercel", "docker", "인프라", "devops", "supabase"] },
  { name: "모바일", category: "tech", aliases: ["모바일", "android", "ios", "flutter", "react native", "앱 개발"] },
  { name: "데이터 분석", category: "tech", aliases: ["데이터 분석", "데이터", "python", "pandas", "sql", "통계", "시각화", "tableau", "분석"] },
  { name: "시스템 설계", category: "tech", aliases: ["시스템 설계", "아키텍처", "설계", "system design", "확장성"] },
  { name: "자동화", category: "tech", aliases: ["자동화", "automation", "스크립트", "워크플로", "rpa", "에이전트"] },
  { name: "기획", category: "domain", aliases: ["기획", "pm", "product", "프로덕트", "서비스 기획", "요구사항", "기획서"] },
  { name: "디자인", category: "domain", aliases: ["디자인", "figma", "피그마", "ux", "ui", "브랜딩", "그래픽"] },
  { name: "마케팅", category: "domain", aliases: ["마케팅", "sns", "홍보", "브랜드", "콘텐츠 마케팅", "광고", "캠페인"] },
  { name: "콘텐츠 제작", category: "domain", aliases: ["콘텐츠", "영상", "블로그", "카드뉴스", "글쓰기", "에디터", "유튜브", "숏폼"] },
  { name: "리서치", category: "domain", aliases: ["리서치", "조사", "인터뷰", "설문", "시장 조사", "사용자 조사"] },
  { name: "문제 해결", category: "soft", aliases: ["문제 해결", "problem solving", "분석적", "논리"] },
  { name: "커뮤니케이션", category: "soft", aliases: ["커뮤니케이션", "소통", "발표", "프레젠테이션", "피칭"] },
  { name: "협업", category: "soft", aliases: ["협업", "팀워크", "팀 프로젝트", "팀원", "코워크"] },
  { name: "리더십", category: "soft", aliases: ["리더십", "리더", "팀장", "운영진", "회장", "조직 관리"] },
  { name: "면접 준비", category: "soft", aliases: ["면접", "인터뷰 준비", "자기소개", "모의면접"] },
];

export const EVIDENCE_KINDS = {
  project: "프로젝트",
  activity: "대외활동",
  award: "수상",
  certificate: "자격증",
  education: "교육",
  github: "GitHub",
  content: "콘텐츠",
  portfolio: "포트폴리오",
  work: "인턴/실무",
  etc: "기타",
} as const;
export type EvidenceKind = keyof typeof EVIDENCE_KINDS;

/** 근거 종류별 기본 기여 가중치 (skill score 계산용) */
export const EVIDENCE_WEIGHTS: Record<EvidenceKind, number> = {
  project: 15,
  award: 20,
  work: 18,
  activity: 10,
  certificate: 12,
  github: 10,
  education: 8,
  portfolio: 8,
  content: 6,
  etc: 5,
};

export const ACTION_STATUSES = {
  suggested: "추천됨",
  accepted: "진행 중",
  done: "완료",
  dismissed: "숨김",
} as const;
export type CareerActionStatus = keyof typeof ACTION_STATUSES;

export const ROADMAP_STATUSES = {
  planned: "예정",
  in_progress: "진행 중",
  done: "완료",
} as const;
export type RoadmapStatus = keyof typeof ROADMAP_STATUSES;

/**
 * 역할 템플릿: 목표 직무별 요구 스킬과 목표 수준.
 * keywords로 목표 이름/희망 직무 텍스트에서 매칭한다.
 */
export interface RoleTemplate {
  key: string;
  label: string;
  keywords: string[];
  /** 요구 스킬: 스킬명 → 목표 수준(0~100)과 이유 */
  requirements: Array<{ skill: string; target: number; why: string }>;
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: "ai_engineer",
    label: "AI Software Engineer",
    keywords: ["ai engineer", "ai software", "ai 개발", "ai 엔지니어", "머신러닝", "ml engineer", "llm"],
    requirements: [
      { skill: "AI 활용", target: 80, why: "AI 제품 개발의 핵심 역량" },
      { skill: "Backend", target: 70, why: "모델 서빙·API 구축에 필요" },
      { skill: "Frontend", target: 55, why: "프로토타입·데모 제작에 필요" },
      { skill: "Cloud / 배포", target: 65, why: "실서비스 운영 경험 요구" },
      { skill: "시스템 설계", target: 60, why: "파이프라인·아키텍처 설계" },
      { skill: "문제 해결", target: 70, why: "모델·데이터 문제 진단" },
      { skill: "면접 준비", target: 60, why: "기술 면접 대응" },
    ],
  },
  {
    key: "frontend",
    label: "Frontend Engineer",
    keywords: ["frontend", "프론트엔드", "웹 개발자", "react 개발"],
    requirements: [
      { skill: "Frontend", target: 85, why: "직무 핵심 역량" },
      { skill: "Backend", target: 50, why: "API 협업 이해" },
      { skill: "Cloud / 배포", target: 55, why: "배포 파이프라인 경험" },
      { skill: "디자인", target: 50, why: "UI 감각과 디자이너 협업" },
      { skill: "문제 해결", target: 65, why: "디버깅·성능 개선" },
      { skill: "협업", target: 60, why: "제품팀 협업" },
      { skill: "면접 준비", target: 60, why: "기술 면접 대응" },
    ],
  },
  {
    key: "backend",
    label: "Backend Engineer",
    keywords: ["backend", "백엔드", "서버 개발"],
    requirements: [
      { skill: "Backend", target: 85, why: "직무 핵심 역량" },
      { skill: "Cloud / 배포", target: 70, why: "인프라·운영 경험" },
      { skill: "시스템 설계", target: 70, why: "확장 가능한 설계" },
      { skill: "데이터 분석", target: 50, why: "데이터 모델링 이해" },
      { skill: "문제 해결", target: 70, why: "장애 대응·최적화" },
      { skill: "면접 준비", target: 60, why: "기술 면접 대응" },
    ],
  },
  {
    key: "data",
    label: "Data Analyst",
    keywords: ["데이터 분석가", "data analyst", "데이터 사이언", "data scien"],
    requirements: [
      { skill: "데이터 분석", target: 85, why: "직무 핵심 역량" },
      { skill: "AI 활용", target: 55, why: "ML 기반 분석 확장" },
      { skill: "리서치", target: 60, why: "문제 정의·가설 수립" },
      { skill: "커뮤니케이션", target: 65, why: "인사이트 전달" },
      { skill: "문제 해결", target: 70, why: "분석 문제 해결" },
      { skill: "면접 준비", target: 55, why: "케이스 면접 대응" },
    ],
  },
  {
    key: "pm",
    label: "Product Manager",
    keywords: ["pm", "프로덕트 매니저", "서비스 기획", "product manager", "기획자"],
    requirements: [
      { skill: "기획", target: 85, why: "직무 핵심 역량" },
      { skill: "리서치", target: 70, why: "사용자·시장 이해" },
      { skill: "데이터 분석", target: 60, why: "데이터 기반 의사결정" },
      { skill: "커뮤니케이션", target: 75, why: "이해관계자 조율" },
      { skill: "리더십", target: 60, why: "제품 리딩" },
      { skill: "AI 활용", target: 50, why: "AI 제품 이해도" },
    ],
  },
  {
    key: "marketing",
    label: "Marketer",
    keywords: ["마케터", "마케팅", "브랜드", "그로스"],
    requirements: [
      { skill: "마케팅", target: 85, why: "직무 핵심 역량" },
      { skill: "콘텐츠 제작", target: 70, why: "콘텐츠 기반 마케팅" },
      { skill: "데이터 분석", target: 60, why: "성과 측정" },
      { skill: "리서치", target: 60, why: "타깃 분석" },
      { skill: "커뮤니케이션", target: 65, why: "메시지 전달력" },
    ],
  },
  {
    key: "designer",
    label: "Product Designer",
    keywords: ["디자이너", "designer", "ux", "ui 디자인"],
    requirements: [
      { skill: "디자인", target: 85, why: "직무 핵심 역량" },
      { skill: "리서치", target: 65, why: "사용자 리서치" },
      { skill: "기획", target: 60, why: "제품 사고" },
      { skill: "Frontend", target: 45, why: "구현 이해도" },
      { skill: "커뮤니케이션", target: 65, why: "디자인 설득" },
    ],
  },
  {
    key: "general",
    label: "일반 커리어",
    keywords: [],
    requirements: [
      { skill: "문제 해결", target: 70, why: "모든 직무의 기본기" },
      { skill: "커뮤니케이션", target: 65, why: "협업의 기본" },
      { skill: "협업", target: 65, why: "팀 기반 성과" },
      { skill: "AI 활용", target: 55, why: "생산성 기본기" },
      { skill: "콘텐츠 제작", target: 50, why: "자기 표현·기록" },
      { skill: "면접 준비", target: 55, why: "지원 대비" },
    ],
  },
];

/** Gap 스킬별 추천 행동 템플릿 */
export interface GapActionTemplate {
  title: string;
  minutes: number;
  effect: number; // 예상 Career Score 상승 폭
  reason: string;
}

export const GAP_ACTION_TEMPLATES: Record<string, GapActionTemplate[]> = {
  "AI 활용": [
    { title: "AI를 활용한 미니 프로젝트 1개 완성하기", minutes: 300, effect: 5, reason: "실제 산출물이 가장 강한 근거가 됩니다." },
    { title: "AI 활용 사례를 블로그 글로 정리하기", minutes: 90, effect: 2, reason: "활용 경험을 검증 가능한 기록으로 남깁니다." },
  ],
  Frontend: [
    { title: "프로젝트 하나를 반응형·다크모드까지 다듬어 배포하기", minutes: 240, effect: 4, reason: "완성도 있는 배포 경험이 포트폴리오 핵심입니다." },
    { title: "기존 프로젝트 README에 스크린샷·기술 설명 보강하기", minutes: 60, effect: 2, reason: "같은 결과물도 설명력이 평가를 좌우합니다." },
  ],
  Backend: [
    { title: "DB와 인증이 있는 API 서버 토이 프로젝트 만들기", minutes: 360, effect: 5, reason: "CRUD+인증 경험이 백엔드 역량의 기본 증거입니다." },
    { title: "기존 프로젝트에 테스트 코드 추가하기", minutes: 120, effect: 2, reason: "품질 의식을 보여주는 근거가 됩니다." },
  ],
  "Cloud / 배포": [
    { title: "프로젝트 1개를 Vercel/Cloudflare에 실제 배포하기", minutes: 120, effect: 4, reason: "실배포 경험 유무가 큰 차이를 만듭니다." },
    { title: "배포한 서비스에 실제 사용자 10명 확보하기", minutes: 240, effect: 4, reason: "운영 경험은 가장 희소한 근거입니다." },
  ],
  "시스템 설계": [
    { title: "내 프로젝트의 아키텍처 다이어그램 문서 작성하기", minutes: 90, effect: 3, reason: "설계를 설명할 수 있어야 면접에서 통합니다." },
  ],
  "데이터 분석": [
    { title: "공개 데이터셋으로 분석 리포트 1편 작성하기", minutes: 300, effect: 5, reason: "문제 정의→분석→인사이트 사이클 증거가 필요합니다." },
  ],
  기획: [
    { title: "기존 서비스 역기획 문서 1편 작성하기", minutes: 180, effect: 4, reason: "기획 사고력을 보여주는 대표 산출물입니다." },
  ],
  디자인: [
    { title: "포트폴리오용 케이스 스터디 1편 정리하기", minutes: 240, effect: 4, reason: "과정이 보이는 케이스 스터디가 핵심입니다." },
  ],
  마케팅: [
    { title: "직접 콘텐츠 채널을 열고 게시물 3개 올리기", minutes: 180, effect: 4, reason: "실행 데이터가 있는 마케터가 강합니다." },
  ],
  "콘텐츠 제작": [
    { title: "활동 경험을 콘텐츠 1편으로 제작해 게시하기", minutes: 120, effect: 3, reason: "제작 결과물 링크가 곧 증거가 됩니다." },
  ],
  리서치: [
    { title: "타깃 사용자 인터뷰 3건 진행하고 요약 정리하기", minutes: 180, effect: 3, reason: "1차 리서치 경험은 흔치 않은 강점입니다." },
  ],
  "문제 해결": [
    { title: "프로젝트에서 겪은 문제와 해결 과정을 회고로 작성하기", minutes: 60, effect: 2, reason: "문제 해결은 서사로 증명됩니다." },
  ],
  커뮤니케이션: [
    { title: "프로젝트 결과를 5분 발표 자료로 만들어 리허설하기", minutes: 90, effect: 2, reason: "전달력은 연습 근거로 보여줄 수 있습니다." },
  ],
  협업: [
    { title: "팀 활동에서 맡은 역할과 기여를 기록으로 정리하기", minutes: 45, effect: 2, reason: "협업 근거는 구체적 역할 기술에서 나옵니다." },
  ],
  리더십: [
    { title: "스터디/프로젝트 모임 1개를 직접 조직해 운영하기", minutes: 300, effect: 4, reason: "작게라도 이끈 경험이 리더십의 증거입니다." },
  ],
  "면접 준비": [
    { title: "예상 질문 10개에 대한 답변 스크립트 작성하기", minutes: 120, effect: 3, reason: "면접은 준비량이 그대로 드러납니다." },
    { title: "모의면접 1회 진행하고 피드백 기록하기", minutes: 90, effect: 3, reason: "실전 연습 없이는 개선되지 않습니다." },
  ],
  자동화: [
    { title: "반복 작업 1개를 자동화 스크립트로 만들기", minutes: 120, effect: 3, reason: "자동화는 결과물로 바로 증명됩니다." },
  ],
  모바일: [
    { title: "간단한 모바일 앱 프로토타입 만들기", minutes: 360, effect: 4, reason: "동작하는 앱이 최고의 근거입니다." },
  ],
};
