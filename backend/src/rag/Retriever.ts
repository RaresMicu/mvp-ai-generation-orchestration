import { VectorStore } from "./VectorStore";

export class Retriever {
    private static store = new VectorStore();

    // Find the most relevant tools
    static async findRelevantTools(userRequest: string, limit = 5): Promise<any[]> {
        const results = await this.store.search(userRequest, 'tool', limit);
        return results.map(r => ({
            id: r.id,
            description: r.description,
            schema: JSON.parse(r.metadata)
        }));
    }

    // Find relevant Examples
    static async findRelevantExamples(userRequest: string, limit = 5): Promise<any[]> {
        const results = await this.store.search(userRequest, 'example', limit);
        return results.map(r => ({
            id: r.id,
            description: r.description,
            json: JSON.parse(r.metadata)
        }));
    }

    // Find relevant FAQs
    static async findRelevantFAQs(userRequest: string, limit = 5): Promise<any[]> {
        const results = await this.store.search(userRequest, 'faq', limit);
        return results.map(r => ({
            id: r.id,
            question: r.description,
            answer: JSON.parse(r.metadata).answer
        }));
    }

    // Formatters
    static formatTools(tools: any[]): string {
        return tools.map(t =>
            `- ${t.id}: ${t.description}
  Endpoint: ${t.schema.method} ${t.schema.endpoint}`
        ).join("\n");
    }

    static formatExamples(examples: any[]): string {
        return examples.map(e =>
            `EXAMPLE: ${e.description}
${JSON.stringify(e.json, null, 2)}`
        ).join("\n\n");
    }

    static formatFAQs(faqs: any[]): string {
        return faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
    }
}
