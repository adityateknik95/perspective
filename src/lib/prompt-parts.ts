// Prompts mark emphasis with *asterisks* (see prompts.ts). Split into plain
// and emphasised runs so components can render <em> without
// dangerouslySetInnerHTML.
export type PromptPart = { text: string; em: boolean };

export function promptParts(prompt: string): PromptPart[] {
  return prompt
    .split(/(\*[^*]+\*)/g)
    .filter((s) => s.length > 0)
    .map((s) =>
      s.startsWith("*") && s.endsWith("*") && s.length > 2
        ? { text: s.slice(1, -1), em: true }
        : { text: s, em: false },
    );
}
