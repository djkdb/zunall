import "server-only";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { getFileExtension } from "@/lib/utils";

export interface ExtractResult {
  ok: boolean;
  text: string;
  error?: string;
}

/**
 * 업로드된 문서에서 텍스트를 추출한다.
 * PDF / DOCX / PPTX / TXT / MD / CSV 지원. 실패해도 앱이 죽지 않도록 항상 결과 객체를 반환.
 */
export async function extractText(buffer: Buffer, filename: string): Promise<ExtractResult> {
  const ext = getFileExtension(filename);
  try {
    switch (ext) {
      case "pdf":
        return { ok: true, text: await extractPdf(buffer) };
      case "docx":
        return { ok: true, text: await extractDocx(buffer) };
      case "pptx":
        return { ok: true, text: await extractPptx(buffer) };
      case "txt":
      case "md":
      case "csv":
        return { ok: true, text: buffer.toString("utf-8") };
      case "zip":
        return { ok: true, text: await extractZipTexts(buffer) };
      default:
        return {
          ok: false,
          text: "",
          error: `${ext.toUpperCase()} 형식은 텍스트 추출을 지원하지 않습니다.`,
        };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, text: "", error: `텍스트 추출 실패: ${message}` };
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // pdf-parse의 index.js는 디버그 모드 분기가 있어 lib를 직접 import한다.
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  const result = await pdfParse(buffer);
  return normalize(result.text);
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return normalize(result.value);
}

/** PPTX: slide XML에서 <a:t> 텍스트 노드를 순서대로 추출 */
async function extractPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0);
      return na - nb;
    });

  const parser = new XMLParser({ ignoreAttributes: true });
  const parts: string[] = [];

  for (const name of slideNames) {
    const xml = await zip.files[name].async("string");
    const doc = parser.parse(xml);
    const texts: string[] = [];
    collectTextNodes(doc, texts);
    if (texts.length > 0) {
      const slideNo = name.match(/slide(\d+)/)?.[1];
      parts.push(`[슬라이드 ${slideNo}]\n${texts.join("\n")}`);
    }
  }
  return normalize(parts.join("\n\n"));
}

/** XML 트리에서 a:t 키의 텍스트를 재귀 수집 */
function collectTextNodes(node: unknown, out: string[]): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectTextNodes(item, out);
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "a:t") {
      if (typeof value === "string" || typeof value === "number") {
        out.push(String(value));
      } else if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === "string" || typeof v === "number") out.push(String(v));
        }
      }
    } else {
      collectTextNodes(value, out);
    }
  }
}

/** ZIP 내부의 텍스트 계열 파일들(txt/md/csv)을 모아서 추출 */
async function extractZipTexts(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const parts: string[] = [];
  const names = Object.keys(zip.files).filter(
    (n) => !zip.files[n].dir && /\.(txt|md|csv)$/i.test(n),
  );
  for (const name of names.slice(0, 20)) {
    const content = await zip.files[name].async("string");
    parts.push(`[${name}]\n${content}`);
  }
  if (parts.length === 0) {
    throw new Error("ZIP 안에서 추출 가능한 텍스트 파일(txt/md/csv)을 찾지 못했습니다.");
  }
  return normalize(parts.join("\n\n"));
}

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/** 텍스트 추출 가능한 확장자인지 */
export function isExtractable(filename: string): boolean {
  return ["pdf", "docx", "pptx", "txt", "md", "csv", "zip"].includes(
    getFileExtension(filename),
  );
}
