import { z } from "zod";

export const ActivitySchema = z.object({
  id: z.string(),
  type: z.literal("http_call"),
  method: z.enum(["GET", "POST"]),
  endpoint: z.string(),
  parallelGroup: z.string().nullable().optional(),
  retryPolicy: z
    .object({
      maxAttempts: z.number(),
      backoffSeconds: z.number()
    })
    .nullable(),
  timeoutSeconds: z.number().nullable()
});

export const WorkflowSchema = z.object({
  workflow: z.object({
    name: z.string(),
    entrypoint: z.string(),
    activities: z.array(ActivitySchema),
    dependencies: z.array(
      z.object({
        from: z.string(),
        to: z.string()
      })
    )
  }),
  manualFields: z.array(z.string())
});
