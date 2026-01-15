import { Connection, Client } from "@temporalio/client";

export async function startWorkflow(definition: any) {
  const connection = await Connection.connect();
  const client = new Client({ connection });

  return client.workflow.start("orchestrationWorkflow", {
    taskQueue: "orchestration-queue",
    workflowId: `wf-${Date.now()}`,
    args: [definition]
  });
}
