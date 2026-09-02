/**
 * 주석을 제거하고 세미콜론 단위로 나눈다.
 * DO $$ ... $$ 블록 안의 세미콜론은 문장 구분이 아니므로 건너뛴다.
 */
export function splitStatements(text: string): string[] {
  const cleaned = text
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements: string[] = [];
  let current = "";
  let inDollar = false;

  for (let i = 0; i < cleaned.length; i++) {
    const two = cleaned.slice(i, i + 2);
    if (two === "$$") {
      inDollar = !inDollar;
      current += two;
      i++;
      continue;
    }
    const char = cleaned[i];
    if (char === ";" && !inDollar) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}
