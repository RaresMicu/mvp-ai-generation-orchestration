import axios from "axios";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL_NAME = process.env.OLLAMA_MODEL || "mistral-workflow";

export async function generateFromLLM(
  prompt: string
): Promise<string> {
  const response = await axios.post(OLLAMA_URL, {
    model: MODEL_NAME,
    prompt,
    stream: false
  });

  return response.data.response;
}

export async function* streamFromLLM(prompt: string): AsyncGenerator<string> {
  const response = await axios.post(OLLAMA_URL, {
    model: MODEL_NAME,
    prompt,
    stream: true
  }, {
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
