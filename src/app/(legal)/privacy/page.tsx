import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보처리방침" };

const PRIVACY_EFFECTIVE_DATE = "2026-10-06";

/**
 * 실제로 이 코드가 저장·전송하는 항목만 적는다.
 * 기능을 추가해 수집 항목이 늘어나면 이 문서도 함께 고쳐야 한다.
 */
export default function PrivacyPage() {
  const contactEmail = process.env.CONTACT_EMAIL;
  return (
    <>
      <h1 className="mb-1 text-xl font-bold tracking-tight">개인정보처리방침</h1>
      <p className="mb-6 text-xs text-muted-foreground">시행일: {PRIVACY_EFFECTIVE_DATE}</p>

      <Section title="1. 수집하는 정보">
        <Table
          rows={[
            ["계정", "이메일, 이름, 비밀번호(복호화 불가능한 형태로 저장)"],
            ["구글 로그인 시", "구글 계정 식별자, 이메일, 이름, 프로필 사진 주소"],
            ["이용자가 입력한 내용", "활동·일정·작업·메모, 업로드한 공고문·제출물 파일과 그 텍스트"],
            ["커리어 정보", "목표 직무, 전공 계열·학과, 스킬, 근거(활동 기록에서 뽑은 것)"],
            ["모의 면접", "질문, 내가 쓰거나 말한 답변(음성은 브라우저가 글자로 바꾸며 소리는 저장하지 않음), 점수와 피드백. 서류 기반 면접에 쓴 자기소개서 원문은 면접이 끝나면 기록에서 지웁니다."],
            ["의견 보내기", "보낸 내용과 보낸 화면의 주소. 답장 받기를 고른 경우에만 이메일"],
            ["보안", "로그인 실패·재설정 메일 요청 횟수와, Cloudflare 가 알려주는 접속 IP (남용 방지용, 하루 뒤 삭제)"],
            ["알림", "브라우저 푸시 구독 정보 (기기별 주소와 공개키)"],
            ["접속 유지", "로그인 세션 토큰 (쿠키)"],
          ]}
        />
        <p className="mt-2">
          별도의 광고 식별자나 위치 정보는 수집하지 않으며, 외부 분석 도구도 넣지 않았습니다.
        </p>
      </Section>

      <Section title="2. 이용 목적">
        <ul className="ml-4 list-disc space-y-1">
          <li>로그인과 본인 자료 표시</li>
          <li>마감 알림 발송</li>
          <li>이용자가 요청한 AI 분석(공고 분석, 제출물 평가, 자기소개서 첨삭, 모의 면접) 처리</li>
          <li>비밀번호 대입·메일 남용 같은 부정 이용 방지</li>
          <li>이용자가 보낸 의견을 읽고 서비스 개선</li>
        </ul>
      </Section>

      <Section title="3. 외부로 나가는 정보">
        <Table
          rows={[
            ["AI 분석", "이용자가 분석을 실행한 문서의 텍스트가 AI 제공자(Anthropic)로 전송됩니다. 실행하지 않으면 전송되지 않습니다."],
            ["모의 면접", "AI 면접관을 쓰는 경우 질문과 답변, 고른 직무·기업, (선택 시) 이메일·전화번호·링크를 가린 자기소개서가 AI 제공자(Anthropic)로 전송됩니다. 이름은 보내지 않습니다."],
            ["말로 답하기", "마이크로 답할 때 소리는 브라우저(예: 크롬)의 음성 인식 서비스가 글자로 바꿉니다. 이 서비스로 소리가 오지 않습니다."],
            ["구글 로그인", "구글 계정 확인 과정에서 구글과 통신합니다."],
            ["공고 링크 가져오기", "이용자가 입력한 주소의 웹사이트에 접속해 내용을 읽어옵니다."],
            ["메일 발송", "비밀번호 재설정 메일을 보낼 때 메일 발송 서비스에 이메일 주소가 전달됩니다."],
          ]}
        />
        <p className="mt-2 text-xs">
          위 항목은 모두 이용자의 동작(버튼 클릭, 링크 입력)으로만 발생합니다.
        </p>
      </Section>

      <Section title="4. 보관 기간과 삭제">
        <ul className="ml-4 list-disc space-y-1">
          <li>계정이 유지되는 동안 보관합니다.</li>
          <li>
            설정 화면에서 <strong>계정을 삭제하면</strong> 활동·문서·파일·커리어 기록·알림 구독을
            포함한 모든 자료가 즉시 삭제되며 복구할 수 없습니다.
          </li>
          <li>개별 활동이나 문서는 언제든 따로 삭제할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="5. 이용자의 권리">
        <ul className="ml-4 list-disc space-y-1">
          <li>내 자료 열람·수정: 각 화면에서 직접 할 수 있습니다.</li>
          <li>내려받기: 설정 &gt; 데이터 백업에서 전체 자료를 파일로 받을 수 있습니다.</li>
          <li>삭제: 설정 &gt; 계정 삭제에서 즉시 처리됩니다.</li>
        </ul>
      </Section>

      <Section title="6. 안전 조치">
        <ul className="ml-4 list-disc space-y-1">
          <li>비밀번호는 scrypt 로 해싱해 저장하며 원문을 보관하지 않습니다.</li>
          <li>모든 조회·수정은 로그인한 본인의 자료로만 제한됩니다.</li>
          <li>통신은 HTTPS 로 암호화됩니다.</li>
        </ul>
      </Section>

      <Section title="7. 문의">
        {contactEmail ? (
          <>
            문의: <a className="text-primary hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </>
        ) : (
          "개인정보와 관련한 문의는 운영자에게 연락해주세요."
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-1.5 text-sm font-semibold">{title}</h2>
      <div className="text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-1 space-y-1.5">
      {rows.map(([term, description]) => (
        <div key={term} className="grid grid-cols-[7rem_1fr] gap-2">
          <dt className="text-xs font-medium text-foreground">{term}</dt>
          <dd className="text-sm">{description}</dd>
        </div>
      ))}
    </dl>
  );
}
