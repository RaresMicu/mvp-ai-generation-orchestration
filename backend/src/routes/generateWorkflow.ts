import { generateFromLLM, streamFromLLM } from "../llm/ollamaClient";
import { WORKFLOW_GENERATOR_PROMPT } from "../llm/prompts";
import { extractJson } from "../utils/jsonExtractor";
import { validateWorkflow } from "../workflow/validator";
import { normalizeWorkflow } from "../temporal/workflows/workflowNormalizer";
import { FastifyInstance } from "fastify";
import { startWorkflow } from "../temporal/client";
import { Retriever } from "../rag/Retriever";

export async function generateWorkflow(description: string) {
  // 1. RAG Retrieval
  const tools = await Retriever.findRelevantTools(description);
  const examples = await Retriever.findRelevantExamples(description);
  const faqs = await Retriever.findRelevantFAQs(description);

  const toolsContext = Retriever.formatTools(tools);
  const examplesContext = Retriever.formatExamples(examples);
  const faqContext = Retriever.formatFAQs(faqs);

  console.log(`RAG: ${tools.length} tools, ${examples.length} examples, ${faqs.length} FAQs`);

  // 2. Dynamic Prompt Construction (Alpaca Format for Fine-Tuned Model)
  const prompt = `Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
${WORKFLOW_GENERATOR_PROMPT(toolsContext, examplesContext, faqContext)}

### Input:
${description}

### Response:
`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await generateFromLLM(prompt);
      const jsonText = extractJson(raw);
      const parsed = JSON.parse(jsonText);

      const normalized = normalizeWorkflow(parsed);

      return validateWorkflow(normalized);
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
}

export async function registerGenerateWorkflow(fastify: FastifyInstance) {

  // 0️⃣ Streaming Generation Endpoint
  fastify.post("/generate-workflow-stream", async (request, reply) => {
    const { description } = request.body as { description: string };

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

    // Set headers for streaming
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");

    try {
      // 2. Stream from LLM with Context
      for await (const chunk of streamFromLLM(prompt)) {
        const payload = JSON.stringify({ chunk });
        reply.raw.write(`data: ${payload}\n\n`);
      }

      // End signal
      reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      reply.raw.end();

    } catch (err: any) {
      console.error("Streaming error:", err);
      reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      reply.raw.end();
    }
  });

  // 1️⃣ Generate ONLY (returns JSON)
  fastify.post("/generate-workflow", async (request, reply) => {
    try {
      const { description } = request.body as { description: string };
      const workflowDef = await generateWorkflow(description);

      if (!workflowDef) {
        throw new Error("Failed to generate workflow definition from LLM");
      }

      return {
        definition: workflowDef.workflow,
        manualFields: workflowDef.manualFields,
        message: "Workflow generated successfully. Review and run."
      };
    } catch (err: any) {
      console.error(err);
      reply.status(500).send({ error: err.message || "Failed to generate workflow" });
    }
  });

  // 2️⃣ Run Existing Definition
  fastify.post("/run-workflow", async (request, reply) => {
    try {
      const workflowDef = request.body as any; // The full definition object

      // Wrap it back in the structure expected by the worker if needed, 
      // or just pass it directly if the worker expects the full object.
      // The generateWorkflow return structure was { workflow: ..., manualFields: ... }
      // So we expect the frontend to send that back.

      const run = await startWorkflow(workflowDef);

      return {
        workflowId: run.workflowId,
        runId: run.firstExecutionRunId,
        message: "Workflow started successfully"
      };
    } catch (err: any) {
      console.error(err);
      reply.status(500).send({ error: err.message || "Failed to run workflow" });
    }
  });

  // 3️⃣ Simulated Persistence (In-Memory for now)
  let savedWorkflows: any[] = [];

  fastify.post("/workflows", async (request, reply) => {
    const workflow = request.body as any;
    workflow.id = `wf-saved-${Date.now()}`;
    workflow.savedAt = new Date().toISOString();
    savedWorkflows.push(workflow);
    return { message: "Workflow saved", id: workflow.id };
  });

  fastify.get("/workflows", async (request, reply) => {
    return savedWorkflows;
  });

  fastify.delete("/workflows/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    savedWorkflows = savedWorkflows.filter(w => w.id !== id);
    return { message: "Deleted" };
  });
}
