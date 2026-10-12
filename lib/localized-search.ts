import { suggestTools } from './tool-search';
import type { ToolDefinition } from './tool-catalog';

const englishIntents: Record<string, string[]> = {
  compress: ['make pdf smaller', 'reduce file size', 'compress scans'],
  merge: ['combine pdfs', 'join pdfs', 'merge documents'],
  ocr: ['extract text', 'recognize text', 'searchable pdf', 'read scan'],
  'pdf-word': ['pdf to docx', 'pdf to word'],
  'office-pdf': ['word to pdf', 'docx to pdf', 'excel to pdf', 'powerpoint to pdf'],
  'to-images': ['pdf to jpg', 'pdf to png'],
  images: ['jpg to pdf', 'png to pdf', 'photos to pdf'],
  organize: ['delete page', 'remove pages', 'reorder pages', 'rotate pages'],
  'search-redact': ['find sensitive text'],
  redact: ['black out text', 'hide personal data'],
};
type Tool = ToolDefinition;
export function searchTools(query: string, localizedTools: Tool[]): Tool[] {
  const original = suggestTools(query);
  const normalized = query
    .toLocaleLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, ' ');
  if (!normalized) return [];
  const intent = normalized
    .split(' ')
    .filter((word) => !['i', 'want', 'a', 'the', 'my', 'please'].includes(word))
    .join(' ');
  const words = normalized
    .split(' ')
    .filter((word) => !['i', 'want', 'to', 'a', 'the', 'my', 'please', 'pdf'].includes(word));
  const ranked = localizedTools
    .map((tool) => {
      const title = tool.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
      const aliases = englishIntents[tool.id] ?? [];
      const score =
        title === normalized
          ? 1000
          : aliases.some((alias) => intent.includes(alias))
            ? 900
            : title.startsWith(normalized)
              ? 750
              : words.length &&
                  words.every((word) => title.split(' ').some((part) => part.startsWith(word)))
                ? 500
                : 0;
      return { tool, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const ids = [
    ...new Set([...ranked.map((item) => item.tool.id), ...original.map((tool) => tool.id)]),
  ];
  return ids.map((id) => localizedTools.find((tool) => tool.id === id)!);
}
