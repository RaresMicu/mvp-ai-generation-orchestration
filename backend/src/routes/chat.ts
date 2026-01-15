import { generateFromLLM } from "../llm/ollamaClient";
import { extractJson } from "../utils/jsonExtractor";
import { validateWorkflow } from "../workflow/validator";
import { WORKFLOW_GENERATOR_PROMPT } from "../llm/prompts";

export async function chatWorkflow(description: string) {
  const prompt = `
${WORKFLOW_GENERATOR_PROMPT}

User description:
${description}
`;

  const raw = await generateFromLLM(prompt);

  let parsed: any = null;
  let error: string | null = null;

  try {
    const jsonText = extractJson(raw);
    parsed = JSON.parse(jsonText);
    validateWorkflow(parsed);
  } catch (err: any) {
    error = err.message;
  }

  return {
    raw,      // raw LLM output
    parsed,   // parsed JSON if valid
    error     // validation error if any
  };
}
