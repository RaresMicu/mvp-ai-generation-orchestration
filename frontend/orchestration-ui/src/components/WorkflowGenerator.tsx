import { useState, useEffect } from "react";
import axios from "axios";
import WorkflowVisualizer from './WorkflowVisualizer';
import Toolbox from './Toolbox';
import NodeEditor from './NodeEditor';

// API Helpers (could be moved to api.ts)
const api = axios.create({ baseURL: "http://localhost:3001" });

export default function WorkflowGenerator() {
    const [description, setDescription] = useState("");
    const [jsonResult, setJsonResult] = useState<any>(null); // The generated JSON definition
    const [executionResult, setExecutionResult] = useState<any>(null); // The run result
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Manual Editing State
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Persistence State
    const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);

    useEffect(() => {
        loadSavedWorkflows();
    }, []);

    async function loadSavedWorkflows() {
        try {
            const res = await api.get("/workflows");
            setSavedWorkflows(res.data);
        } catch (e) {
            console.warn("Failed to load saved workflows");
        }
    }

    const [streamingLog, setStreamingLog] = useState("");

    // 1. Generate (Streaming)
    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setJsonResult(null);
        setExecutionResult(null);
        setError(null);
        setStreamingLog(""); // Start fresh

        try {
            // Use FETCH for streaming support (axios is harder for streams)
            const response = await fetch("http://localhost:3001/generate-workflow-stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description })
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let accumulatedJson = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // Process complete messages ending in \n\n
                const parts = buffer.split("\n\n");

                // The last part is either an incomplete message or empty string (if buffer ended in \n\n)
                buffer = parts.pop() || "";

                for (const part of parts) {
                    if (part.startsWith("data: ")) {
                        const jsonStr = part.slice(6); // Remove "data: "
                        try {
                            const data = JSON.parse(jsonStr);
                            if (data.chunk) {
                                setStreamingLog(prev => prev + data.chunk);
                                accumulatedJson += data.chunk;
                            }
                            if (data.error) throw new Error(data.error);
                            if (data.done) break;
                        } catch (e) {
                            // Ignore parse errors (retry on next accumulation? No, these should be complete JSONs)
                            console.warn("Failed to parse SSE data:", jsonStr);
                        }
                    }
                }
            }

            // Stream finished! Parse the full accumulated JSON
            // We need to extract the JSON from the Markdown text if LLM was chatty
            // Simple heuristic: find first { and last }
            const firstBrace = accumulatedJson.indexOf('{');
            const lastBrace = accumulatedJson.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                const cleanJson = accumulatedJson.slice(firstBrace, lastBrace + 1);
                const parsed = JSON.parse(cleanJson);

                // We assume LLM returns structure. If not, we might need normalization on frontend too?
                // Ideally backend normalization should happen... 
                // WAIT. Streaming bypasses the Backend Normalizer! 
                // The stream is raw LLM output. 
                // We should probably normalize it here or call a separate "validate" endpoint?
                // For now, let's assume LLM is good (per prompt instructions).

                // Add default manual fields if missing
                const fullDef = {
                    workflow: parsed.workflow || parsed, // Handle if it didn't wrap in "workflow"
                    manualFields: parsed.manualFields || ["retryPolicy", "timeoutSeconds"]
                };
                setJsonResult(fullDef);
            } else {
                throw new Error("Could not find valid JSON in LLM output");
            }

        } catch (err: any) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Generation failed");
        } finally {
            setLoading(false);
        }
    };

    // 2. Run
    const handleRun = async () => {
        if (!jsonResult) return;
        setLoading(true);
        setError(null);
        try {
            const response = await api.post("/run-workflow", jsonResult);
            setExecutionResult(response.data);
        } catch (err: any) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Execution failed");
        } finally {
            setLoading(false);
        }
    };

    // 3. Save
    const handleSave = async () => {
        if (!jsonResult) return;
        try {
            await api.post("/workflows", jsonResult);
            alert("Workflow Saved!");
            loadSavedWorkflows();
        } catch (err) {
            alert("Failed to save");
        }
    }

    const handleDeleteWorkflow = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        await api.delete(`/workflows/${id}`);
        loadSavedWorkflows();
    };

    // --- Manual Editing Actions ---

    const handleStartEmpty = () => {
        if (jsonResult && !confirm("Start new workflow? Unsaved changes will be lost.")) return;

        setJsonResult({
            workflow: {
                name: "manual_workflow",
                entrypoint: "",
                activities: [],
                dependencies: []
            },
            manualFields: ["retryPolicy", "timeoutSeconds"]
        });
        setExecutionResult(null);
        setError(null);
        setStreamingLog("");
    };

    const handleAddActivity = (template: any) => {
        const newId = `${template.id}_${Date.now().toString().slice(-4)}`;
        const newActivity = {
            id: newId,
            type: 'http_call',
            method: template.method,
            endpoint: template.endpoint,
            parallelGroup: null,
            retryPolicy: null,
            timeoutSeconds: null
        };

        const newWorkflow = { ...jsonResult.workflow };
        newWorkflow.activities = [...(newWorkflow.activities || []), newActivity];

        // If this is the FIRST activity being added, set it as entrypoint
        if (!newWorkflow.entrypoint && newWorkflow.activities.length === 1) {
            newWorkflow.entrypoint = newId;
        }

        setJsonResult({ ...jsonResult, workflow: newWorkflow });
    };

    const handleDeleteActivity = (nodeId: string) => {
        const newWorkflow = { ...jsonResult.workflow };
        // 1. Remove Activity
        newWorkflow.activities = newWorkflow.activities.filter((a: any) => a.id !== nodeId);
        // 2. Remove any dependencies pointing TO or FROM this node
        newWorkflow.dependencies = (newWorkflow.dependencies || []).filter((d: any) => d.from !== nodeId && d.to !== nodeId);

        // Reset selection
        if (selectedNodeId === nodeId) setSelectedNodeId(null);

        setJsonResult({ ...jsonResult, workflow: newWorkflow });
    };

    const handleNewConnection = (connection: any) => {
        const { source, target } = connection;
        const newWorkflow = { ...jsonResult.workflow };

        // Check if already exists
        const exists = (newWorkflow.dependencies || []).some((d: any) => d.from === source && d.to === target);
        if (!exists) {
            newWorkflow.dependencies = [...(newWorkflow.dependencies || []), { from: source, to: target }];

            // Diamond Detection: Group ONLY if branches converge
            // 1. Find parents of the 'source' (Grandparents of connection)
            const grandparents = newWorkflow.dependencies
                .filter((d: any) => d.to === source)
                .map((d: any) => d.from);

            grandparents.forEach((gp: string) => {
                // 2. Find siblings of 'source' (Uncles of connection)
                const uncles = newWorkflow.dependencies
                    .filter((d: any) => d.from === gp && d.to !== source)
                    .map((d: any) => d.to);

                // 3. Check if any Uncle ALSO connects to 'target'
                const convergingUncles = uncles.filter((uncle: string) =>
                    newWorkflow.dependencies.some((d: any) => d.from === uncle && d.to === target)
                );

                if (convergingUncles.length > 0) {
                    // We found a diamond! Source and ConvergingUncles are parallel branches joining at Target.
                    const firstUncleId = convergingUncles[0];
                    const firstUncle = newWorkflow.activities.find((a: any) => a.id === firstUncleId);
                    const groupName = firstUncle?.parallelGroup || `parallel_group_${Date.now().toString().slice(-4)}`;

                    // Apply group to Source and ALL Converging Uncles
                    newWorkflow.activities = newWorkflow.activities.map((a: any) => {
                        if (a.id === source || convergingUncles.includes(a.id)) {
                            return { ...a, parallelGroup: groupName };
                        }
                        return a;
                    });
                }
            });

            setJsonResult({ ...jsonResult, workflow: newWorkflow });
        }
    };

    const handleUpdateDependencies = (nodeId: string, parentIds: string[]) => {
        const newWorkflow = { ...jsonResult.workflow };
        // 1. Remove existing parents for this node
        const otherDeps = (newWorkflow.dependencies || []).filter((d: any) => d.to !== nodeId);
        // 2. Add new parents
        const newDeps = parentIds.map(pid => ({ from: pid, to: nodeId }));

        newWorkflow.dependencies = [...otherDeps, ...newDeps];
        setJsonResult({ ...jsonResult, workflow: newWorkflow });
    };

    const handleUpdateActivity = (updatedActivity: any) => {
        const newWorkflow = { ...jsonResult.workflow };
        newWorkflow.activities = newWorkflow.activities.map((a: any) =>
            a.id === selectedNodeId ? updatedActivity : a
        );

        // If ID changed, update dependencies and entrypoint too? 
        // This is complex. For now, assume ID doesn't change or simple update.
        if (updatedActivity.id !== selectedNodeId) {
            newWorkflow.dependencies = newWorkflow.dependencies.map((d: any) => ({
                from: d.from === selectedNodeId ? updatedActivity.id : d.from,
                to: d.to === selectedNodeId ? updatedActivity.id : d.to
            }));
            if (newWorkflow.entrypoint === selectedNodeId) {
                newWorkflow.entrypoint = updatedActivity.id;
            }
            setSelectedNodeId(updatedActivity.id);
        }

        setJsonResult({ ...jsonResult, workflow: newWorkflow });
    };

    const getSelectedNode = () => {
        if (!jsonResult || !selectedNodeId) return null;
        return jsonResult.workflow.activities.find((a: any) => a.id === selectedNodeId);
    };

    // Helper for JSON Editor
    const [jsonText, setJsonText] = useState("");
    useEffect(() => {
        if (jsonResult) {
            setJsonText(JSON.stringify(jsonResult, null, 2));
        }
    }, [jsonResult]);

    const applyJsonEdit = () => {
        try {
            const parsed = JSON.parse(jsonText);
            setJsonResult(parsed);
            setError(null);
        } catch (e) {
            setError("Invalid JSON format");
        }
    }

    return (
        <div style={{ padding: "1rem", maxWidth: "1800px", margin: "0 auto", display: "grid", gridTemplateColumns: "250px 1fr", gap: "2rem" }}>

            {/* Left Sidebar: Saved Workflows & Toolbox */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem", borderRight: "1px solid #ccc", paddingRight: "1rem" }}>

                {/* Toolbox */}
                <button
                    onClick={handleStartEmpty}
                    style={{ padding: "1rem", background: "#f3f4f6", border: "2px dashed #ccc", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", color: "#666" }}
                >
                    + Start from Scratch
                </button>

                {jsonResult && (
                    <Toolbox onAdd={handleAddActivity} />
                )}

                <div>
                    <h3>Saved Workflows</h3>
                    {savedWorkflows.length === 0 && <p style={{ color: "gray" }}>No saved workflows.</p>}
                    <ul style={{ listStyle: "none", padding: 0 }}>
                        {savedWorkflows.map(wf => (
                            <li key={wf.id} style={{ marginBottom: "0.5rem", padding: "0.5rem", border: "1px solid #eee", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                onClick={() => { setJsonResult(wf); setExecutionResult(null); }}
                            >
                                <div>
                                    <strong>{wf.workflow?.name || "Untitled"}</strong><br />
                                    <small>{new Date(wf.savedAt).toLocaleTimeString()}</small>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteWorkflow(wf.id);
                                    }}
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        color: "red",
                                        cursor: "pointer",
                                        fontWeight: "bold"
                                    }}
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h2>AI Workflow Orchestrator</h2>

                {/* Step 1: Generate */}
                <form onSubmit={handleGenerate} style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                        style={{ flex: 1, padding: "0.5rem" }}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Describe workflow (e.g. 'Fetch user, then parallel enrich and fraud check')..."
                    />
                    <button type="submit" disabled={loading} style={{ padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: "4px" }}>
                        {loading ? "Thinking..." : "Generate"}
                    </button>
                </form>

                {error && <div style={{ color: "red", padding: "1rem", border: "1px solid red" }}>{error}</div>}

                {/* Streaming Output Panel */}
                {streamingLog && (
                    <div style={{ background: "#1e1e1e", color: "#00ff00", padding: "1rem", borderRadius: "8px", fontFamily: "monospace", overflowX: "auto", whiteSpace: "pre-wrap", maxHeight: "400px", overflowY: "auto" }}>
                        <strong>Creating Workflow...</strong>
                        <hr style={{ borderColor: "#333", margin: "0.5rem 0" }} />
                        {streamingLog}
                    </div>
                )}

                {jsonResult && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: "1rem", position: 'relative' }}>

                        {/* Editor Column */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <h3>Definition (JSON)</h3>
                            <textarea
                                value={jsonText}
                                onChange={e => setJsonText(e.target.value)}
                                onBlur={applyJsonEdit} // Parse on blur
                                style={{ width: "100%", height: "500px", fontFamily: "monospace", padding: "0.5rem" }}
                            />
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button onClick={handleRun} disabled={loading} style={{ flex: 1, padding: "0.5rem", background: "#16a34a", color: "white", border: "none" }}>
                                    ▶ Run Workflow
                                </button>
                                <button onClick={handleSave} disabled={loading} style={{ flex: 1, padding: "0.5rem", background: "#d97706", color: "white", border: "none" }}>
                                    💾 Save
                                </button>
                            </div>
                        </div>

                        {/* Visualizer Column */}
                        <div>
                            <h3>Visual Graph</h3>
                            <WorkflowVisualizer
                                workflow={jsonResult.workflow}
                                onNodeClick={setSelectedNodeId}
                                onConnect={handleNewConnection}
                            />
                            <p style={{ fontSize: "12px", color: "gray" }}>Click a node to edit parameters.</p>
                        </div>

                        {/* Node Popover Editor */}
                        {selectedNodeId && getSelectedNode() && (
                            <NodeEditor
                                node={getSelectedNode()}
                                allNodes={jsonResult.workflow?.activities || []}
                                workflowDependencies={jsonResult.workflow?.dependencies || []}
                                onChange={handleUpdateActivity}
                                onDelete={handleDeleteActivity}
                                onDependencyChange={handleUpdateDependencies}
                                onClose={() => setSelectedNodeId(null)}
                            />
                        )}
                    </div>
                )}

                {/* Execution Output */}
                {executionResult && (
                    <div style={{ marginTop: "2rem", padding: "1rem", background: "#f0fdf4", border: "1px solid #16a34a", color: "black" }}>
                        <h3>✅ Execution Started</h3>
                        <p><strong>Message:</strong> {executionResult.message}</p>
                        <p><strong>Workflow ID:</strong> {executionResult.workflowId}</p>
                        <p><strong>Run ID:</strong> {executionResult.runId}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
