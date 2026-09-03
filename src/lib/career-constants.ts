// Career OS 도메인 상수: 목표 유형, 스킬 카탈로그, 근거 종류, 역할 템플릿.
// (활동 유형 키는 lib/constants 의 ACTIVITY_TYPES 를 그대로 쓴다)
// 점수는 services/score/* 의 규칙 기반 레이어에서만 계산한다.

import type { ActivityType } from "@/lib/constants";

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
 * 전공 계열.
 * 대학생 누구나 쓰는 서비스가 목표이므로, 스킬·목표 템플릿을 계열별로 나눠
 * 자기 전공과 무관한 항목이 먼저 보이지 않게 한다.
 */
export const STUDY_FIELDS = {
  humanities: "인문·어학",
  social: "사회·행정",
  business: "상경·경영",
  engineering: "공학·IT",
  science: "자연·생명",
  medical: "의약·보건",
  education: "교육",
  arts: "예술·체육",
} as const;
export type StudyField = keyof typeof STUDY_FIELDS;

/**
 * 기본 스킬 카탈로그. aliases는 공고문/문서에서 해당 역량을 감지하는 키워드.
 * 사용자는 카탈로그 외 스킬도 직접 추가할 수 있다.
 */
export interface CatalogSkill {
  name: string;
  category: SkillCategory;
  aliases: string[];
  /** 이 스킬이 주로 쓰이는 계열. 비어 있으면 계열 공통 */
  fields?: StudyField[];
}

export const SKILL_CATALOG: CatalogSkill[] = [
  // ── 계열 공통 (어떤 전공이든 쓰이는 역량) ──────────────────
  { name: "문제 해결", category: "soft", aliases: ["문제 해결", "problem solving", "분석적", "논리", "개선"] },
  { name: "커뮤니케이션", category: "soft", aliases: ["커뮤니케이션", "소통", "발표", "프레젠테이션", "피칭", "스피치"] },
  { name: "협업", category: "soft", aliases: ["협업", "팀워크", "팀 프로젝트", "팀원", "조별"] },
  { name: "리더십", category: "soft", aliases: ["리더십", "리더", "팀장", "운영진", "회장", "조직 관리", "동아리 대표"] },
  { name: "기획", category: "domain", aliases: ["기획", "pm", "product", "프로덕트", "서비스 기획", "요구사항", "기획서", "제안서"] },
  { name: "글쓰기", category: "domain", aliases: ["글쓰기", "작문", "칼럼", "에세이", "보고서 작성", "기고", "원고"] },
  { name: "자료 조사", category: "domain", aliases: ["자료 조사", "리서치", "조사", "인터뷰", "설문", "시장 조사", "문헌 조사", "사용자 조사"] },
  { name: "데이터 분석", category: "tech", aliases: ["데이터 분석", "데이터", "python", "pandas", "sql", "통계", "시각화", "tableau", "분석"] },
  { name: "엑셀 / 스프레드시트", category: "tech", aliases: ["엑셀", "excel", "스프레드시트", "구글 시트", "피벗", "vlookup"] },
  { name: "프로젝트 관리", category: "soft", aliases: ["프로젝트 관리", "일정 관리", "pmp", "간트", "노션", "협업 툴", "notion"] },
  { name: "외국어 (영어)", category: "soft", aliases: ["영어", "toeic", "토익", "opic", "오픽", "toefl", "ielts", "영어 회화", "english"] },
  { name: "AI 활용", category: "tech", aliases: ["ai", "인공지능", "llm", "gpt", "claude", "머신러닝", "생성형", "프롬프트", "chatgpt", "딥러닝"] },
  { name: "면접 준비", category: "soft", aliases: ["면접", "인터뷰 준비", "자기소개", "모의면접"] },

  // ── 공학·IT ───────────────────────────────────────────────
  { name: "Frontend", category: "tech", fields: ["engineering"], aliases: ["frontend", "프론트엔드", "react", "리액트", "next", "vue", "웹 개발", "html", "css", "javascript", "typescript"] },
  { name: "Backend", category: "tech", fields: ["engineering"], aliases: ["backend", "백엔드", "서버", "api", "node", "spring", "django", "database", "데이터베이스"] },
  { name: "Cloud / 배포", category: "tech", fields: ["engineering"], aliases: ["cloud", "클라우드", "aws", "gcp", "azure", "배포", "vercel", "docker", "인프라", "devops"] },
  { name: "모바일", category: "tech", fields: ["engineering"], aliases: ["모바일", "android", "ios", "flutter", "react native", "앱 개발"] },
  { name: "시스템 설계", category: "tech", fields: ["engineering"], aliases: ["시스템 설계", "아키텍처", "system design", "확장성"] },
  { name: "자동화", category: "tech", fields: ["engineering"], aliases: ["자동화", "automation", "스크립트", "워크플로", "rpa", "매크로"] },
  { name: "기계 / 제조 설계", category: "tech", fields: ["engineering"], aliases: ["cad", "캐드", "solidworks", "인벤터", "도면", "기구 설계", "3d 모델링", "기계 설계"] },
  { name: "전자 / 회로", category: "tech", fields: ["engineering"], aliases: ["회로", "아두이노", "arduino", "라즈베리파이", "pcb", "임베디드", "전자 설계", "센서"] },
  { name: "건축 / 토목 설계", category: "tech", fields: ["engineering"], aliases: ["건축", "토목", "구조 설계", "autocad", "레빗", "revit", "시공", "도시 계획"] },

  // ── 자연·생명 / 의약·보건 ─────────────────────────────────
  { name: "실험 설계", category: "tech", fields: ["science", "medical"], aliases: ["실험", "실험 설계", "프로토콜", "대조군", "실험실", "랩", "시료"] },
  { name: "논문 작성", category: "domain", fields: ["science", "medical", "humanities", "social"], aliases: ["논문", "학술", "초록", "abstract", "학회 발표", "포스터 발표", "레퍼런스"] },
  { name: "통계 분석", category: "tech", fields: ["science", "social", "medical", "business"], aliases: ["통계", "spss", "r 언어", "회귀분석", "유의성", "정량 분석", "sas"] },
  { name: "임상 / 보건 실무", category: "domain", fields: ["medical"], aliases: ["임상", "간호", "병원 실습", "환자", "보건", "약국", "복약", "응급"] },
  { name: "안전 / 품질 관리", category: "domain", fields: ["engineering", "science", "medical"], aliases: ["품질", "qa", "qc", "안전 관리", "gmp", "iso", "위생"] },

  // ── 상경·경영 ─────────────────────────────────────────────
  { name: "마케팅", category: "domain", fields: ["business", "social", "arts"], aliases: ["마케팅", "sns", "홍보", "브랜드", "콘텐츠 마케팅", "광고", "캠페인", "퍼포먼스 마케팅"] },
  { name: "영업 / 세일즈", category: "domain", fields: ["business"], aliases: ["영업", "세일즈", "b2b", "고객 관리", "제안 영업", "crm", "판매"] },
  { name: "회계 / 재무", category: "domain", fields: ["business"], aliases: ["회계", "재무", "재무제표", "원가", "세무", "전산회계", "fat", "회계관리"] },
  { name: "금융 / 투자", category: "domain", fields: ["business"], aliases: ["금융", "투자", "주식", "펀드", "자산 관리", "증권", "은행", "재무 분석", "밸류에이션"] },
  { name: "전략 / 컨설팅", category: "domain", fields: ["business", "social"], aliases: ["전략", "컨설팅", "케이스 스터디", "시장 분석", "비즈니스 모델", "swot", "사업 계획"] },
  { name: "무역 / 물류", category: "domain", fields: ["business"], aliases: ["무역", "물류", "수출", "수입", "통관", "scm", "국제 무역", "포워딩"] },
  { name: "창업", category: "domain", fields: ["business", "engineering", "arts"], aliases: ["창업", "스타트업", "사업 계획", "ir", "린 캔버스", "예비창업"] },

  // ── 인문·어학 / 사회·행정 ─────────────────────────────────
  { name: "편집 / 교정", category: "domain", fields: ["humanities", "arts"], aliases: ["편집", "교정", "교열", "윤문", "출판", "editing"] },
  { name: "번역 / 통역", category: "domain", fields: ["humanities"], aliases: ["번역", "통역", "translation", "자막", "이중언어", "제2외국어", "중국어", "일본어"] },
  { name: "정책 / 행정", category: "domain", fields: ["social"], aliases: ["정책", "행정", "공공", "지자체", "제도", "법령", "민원", "공무원"] },
  { name: "법률 지식", category: "domain", fields: ["social", "business"], aliases: ["법률", "법학", "계약", "규정", "컴플라이언스", "판례", "로스쿨"] },
  { name: "사회 조사", category: "domain", fields: ["social", "humanities"], aliases: ["사회 조사", "설문 설계", "표본", "인구", "정성 조사", "포커스 그룹", "fgi"] },
  { name: "상담 / 사회복지", category: "domain", fields: ["social", "education", "medical"], aliases: ["상담", "사회복지", "케어", "멘토링", "심리", "복지관", "봉사 기획"] },

  // ── 교육 ──────────────────────────────────────────────────
  { name: "교육 / 강의", category: "domain", fields: ["education"], aliases: ["교육", "강의", "수업", "과외", "튜터", "교안", "학습 지도", "멘토"] },
  { name: "커리큘럼 설계", category: "domain", fields: ["education"], aliases: ["커리큘럼", "교육과정", "학습 설계", "교재 개발", "교수법"] },

  // ── 예술·체육 / 미디어 ────────────────────────────────────
  { name: "디자인", category: "domain", fields: ["arts", "engineering"], aliases: ["디자인", "figma", "피그마", "ux", "ui", "브랜딩", "그래픽", "포토샵", "일러스트"] },
  { name: "콘텐츠 제작", category: "domain", fields: ["arts", "humanities", "business"], aliases: ["콘텐츠", "블로그", "카드뉴스", "에디터", "인스타", "숏폼", "썸네일"] },
  { name: "영상 / 사진", category: "domain", fields: ["arts"], aliases: ["영상", "편집", "프리미어", "premiere", "촬영", "사진", "유튜브", "모션", "final cut"] },
  { name: "공연 / 전시 기획", category: "domain", fields: ["arts", "humanities"], aliases: ["공연", "전시", "연출", "무대", "축제", "행사 기획", "큐레이션"] },
  { name: "체육 / 코칭", category: "domain", fields: ["arts", "education"], aliases: ["체육", "코칭", "트레이너", "생활체육", "스포츠", "운동 지도"] },
  { name: "행사 운영", category: "domain", fields: ["arts", "social", "business", "education"], aliases: ["행사", "운영", "부스", "진행", "스태프", "서포터즈", "세미나 운영"] },
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
  /** 이 목표가 속한 계열 (목표 추천에 쓴다) */
  field?: StudyField;
  keywords: string[];
  /** 요구 스킬: 스킬명 → 목표 수준(0~100)과 이유 */
  requirements: Array<{ skill: string; target: number; why: string }>;
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: "ai_engineer",
    field: "engineering",
    label: "AI 엔지니어",
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
    field: "engineering",
    label: "프론트엔드 개발자",
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
    field: "engineering",
    label: "백엔드 개발자",
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
    field: "engineering",
    label: "데이터 분석가",
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
    field: "business",
    label: "서비스 기획 / PM",
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
    field: "business",
    label: "마케터",
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
    field: "arts",
    label: "프로덕트 디자이너",
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
    key: "marketer_brand",
    label: "브랜드 / 광고 기획자",
    field: "business",
    keywords: ["브랜드", "광고", "ae", "카피", "브랜딩", "광고 기획", "대행사"],
    requirements: [
      { skill: "마케팅", target: 75, why: "캠페인 설계의 중심 역량" },
      { skill: "콘텐츠 제작", target: 70, why: "메시지를 실제 결과물로" },
      { skill: "자료 조사", target: 65, why: "타깃·시장 이해" },
      { skill: "기획", target: 70, why: "제안서·캠페인 구조화" },
      { skill: "커뮤니케이션", target: 70, why: "클라이언트 설득" },
      { skill: "데이터 분석", target: 50, why: "성과 측정" },
    ],
  },
  {
    key: "consultant",
    label: "경영 / 전략 컨설턴트",
    field: "business",
    keywords: ["컨설팅", "컨설턴트", "전략", "strategy", "case", "mbb"],
    requirements: [
      { skill: "전략 / 컨설팅", target: 75, why: "문제 구조화가 직무의 본질" },
      { skill: "자료 조사", target: 70, why: "시장·경쟁 분석" },
      { skill: "데이터 분석", target: 65, why: "정량 근거 제시" },
      { skill: "커뮤니케이션", target: 75, why: "발표로 설득" },
      { skill: "엑셀 / 스프레드시트", target: 65, why: "모델링 기본기" },
      { skill: "문제 해결", target: 75, why: "가설 검증 사고" },
    ],
  },
  {
    key: "finance",
    label: "금융 / 재무",
    field: "business",
    keywords: ["금융", "은행", "증권", "재무", "회계", "투자", "ib", "자산운용", "세무"],
    requirements: [
      { skill: "금융 / 투자", target: 70, why: "상품·시장 이해" },
      { skill: "회계 / 재무", target: 75, why: "재무제표 해석은 기본" },
      { skill: "엑셀 / 스프레드시트", target: 70, why: "실무의 절대다수가 스프레드시트" },
      { skill: "데이터 분석", target: 60, why: "정량 판단" },
      { skill: "외국어 (영어)", target: 60, why: "리포트·자격 시험" },
      { skill: "문제 해결", target: 65, why: "리스크 판단" },
    ],
  },
  {
    key: "hr",
    label: "인사 / 조직문화",
    field: "business",
    keywords: ["인사", "hr", "채용", "노무", "조직문화", "hrd", "교육 담당"],
    requirements: [
      { skill: "커뮤니케이션", target: 75, why: "구성원 응대와 면접" },
      { skill: "기획", target: 65, why: "제도·프로그램 설계" },
      { skill: "자료 조사", target: 60, why: "사례·법규 조사" },
      { skill: "법률 지식", target: 55, why: "근로기준·노무 이해" },
      { skill: "데이터 분석", target: 50, why: "인사 데이터 해석" },
      { skill: "교육 / 강의", target: 55, why: "사내 교육 운영" },
    ],
  },
  {
    key: "public",
    label: "공공기관 / 행정",
    field: "social",
    keywords: ["공무원", "공공", "행정", "공기업", "지자체", "정책", "ncs"],
    requirements: [
      { skill: "정책 / 행정", target: 70, why: "제도 이해가 업무의 기본" },
      { skill: "글쓰기", target: 70, why: "보고서·공문 작성" },
      { skill: "자료 조사", target: 65, why: "근거 기반 행정" },
      { skill: "커뮤니케이션", target: 65, why: "민원·협업 대응" },
      { skill: "엑셀 / 스프레드시트", target: 55, why: "통계·예산 처리" },
      { skill: "법률 지식", target: 55, why: "법령 해석" },
    ],
  },
  {
    key: "media",
    label: "언론 / 미디어 / PR",
    field: "humanities",
    keywords: ["기자", "언론", "pr", "홍보", "방송", "미디어", "에디터", "출판"],
    requirements: [
      { skill: "글쓰기", target: 80, why: "직무의 핵심 산출물" },
      { skill: "자료 조사", target: 70, why: "취재·팩트 확인" },
      { skill: "커뮤니케이션", target: 70, why: "인터뷰·섭외" },
      { skill: "콘텐츠 제작", target: 65, why: "채널별 재가공" },
      { skill: "편집 / 교정", target: 60, why: "완성도 관리" },
      { skill: "영상 / 사진", target: 45, why: "멀티미디어 대응" },
    ],
  },
  {
    key: "teacher",
    label: "교사 / 교육 기획",
    field: "education",
    keywords: ["교사", "교육", "임용", "강사", "교육 기획", "에듀", "학원"],
    requirements: [
      { skill: "교육 / 강의", target: 75, why: "가르치는 능력이 곧 실력" },
      { skill: "커리큘럼 설계", target: 70, why: "수업·교재 설계" },
      { skill: "커뮤니케이션", target: 75, why: "학습자·학부모 소통" },
      { skill: "상담 / 사회복지", target: 55, why: "학생 지도" },
      { skill: "콘텐츠 제작", target: 50, why: "학습 자료 제작" },
      { skill: "기획", target: 55, why: "프로그램 운영" },
    ],
  },
  {
    key: "researcher",
    label: "연구원 (자연·공학)",
    field: "science",
    keywords: ["연구원", "대학원", "연구", "석사", "박사", "랩", "r&d"],
    requirements: [
      { skill: "실험 설계", target: 75, why: "연구의 기본 단위" },
      { skill: "논문 작성", target: 70, why: "성과는 글로 남는다" },
      { skill: "통계 분석", target: 65, why: "결과 해석의 근거" },
      { skill: "자료 조사", target: 70, why: "선행 연구 파악" },
      { skill: "외국어 (영어)", target: 65, why: "논문 읽기·쓰기" },
      { skill: "문제 해결", target: 70, why: "실패 원인 분석" },
    ],
  },
  {
    key: "healthcare",
    label: "의료 / 보건",
    field: "medical",
    keywords: ["간호", "병원", "보건", "약사", "임상", "의료", "복지관"],
    requirements: [
      { skill: "임상 / 보건 실무", target: 75, why: "현장 경험이 핵심" },
      { skill: "커뮤니케이션", target: 75, why: "환자·보호자 응대" },
      { skill: "상담 / 사회복지", target: 60, why: "돌봄과 상담" },
      { skill: "안전 / 품질 관리", target: 60, why: "감염·안전 관리" },
      { skill: "자료 조사", target: 50, why: "근거 기반 실무" },
      { skill: "협업", target: 70, why: "다직종 팀 진료" },
    ],
  },
  {
    key: "engineer_mech",
    label: "기계 / 전자 엔지니어",
    field: "engineering",
    keywords: ["기계", "전자", "설비", "제조", "생산", "반도체", "하드웨어", "품질"],
    requirements: [
      { skill: "기계 / 제조 설계", target: 70, why: "도면·설계가 기본 산출물" },
      { skill: "전자 / 회로", target: 60, why: "제어·계측 이해" },
      { skill: "안전 / 품질 관리", target: 65, why: "현장 필수 역량" },
      { skill: "데이터 분석", target: 55, why: "공정 데이터 해석" },
      { skill: "문제 해결", target: 70, why: "불량·고장 원인 분석" },
      { skill: "협업", target: 60, why: "생산·품질 부서 연계" },
    ],
  },
  {
    key: "creator",
    label: "크리에이터 / 영상·디자인",
    field: "arts",
    keywords: ["크리에이터", "영상", "유튜브", "편집자", "포토그래퍼", "촬영", "아트"],
    requirements: [
      { skill: "영상 / 사진", target: 75, why: "결과물의 완성도" },
      { skill: "콘텐츠 제작", target: 75, why: "기획부터 배포까지" },
      { skill: "디자인", target: 60, why: "시각 언어" },
      { skill: "마케팅", target: 55, why: "도달·성장 이해" },
      { skill: "기획", target: 60, why: "시리즈 구성" },
      { skill: "행사 운영", target: 40, why: "촬영 현장 운영" },
    ],
  },
  {
    key: "social_impact",
    label: "사회복지 / 비영리",
    field: "social",
    keywords: ["사회복지", "ngo", "비영리", "봉사", "임팩트", "복지"],
    requirements: [
      { skill: "상담 / 사회복지", target: 75, why: "대상자 이해와 지원" },
      { skill: "행사 운영", target: 65, why: "프로그램 진행" },
      { skill: "기획", target: 65, why: "사업 계획 수립" },
      { skill: "글쓰기", target: 60, why: "사업 보고·제안" },
      { skill: "커뮤니케이션", target: 70, why: "지역·기관 협력" },
      { skill: "자료 조사", target: 55, why: "욕구 조사" },
    ],
  },
  {
    key: "trade",
    label: "무역 / 물류 / MD",
    field: "business",
    keywords: ["무역", "물류", "md", "유통", "구매", "수출입", "커머스"],
    requirements: [
      { skill: "무역 / 물류", target: 70, why: "수출입·공급망 이해" },
      { skill: "외국어 (영어)", target: 70, why: "해외 커뮤니케이션" },
      { skill: "엑셀 / 스프레드시트", target: 70, why: "수급·정산 관리" },
      { skill: "영업 / 세일즈", target: 60, why: "거래처 관리" },
      { skill: "데이터 분석", target: 55, why: "판매 데이터 해석" },
      { skill: "협업", target: 60, why: "부서 간 조율" },
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
  "글쓰기": [
    { title: "내 경험 하나를 1,000자 글로 정리해 공개하기", minutes: 90, effect: 4, reason: "글은 그 자체로 검증 가능한 근거가 됩니다." },
    { title: "지원서 문항 1개를 초안까지 작성해두기", minutes: 60, effect: 2, reason: "미리 써둔 문항은 다음 지원에서 그대로 재사용됩니다." },
  ],
  "자료 조사": [
    { title: "관심 분야 시장·기관 리포트 3건 요약하기", minutes: 120, effect: 3, reason: "조사 결과물은 면접에서 바로 인용할 수 있습니다." },
    { title: "현직자 1명 인터뷰하고 기록 남기기", minutes: 90, effect: 4, reason: "1차 자료는 지원 동기의 설득력을 크게 높입니다." },
  ],
  "통계 분석": [
    { title: "공개 데이터로 분석 리포트 1편 만들기", minutes: 240, effect: 5, reason: "수치를 다뤘다는 증거가 남습니다." },
    { title: "SPSS·R·엑셀 중 하나로 회귀분석 실습하기", minutes: 120, effect: 3, reason: "도구 사용 경험이 곧 지원 자격이 됩니다." },
  ],
  "엑셀 / 스프레드시트": [
    { title: "동아리·팀 예산을 함수로 자동 계산되게 만들기", minutes: 90, effect: 3, reason: "실무에서 가장 많이 쓰는 역량입니다." },
    { title: "컴활 1급 또는 ITQ 시험 접수하기", minutes: 30, effect: 2, reason: "자격증은 서류에서 바로 보이는 근거입니다." },
  ],
  "마케팅": [
    { title: "SNS 채널 하나를 4주간 운영하고 지표 기록하기", minutes: 300, effect: 5, reason: "도달·전환 수치가 있는 경험이 강력합니다." },
    { title: "관심 브랜드 캠페인 분석 글 쓰기", minutes: 90, effect: 2, reason: "분석력을 보여주는 결과물이 남습니다." },
  ],
  "영업 / 세일즈": [
    { title: "학교 행사 협찬·제휴 제안서 1건 보내기", minutes: 120, effect: 4, reason: "실제 제안 경험은 영업 직무의 직접 근거입니다." },
    { title: "판매·부스 운영 경험을 수치로 정리하기", minutes: 60, effect: 2, reason: "매출·전환을 숫자로 말할 수 있게 됩니다." },
  ],
  "회계 / 재무": [
    { title: "전산회계 2급 또는 FAT 시험 접수하기", minutes: 30, effect: 3, reason: "재무 직무 서류의 기본 요건입니다." },
    { title: "관심 기업 재무제표 1개를 읽고 요약하기", minutes: 120, effect: 3, reason: "면접에서 바로 쓰이는 준비입니다." },
  ],
  "금융 / 투자": [
    { title: "모의 포트폴리오를 4주간 운용하고 근거 기록하기", minutes: 180, effect: 4, reason: "판단 근거를 남기면 면접 답변이 됩니다." },
    { title: "증권·은행 자격증(투자자산운용사 등) 일정 확인하기", minutes: 30, effect: 2, reason: "자격은 지원 가능 범위를 넓힙니다." },
  ],
  "전략 / 컨설팅": [
    { title: "케이스 스터디 1건을 슬라이드 5장으로 정리하기", minutes: 180, effect: 4, reason: "구조화 능력을 보여주는 결과물입니다." },
    { title: "교내 공모전에 팀으로 지원하기", minutes: 60, effect: 3, reason: "수상 여부와 무관하게 과정이 근거가 됩니다." },
  ],
  "정책 / 행정": [
    { title: "관심 정책 1건의 문제·대안을 A4 2장으로 쓰기", minutes: 150, effect: 4, reason: "정책 보고서 형식 연습이 그대로 근거가 됩니다." },
    { title: "지자체·공공기관 서포터즈에 지원하기", minutes: 45, effect: 3, reason: "공공 경험은 해당 분야 서류에서 강합니다." },
  ],
  "법률 지식": [
    { title: "관심 분야 판례 3건 요약하기", minutes: 120, effect: 3, reason: "법적 사고를 보여주는 기록이 남습니다." },
    { title: "생활법률·컴플라이언스 온라인 강의 수료하기", minutes: 180, effect: 2, reason: "수료증이 근거가 됩니다." },
  ],
  "교육 / 강의": [
    { title: "30분 분량 수업안을 만들고 한 번 진행하기", minutes: 180, effect: 5, reason: "가르친 경험은 교육 직무의 핵심 근거입니다." },
    { title: "학습 자료(교안·워크시트) 1종 제작하기", minutes: 120, effect: 3, reason: "결과물이 남아 포트폴리오가 됩니다." },
  ],
  "커리큘럼 설계": [
    { title: "4주 커리큘럼 1개를 설계해 문서로 남기기", minutes: 180, effect: 4, reason: "교육 기획 역량을 문서로 증명합니다." },
  ],
  "상담 / 사회복지": [
    { title: "봉사·멘토링 20시간 채우고 기록 남기기", minutes: 300, effect: 4, reason: "지속성이 신뢰를 만듭니다." },
    { title: "상담 사례를 익명으로 정리해 회고 쓰기", minutes: 90, effect: 2, reason: "성찰이 곧 역량 근거입니다." },
  ],
  "실험 설계": [
    { title: "학부 연구생(인턴)에 지원하기", minutes: 60, effect: 5, reason: "랩 경험은 연구 직무의 가장 강한 근거입니다." },
    { title: "실험 프로토콜 1건을 직접 작성해보기", minutes: 120, effect: 3, reason: "설계 능력을 보여줍니다." },
  ],
  "논문 작성": [
    { title: "관심 주제 논문 3편을 읽고 비교 리뷰 쓰기", minutes: 180, effect: 3, reason: "리뷰 글은 학회·대학원 지원에서 쓰입니다." },
    { title: "학부생 학술대회에 초록 제출하기", minutes: 240, effect: 5, reason: "발표 이력이 남습니다." },
  ],
  "임상 / 보건 실무": [
    { title: "실습 사례를 주차별 기록으로 정리하기", minutes: 90, effect: 3, reason: "경험을 말할 수 있게 정리됩니다." },
    { title: "관련 자격(BLS 등) 취득 일정 확인하기", minutes: 30, effect: 2, reason: "현장 지원 요건을 채웁니다." },
  ],
  "안전 / 품질 관리": [
    { title: "산업안전·품질 관련 온라인 교육 수료하기", minutes: 180, effect: 3, reason: "현장 직무의 기본 요건입니다." },
  ],
  "기계 / 제조 설계": [
    { title: "CAD로 부품 1개를 설계해 도면까지 완성하기", minutes: 240, effect: 5, reason: "도면은 그 자체로 포트폴리오입니다." },
  ],
  "전자 / 회로": [
    { title: "아두이노로 센서 프로젝트 1개 만들기", minutes: 240, effect: 4, reason: "동작하는 결과물이 근거가 됩니다." },
  ],
  "건축 / 토목 설계": [
    { title: "설계 공모전에 팀으로 참여하기", minutes: 600, effect: 6, reason: "공모전 출품작이 포트폴리오의 중심이 됩니다." },
  ],
  "디자인": [
    { title: "실제 브랜드를 골라 리디자인 1건 하기", minutes: 240, effect: 4, reason: "과정과 결과를 함께 보여줄 수 있습니다." },
  ],
  "영상 / 사진": [
    { title: "1분 영상 3편을 만들어 채널에 올리기", minutes: 300, effect: 5, reason: "완성 편수가 실력의 증거입니다." },
  ],
  "콘텐츠 제작": [
    { title: "관심 주제로 콘텐츠 4편 연재하기", minutes: 240, effect: 4, reason: "꾸준함이 눈에 보이는 근거가 됩니다." },
  ],
  "공연 / 전시 기획": [
    { title: "소규모 전시·공연을 기획해 실행하기", minutes: 480, effect: 6, reason: "기획부터 운영까지 전 과정이 근거가 됩니다." },
  ],
  "행사 운영": [
    { title: "교내 행사 스태프로 참여하고 역할 기록하기", minutes: 240, effect: 3, reason: "운영 경험은 어느 직무에서나 쓰입니다." },
  ],
  "무역 / 물류": [
    { title: "국제무역사·무역영어 시험 일정 확인하기", minutes: 30, effect: 3, reason: "무역 직무의 기본 자격입니다." },
  ],
  "외국어 (영어)": [
    { title: "토익·오픽 시험 접수하고 목표 점수 정하기", minutes: 30, effect: 3, reason: "대부분의 지원 자격에 직접 반영됩니다." },
    { title: "관심 분야 영어 자료 1편을 요약해 정리하기", minutes: 90, effect: 2, reason: "실사용 근거가 됩니다." },
  ],
  "번역 / 통역": [
    { title: "짧은 글 1편을 번역해 대조본으로 남기기", minutes: 120, effect: 3, reason: "번역 샘플이 포트폴리오가 됩니다." },
  ],
  "편집 / 교정": [
    { title: "동아리 소식지·리포트 편집을 맡아 결과물 남기기", minutes: 180, effect: 3, reason: "편집물은 바로 보여줄 수 있는 근거입니다." },
  ],
  "사회 조사": [
    { title: "설문을 설계해 30명 이상 응답 받고 분석하기", minutes: 240, effect: 4, reason: "조사 전 과정을 경험한 근거가 됩니다." },
  ],
  "창업": [
    { title: "아이디어를 린 캔버스 1장으로 정리하기", minutes: 90, effect: 3, reason: "창업 프로그램 지원의 기본 서류입니다." },
  ],
  "프로젝트 관리": [
    { title: "팀 프로젝트 일정표를 만들어 끝까지 운영하기", minutes: 120, effect: 3, reason: "일정을 지킨 기록이 신뢰가 됩니다." },
  ],
  "체육 / 코칭": [
    { title: "생활체육 지도 경험을 시간·인원과 함께 기록하기", minutes: 120, effect: 3, reason: "지도 경험이 수치로 남습니다." },
  ],
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

/**
 * 계열별 추천 활동.
 * "무엇부터 해야 할지 모르겠다"는 신규 사용자에게 자기 전공에서 흔한
 * 공모전·대외활동·인턴 유형을 먼저 보여준다.
 */
export interface FieldActivityHint {
  /** 활동 유형 (ACTIVITY_TYPES 키) */
  type: ActivityType;
  label: string;
  why: string;
}

export const FIELD_ACTIVITY_HINTS: Record<StudyField, FieldActivityHint[]> = {
  humanities: [
    { type: "contest", label: "글쓰기·번역·에세이 공모전", why: "언어 역량을 심사받은 기록이 남습니다" },
    { type: "external", label: "출판·문화재단 서포터즈", why: "콘텐츠 기획·편집 근거를 쌓을 수 있습니다" },
    { type: "intern", label: "출판·미디어·홍보 인턴", why: "직무 경험이 곧 자소서 소재가 됩니다" },
  ],
  social: [
    { type: "contest", label: "정책 제안·사회문제 해결 공모전", why: "문제 정의와 대안 제시를 증명합니다" },
    { type: "external", label: "공공기관 대학생 기자단·서포터즈", why: "행정·공공 도메인 경험을 얻습니다" },
    { type: "external", label: "학회·사회조사 프로젝트", why: "설문 설계와 데이터 해석 근거가 됩니다" },
  ],
  business: [
    { type: "contest", label: "마케팅·비즈니스 아이디어 공모전", why: "기획서와 수상 실적이 가장 흔한 평가 근거입니다" },
    { type: "external", label: "기업 서포터즈·앰배서더", why: "브랜드 실무와 콘텐츠 제작 경험" },
    { type: "intern", label: "마케팅·영업·재무 인턴", why: "현업 지표를 다뤄본 경험이 차별점입니다" },
  ],
  engineering: [
    { type: "contest", label: "해커톤·아이디어톤", why: "동작하는 결과물이 가장 강한 근거입니다" },
    { type: "project", label: "개인/팀 개발 프로젝트 + 배포", why: "실사용자까지 도달한 경험은 희소합니다" },
    { type: "intern", label: "개발·엔지니어링 인턴", why: "실무 코드베이스 경험" },
  ],
  science: [
    { type: "external", label: "학부연구생(인턴십) · 랩 인턴", why: "실험 설계와 데이터 처리 근거" },
    { type: "contest", label: "학술대회 포스터·논문 경진대회", why: "연구 결과를 발표한 기록이 남습니다" },
    { type: "project", label: "데이터 분석 프로젝트", why: "통계 도구 활용을 증명합니다" },
  ],
  medical: [
    { type: "external", label: "병원·보건소 봉사 및 실습", why: "임상 현장 경험이 지원 동기를 뒷받침합니다" },
    { type: "contest", label: "보건정책·헬스케어 아이디어 공모전", why: "전공 지식을 문제 해결로 연결합니다" },
    { type: "project", label: "건강 캠페인 기획·운영", why: "기획과 커뮤니케이션 근거" },
  ],
  education: [
    { type: "external", label: "교육봉사·멘토링 프로그램", why: "지도 경험이 교직·교육기업의 핵심 근거입니다" },
    { type: "contest", label: "수업 지도안·교육 콘텐츠 공모전", why: "교수 설계 역량을 보여줍니다" },
    { type: "intern", label: "에듀테크·학원 교육기획 인턴", why: "교육 산업 실무 경험" },
  ],
  arts: [
    { type: "contest", label: "디자인·영상·공연 공모전", why: "포트폴리오에 바로 들어가는 결과물" },
    { type: "project", label: "개인 포트폴리오 프로젝트", why: "작업물 자체가 평가 대상입니다" },
    { type: "external", label: "축제·전시 기획 스태프", why: "기획·운영 경험을 함께 쌓습니다" },
  ],
};
