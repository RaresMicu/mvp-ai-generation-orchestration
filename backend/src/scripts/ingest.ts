import { VectorStore } from "../rag/VectorStore";

async function main() {
    try {
        const store = new VectorStore();
        await store.ingest();
        console.log("Vector DB Ingestion Successful!");
    } catch (e) {
        console.error("Ingestion Failed:", e);
    }
}

main();
