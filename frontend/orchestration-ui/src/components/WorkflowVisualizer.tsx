import { useEffect } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Handle,
    Position,
    useNodesState,
    useEdgesState,
    MarkerType
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

// Custom Node to look a bit nicer
const WorkflowNode = ({ data }: any) => {
    const isEntry = data.isEntry;
    const isParallel = !!data.parallelGroup;

    return (
        <div style={{
            padding: '10px 20px',
            border: isEntry ? '2px solid #2563eb' : '1px solid #777',
            background: isEntry ? '#eff6ff' : '#fff',
            color: isEntry ? '#2563eb' : '#5e0606ff',
            borderRadius: '8px',
            fontSize: '12px',
            width: '180px',
            textAlign: 'center',
            position: 'relative'
        }}>
            <Handle type="target" position={Position.Top} />
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{data.label}</div>
            <div style={{ fontSize: '10px', color: '#666' }}>{data.method} {data.endpoint}</div>
            {isParallel && <div style={{
                marginTop: '6px',
                fontSize: '9px',
                background: '#e1e2daff',
                padding: '2px 4px',
                borderRadius: '4px',
                display: 'inline-block'
            }}>Parallel: {data.parallelGroup}</div>}
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
};

const nodeTypes = {
    custom: WorkflowNode,
};

// Layouting logic
const getLayoutedElements = (nodes: any[], edges: any[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({ rankdir: 'TB', marginx: 50, marginy: 50 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 180, height: 80 });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.position = {
            x: nodeWithPosition.x - 180 / 2,
            y: nodeWithPosition.y - 80 / 2,
        };
    });

    return { nodes, edges };
};

export default function WorkflowVisualizer({
    workflow,
    onNodeClick,
    onConnect
}: {
    workflow: any;
    onNodeClick?: (nodeId: string) => void;
    onConnect?: (connection: any) => void;
}) {
    // We use ReactFlow's internal state management for nodes and edges to support dragging.
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // This effect handles verifying if we need to update the graph based on the prop 'workflow'.
    // We want to PRESERVE positions if nodes already exist, to allow manual arrangement.
    useEffect(() => {
        if (!workflow) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const acts = workflow.activities || [];
        const deps = workflow.dependencies || [];

        // 1. Map to fresh ReactFlow objects
        // We temporarily create them without positions to check existence
        const newNodesData = acts.map((act: any) => ({
            id: act.id,
            type: 'custom',
            data: {
                label: act.id,
                method: act.method,
                endpoint: act.endpoint,
                parallelGroup: act.parallelGroup,
                isEntry: act.id === workflow.entrypoint
            },
            position: { x: 0, y: 0 }
        }));

        const newEdges = deps.map((dep: any, i: number) => ({
            id: `e-${dep.from}-${dep.to}`, // Stable ID based on connection
            source: dep.from,
            target: dep.to,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            animated: true,
            style: { stroke: '#555' }
        }));

        setNodes((currentNodes) => {
            // A. If this is a fresh load (empty current), run full layout
            if (currentNodes.length === 0) {
                const { nodes: layoutedNodes } = getLayoutedElements(newNodesData, newEdges);
                return layoutedNodes;
            }

            // B. If we have existing nodes, merge positions.
            //    - If node ID exists in current -> keep current position.
            //    - If node ID is NEW -> place it using auto-layout OR default offset.

            const mergedNodes = newNodesData.map((newNode: any) => {
                const existing = currentNodes.find((n) => n.id === newNode.id);
                if (existing) {
                    // Update data but KEEP position
                    return { ...newNode, position: existing.position };
                } else {
                    // New node! Let's place it near the last node or center
                    // Improved: could run dagre on just this new subgraph, but for now:
                    // Place it slightly offset from the last active node to avoid overlap opacity
                    const lastNode = currentNodes[currentNodes.length - 1];
                    const refPos = lastNode ? lastNode.position : { x: 250, y: 0 };
                    return { ...newNode, position: { x: refPos.x + 50, y: refPos.y + 50 } };
                }
            });

            return mergedNodes;
        });

        setEdges(newEdges);

    }, [workflow, setNodes, setEdges]);

    // Handle new connections created via UI (dragging)
    // We update local state immediately for feedback, but parent must handle the actual logic
    const handleConnect = (params: any) => {
        if (onConnect) onConnect(params);
    };

    return (
        <div style={{ height: '80%', minHeight: '500px', width: '90%', border: '1px solid #eee', borderRadius: '8px', background: '#fafafa' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                nodeTypes={nodeTypes}
                fitView
                onNodeClick={(_, node) => onNodeClick && onNodeClick(node.id)}
                attributionPosition="bottom-right"
            >
                <Controls />
                <Background gap={12} size={1} />
            </ReactFlow>
        </div>
    );
}
