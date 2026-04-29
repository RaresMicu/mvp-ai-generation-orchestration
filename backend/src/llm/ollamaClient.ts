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
      temperature: 0.1, // Slight temperature to prevent argmax loops
      repeat_penalty: 1.2, // Penalize repeating the same activities
      top_p: 0.9,
      stop: ["```", "###", "Instruction:"]
    }
  };

  if (schema) {
    // It seems Ollama's grammar engine is silently rejecting the complex Zod schema
    // and falling back to text mode (which is why you see ```json).
    // Setting format to "json" guarantees a clean JSON output without markdown.
    payload.format = "json";
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
      repeat_penalty: 1.2,
      top_p: 0.9,
      stop: ["```", "###", "Instruction:"]
    }
  };

  if (schema) {
    payload.format = "json";
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
