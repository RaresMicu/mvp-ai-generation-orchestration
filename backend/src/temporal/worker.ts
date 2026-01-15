import { Worker } from "@temporalio/worker";
import * as activities from "./activities";

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve("./workflows/workflow"),
    activities,
    taskQueue: "orchestration-queue"
  });

  await worker.run();
}

run();
