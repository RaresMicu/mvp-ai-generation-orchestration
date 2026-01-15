import { Retriever } from "../rag/Retriever";

async function run() {
    const query = "How is this platform working?";
    console.log(`Testing Retrieval for: "${query}"`);

    console.log("--- FAQs ---");
    const faqs = await Retriever.findRelevantFAQs(query);
    console.log(JSON.stringify(faqs, null, 4));

    console.log("--- Tools ---");
    const tools = await Retriever.findRelevantTools(query);
    console.log(tools.map(t => t.id).join(", "));
}

run();
