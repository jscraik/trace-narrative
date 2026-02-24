import type { BranchNarrative } from '../types';

export const NARRATIVE_PROMPT_TEMPLATE_ID = 'branch-narrative-v1';
export const NARRATIVE_PROMPT_TEMPLATE_VERSION = '2026-02-24';

const ADVERSARIAL_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  { id: 'ignore_previous_instructions', regex: /\bignore\s+(all|any|previous)\s+instructions\b/i },
  { id: 'reveal_system_prompt', regex: /\b(reveal|print|show)\s+(the\s+)?system\s+prompt\b/i },
  { id: 'exfiltrate_secret', regex: /\b(api[_ -]?key|token|secret|password)\b.{0,30}\b(print|dump|exfiltrat|reveal)\b/i },
  { id: 'disable_safety_guardrails', regex: /\b(disable|bypass|override)\s+(all\s+)?(safety|guardrails?|security)\b/i },
];

export type PromptGovernanceReport = {
  isTemplateVersioned: boolean;
  templateId?: string;
  templateVersion?: string;
  adversarialMatches: string[];
};

export function evaluatePromptGovernance(narrative: BranchNarrative): PromptGovernanceReport {
  const textCorpus = [
    narrative.summary,
    ...narrative.highlights.map((highlight) => highlight.title),
    ...narrative.highlights.map((highlight) => highlight.whyThisMatters),
  ].join('\n');

  const adversarialMatches = ADVERSARIAL_PATTERNS.filter((pattern) =>
    pattern.regex.test(textCorpus)
  ).map((pattern) => pattern.id);

  const templateId = narrative.promptTemplate?.id;
  const templateVersion = narrative.promptTemplate?.version;
  const isTemplateVersioned = Boolean(templateId && templateVersion);

  return {
    isTemplateVersioned,
    templateId,
    templateVersion,
    adversarialMatches,
  };
}
