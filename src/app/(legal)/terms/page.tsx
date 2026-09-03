import type { Metadata } from "next";

export const metadata: Metadata = { title: "이용약관" };

/** 시행일 — 내용을 고치면 이 날짜도 함께 올린다 */
const TERMS_EFFECTIVE_DATE = "2026-09-03";

export default function TermsPage() {
  const contactEmail = process.env.CONTACT_EMAIL;
  return (
    <>
      <h1 className="mb-1 text-xl font-bold tracking-tight">이용약관</h1>
      <p className="mb-6 text-xs text-muted-foreground">시행일: {TERMS_EFFECTIVE_DATE}</p>

      <Section title="제1조 (목적)">
        이 약관은 Cavero(이하 &quot;서비스&quot;)를 이용하는 데 필요한 조건과 절차, 이용자와 운영자의
        권리·의무를 정합니다.
      </Section>

      <Section title="제2조 (서비스 내용)">
        서비스는 공모전·대외활동·인턴 등 대학생 활동을 기록하고, 이용자가 입력한 내용을 바탕으로
        준비 상태를 정리해 보여줍니다. AI 기능은 이용자가 등록한 공고문·제출물 등을 분석해 참고
        의견을 제공합니다.
        <Callout>
          AI가 계산하는 점수와 의견은 <strong>합격 가능성을 예측하지 않으며</strong>, 참고 자료일
          뿐입니다. 지원 여부와 제출 내용에 대한 최종 판단과 책임은 이용자에게 있습니다.
        </Callout>
      </Section>

      <Section title="제3조 (계정)">
        <ul className="ml-4 list-disc space-y-1">
          <li>이메일 또는 구글 계정으로 가입할 수 있습니다.</li>
          <li>계정 정보는 본인이 관리해야 하며, 타인에게 빌려주거나 양도할 수 없습니다.</li>
          <li>이용자는 언제든지 설정 화면에서 계정을 삭제할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="제4조 (이용자가 올린 자료)">
        이용자가 올린 공고문·제출물·메모 등의 저작권은 이용자에게 있습니다. 운영자는 서비스를
        제공하는 데 필요한 범위(저장, 화면 표시, 이용자가 요청한 AI 분석)에서만 이 자료를
        처리합니다. 계정을 삭제하면 해당 자료도 함께 삭제됩니다.
      </Section>

      <Section title="제5조 (금지 행위)">
        <ul className="ml-4 list-disc space-y-1">
          <li>타인의 개인정보나 권리를 침해하는 자료를 올리는 행위</li>
          <li>서비스를 자동화된 방법으로 과도하게 호출해 운영을 방해하는 행위</li>
          <li>다른 이용자의 계정에 무단으로 접근하려는 행위</li>
        </ul>
      </Section>

      <Section title="제6조 (서비스의 중단·변경)">
        운영자는 서비스의 내용을 변경하거나 제공을 중단할 수 있습니다. 중단이 예정된 경우
        가능한 범위에서 미리 알리고, 이용자가 자기 자료를 내려받을 수 있도록 안내합니다.
        (설정 화면의 &quot;데이터 백업&quot;에서 언제든 내려받을 수 있습니다.)
      </Section>

      <Section title="제7조 (면책)">
        서비스는 있는 그대로 제공됩니다. 천재지변, 외부 서비스 장애 등 운영자의 통제를 벗어난
        사유로 발생한 손해에 대해서는 책임을 지지 않습니다. 다만 운영자의 고의 또는 중대한
        과실로 인한 손해는 그러하지 않습니다.
      </Section>

      <Section title="제8조 (약관의 변경)">
        약관이 바뀌면 시행일과 함께 이 화면에 공지합니다. 변경된 약관에 동의하지 않는 경우
        계정을 삭제하고 이용을 중단할 수 있습니다.
      </Section>

      <Section title="제9조 (문의)">
        {contactEmail ? (
          <>
            문의: <a className="text-primary hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </>
        ) : (
          "서비스 이용과 관련한 문의는 운영자에게 연락해주세요."
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

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 rounded-md border-l-2 border-primary bg-secondary/60 px-3 py-2 text-sm">
      {children}
    </p>
  );
}
