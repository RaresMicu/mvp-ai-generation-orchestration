import { generateFromLLM } from "../llm/ollamaClient";
import { extractJson } from "../utils/jsonExtractor";
import { validateWorkflow } from "../workflow/validator";
import { WORKFLOW_GENERATOR_PROMPT } from "../llm/prompts";
import { Retriever } from "../rag/Retriever";

export async function chatWorkflow(description: string) {
  // 1. RAG Retrieval
  const tools = await Retriever.findRelevantTools(description);
  const examples = await Retriever.findRelevantExamples(description);
  const faqs = await Retriever.findRelevantFAQs(description);

  const toolsContext = Retriever.formatTools(tools);
  const examplesContext = Retriever.formatExamples(examples);
  const faqContext = Retriever.formatFAQs(faqs);

  const prompt = `Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
${WORKFLOW_GENERATOR_PROMPT(toolsContext, examplesContext, faqContext)}

### Input:
${description}

### Response:
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
