import * as lancedb from "vectordb";
import axios from "axios";
import { ToolService } from "./ToolService";
import faqData from "./knowledge/faq.json";
import exampleData from "./knowledge/examples.json";
import path from "path";

const OLLAMA_EMBED_URL = "http://localhost:11434/api/embeddings";
const DB_PATH = path.join(__dirname, "../../../.lancedb");

export interface RAGItem {
    id: string;
    description: string; // The text to embed
    type: 'tool' | 'faq' | 'example';
    metadata: string; // JSON string of extra data (schema, answer, full json)
}

export class VectorStore {
    private db: lancedb.Connection | null = null;
    private table: lancedb.Table | null = null;

    async connect() {
        if (this.db) return;
        this.db = await lancedb.connect(DB_PATH);
    }

    async getEmbeddings(text: string): Promise<number[]> {
        try {
            const res = await axios.post(OLLAMA_EMBED_URL, {
                model: "nomic-embed-text",
                prompt: text,
                stream: false
            });
            return res.data.embedding;
        } catch (e: any) {
            console.error("Failed to get embeddings from Ollama.", e.message);
            throw e;
        }
    }

    async ingest() {
        await this.connect();

        const items: RAGItem[] = [];

        // 1. Ingest Tools
        const tools = ToolService.getAllTools();
        console.log(`Processing ${tools.length} Tools...`);
        for (const t of tools) {
            items.push({
                id: t.id,
                description: t.description,
                type: 'tool',
                metadata: JSON.stringify(t.schema)
            });
        }

        // 2. Ingest FAQs
        console.log(`Processing ${faqData.length} FAQs...`);
        for (const f of faqData) {
            items.push({
                id: f.id,
                description: f.question, // Embed the question
                type: 'faq',
                metadata: JSON.stringify({ answer: f.answer })
            });
        }

        // 3. Ingest Examples
        console.log(`Processing ${exampleData.length} Examples...`);
        for (const e of exampleData) {
            items.push({
                id: e.id,
                description: e.description, // Embed the description
                type: 'example',
                metadata: JSON.stringify(e.json)
            });
        }

        console.log(`Calculating embeddings for ${items.length} total items...`);
        const data = [];
        for (const item of items) {
            const vector = await this.getEmbeddings(item.description);
            data.push({ ...item, vector });
        }

        if (this.db) {
            try { await this.db.dropTable("knowledge_base"); } catch (e) { }
            this.table = await this.db.createTable("knowledge_base", data);
        }
        console.log("Ingestion complete.");
    }

    async search(query: string, type?: 'tool' | 'faq' | 'example', limit = 3): Promise<RAGItem[]> {
        await this.connect();
        if (!this.table && this.db) {
            try {
                this.table = await this.db.openTable("knowledge_base");
            } catch (e) {
                await this.ingest();
            }
        }
        if (!this.table) throw new Error("Failed to open table");

        const queryVector = await this.getEmbeddings(query);
        let builder = this.table.search(queryVector).limit(limit);

        if (type) {
            builder = builder.where(`type = '${type}'`);
        }

        const results = await builder.execute();
        return results as unknown as RAGItem[];
    }
}
