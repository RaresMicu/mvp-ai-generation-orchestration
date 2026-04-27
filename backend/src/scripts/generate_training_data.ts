import { ToolService } from "../rag/ToolService";
import { generateFromLLM } from "../llm/ollamaClient";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_FILE = path.join(__dirname, "../../train.jsonl");

// Prompt to generate a synthetic example
const GENERATOR_PROMPT = (tools: string, complexity: 'simple' | 'complex') => `
You are a synthetic data generator.
I will provide you with a list of API Tools.
You must generate ONE valid training example in JSON format.

Tools:
${tools}

Task:
1. Invent a realistic user request.
   ${complexity === 'complex' ? '- MUST involve parallel execution (Diamond Pattern).\n   - E.g., One task triggers two parallel tasks, which then converge to a final task.\n   - May include a failure branch using condition: "failure".' : '- A standard sequential or simple linear flow.\n   - May include a failure branch using condition: "failure".'}
2. Create the corresponding VALID JSON workflow for it.

CRITICAL: You MUST use this EXACT structure:
{
  "workflow": {
    "name": "string",
    "entrypoint": "string",
    "activities": [
      {
        "id": "string",
        "type": "http_call",
        "method": "GET | POST | PUT | DELETE",
        "endpoint": "string",
        "parallel_group": "string | null",
        "retry_policy": {
          "maximum_attempts": "integer",
          "initial_interval_seconds": "integer"
        },
        "timeout_seconds": "integer"
      }
    ],
    "dependencies": [
      {
        "from": "string",
        "to": "string",
        "condition": "success | failure"
      }
    ]
  }
}

Output strictly valid JSON with NO markdown:
{
    "instruction": "Generate a workflow JSON from the request.",
    "input": "The user request",
    "output": "The compact minified JSON string of the workflow"
}
`;

async function run() {
    const tools = ToolService.getAllTools();
    const toolsContext = tools.map(t => `- ${t.id}: ${t.description}`).join("\n");

    console.log("Generating synthetic training data... (This may take a while)");
    const stream = fs.createWriteStream(OUTPUT_FILE, { flags: 'a' });

    // Generate 5 Simple Examples
    for (let i = 0; i < 5; i++) {
        process.stdout.write(`Generating simple example ${i + 1}/5... `);
        await generateAndWrite(toolsContext, 'simple', stream);
    }

    // Generate 5 Complex Examples (Diamond/Parallel)
    for (let i = 0; i < 5; i++) {
        process.stdout.write(`Generating COMPLEX example ${i + 1}/5... `);
        await generateAndWrite(toolsContext, 'complex', stream);
    }

    stream.end();
    console.log(`\nSuccess! Data saved to ${OUTPUT_FILE}`);
}

async function generateAndWrite(toolsContext: string, complexity: 'simple' | 'complex', stream: fs.WriteStream) {
    try {
        const prompt = GENERATOR_PROMPT(toolsContext, complexity);
        const raw = await generateFromLLM(prompt);

        // Clean up potentially markdown-wrapped JSON
        const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(clean);

        // Ensure output is stringified JSON as expected by Alpaca format
        if (typeof parsed.output === 'object') {
            parsed.output = JSON.stringify(parsed.output);
        }

        stream.write(JSON.stringify(parsed) + "\n");
        console.log("Done.");
    } catch (e) {
        console.log("Failed (skipping):", e);
    }
}

run();
