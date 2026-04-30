import axios from "axios";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL_NAME = process.env.OLLAMA_MODEL || "mistral-workflow";

export async function generateFromLLM(
  prompt: string,
  schema?: any
): Promise<string> {
  const payload: any = {
    model: MODEL_NAME,
    prompt,
    stream: false,
    options: {
      temperature: 0.1, // Safe temperature for generation
      repeat_penalty: 1.1, // Back to default: high penalty was forcing it to prematurely close the JSON
      top_p: 0.9,
      num_predict: 800,
      stop: ["```", "###", "Instruction:"]
    }
  };

  if (schema) {
    // Deep clone and clean the schema so Ollama's grammar engine accepts it natively
    const cleanSchema = JSON.parse(JSON.stringify(schema));
    delete cleanSchema.$schema;
    if (cleanSchema.additionalProperties !== undefined) {
      delete cleanSchema.additionalProperties;
    }
    // Force Ollama to strictly adhere to the schema (which requires 'dependencies' array)
    payload.format = cleanSchema;
  }

  const response = await axios.post(OLLAMA_URL, payload);

  return response.data.response;
}

export async function* streamFromLLM(prompt: string, schema?: any): AsyncGenerator<string> {
  const payload: any = {
    model: MODEL_NAME,
    prompt,
    stream: true,
    options: {
      temperature: 0.1,
      repeat_penalty: 1.1,
      top_p: 0.9,
      num_predict: 800,
      stop: ["```", "###", "Instruction:"]
    }
  };

  if (schema) {
    const cleanSchema = JSON.parse(JSON.stringify(schema));
    delete cleanSchema.$schema;
    if (cleanSchema.additionalProperties !== undefined) {
      delete cleanSchema.additionalProperties;
    }
    payload.format = cleanSchema;
  }

  const response = await axios.post(OLLAMA_URL, payload, {
    responseType: 'stream'
  });

  const stream = response.data;

  // Buffer for partial JSON chunks
  let buffer = '';

  for await (const chunk of stream) {
    buffer += chunk.toString();

    // Split by newlines to handle NDJSON
    const lines = buffer.split('\n');

    // Keep the last line in buffer as it might be incomplete
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const json = JSON.parse(line);
          if (json.response) yield json.response;
          if (json.done) return;
        } catch (e) {
          console.warn("Failed to parse chunk:", line);
        }
      }
    }
  }
}
