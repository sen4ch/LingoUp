/**
 * Canonical form for comparing typed answers: case, surrounding punctuation, extra spaces
 * and typographic apostrophes do not make an answer wrong.
 */
export function normalizeAnswer(answer: string): string {
  return answer
    .normalize('NFC')
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.,!?;:"]+|[.,!?;:"]+$/g, '')
    .trim();
}
