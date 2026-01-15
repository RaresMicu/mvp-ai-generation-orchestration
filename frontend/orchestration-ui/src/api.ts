import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3001"
});

export async function generateWorkflow(description: string) {
  return api.post("/generate-workflow", { description });
}

export async function generateTemporalCode(workflow: any) {
  return api.post("/generate-temporal-code", workflow);
}
