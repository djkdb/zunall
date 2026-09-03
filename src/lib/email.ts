import "server-only";

/**
 * 메일 발송 (선택 기능).
 * RESEND_API_KEY / MAIL_FROM 이 없으면 발송하지 않고 "설정 안 됨"을 알린다.
 * 설정되지 않은 상태에서 "보냈다"고 말하지 않기 위해 호출부에서 이 결과를 그대로 보여준다.
 */
export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;
}

export interface SendResult {
  ok: boolean;
  /** 발송 실패 사유 (사용자에게 그대로 보여주지 않는다) */
  error?: string;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendResult> {
  if (!mailConfigured()) return { ok: false, error: "not_configured" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `status_${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}
