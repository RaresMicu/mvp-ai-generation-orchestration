import Fastify from "fastify";
import cors from "@fastify/cors";
import { chatWorkflow } from "./routes/chat";
import { generateFromLLM } from "./llm/ollamaClient";
import { registerGenerateWorkflow } from "./routes/generateWorkflow";
import { generateTemporalCode } from "./routes/generateTemporalCode";

const server = Fastify({ logger: true });

const start = async () => {
  try {
    await server.register(cors, {
      origin: true, // allow all origins (OK for dev)
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    });

    server.get("/health", async () => {
      return { status: "ok" };
    });

    server.post("/test-llm", async (req, reply) => {
      const result = await generateFromLLM("Return a JSON with hello world");
      return { result };
    });

    await registerGenerateWorkflow(server);

    server.post("/generate-temporal-code", async (req: any) => {
      return {
        code: generateTemporalCode(req.body)
      };
    });

    server.post("/chat", async (req: any) => {
      return await chatWorkflow(req.body.description);
    });

    // --- MOCK API ENDPOINTS for Workflow Execution ---
    server.get("/users/:id", async (req, reply) => {
      const { id } = req.params as any;
      return { id, name: "John Doe", email: "john@example.com", riskLevel: "low" };
    });

    server.get("/fraud-scores/:id", async (req, reply) => {
      return { fraudScore: 12, status: "safe" };
    });

    server.post("/enrich/:id", async (req, reply) => {
      return { enriched: true, socialScore: 85, lastLogin: new Date().toISOString() };
    });

    server.post("/audit-logs", async (req, reply) => {
      console.log("AUDIT LOG:", req.body);
      return { logged: true, timestamp: Date.now() };
    });

    // Mock endpoint for Bot Answers (from RAG)
    server.post("/answer", async (request, reply) => {
      const body = request.body as any;
      return { status: "success", type: "bot_answer", ...body };
    });
    // -------------------------------------------------

    await server.listen({ port: 3001 });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
