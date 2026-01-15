

export default function NodeEditor({
    node,
    allNodes,
    workflowDependencies,
    onChange,
    onDelete,
    onDependencyChange,
    onClose
}: {
    node: any;
    allNodes: any[];
    workflowDependencies: any[];
    onChange: (updatedNode: any) => void;
    onDelete: (nodeId: string) => void;
    onDependencyChange: (nodeId: string, parentIds: string[]) => void;
    onClose: () => void;
}) {
    if (!node) return null;

    const handleChange = (field: string, value: any) => {
        onChange({ ...node, [field]: value });
    };

    // Calculate current parents
    const currentParents = workflowDependencies
        .filter(d => d.to === node.id)
        .map(d => d.from);

    const handleToggleParent = (parentId: string) => {
        const isSelected = currentParents.includes(parentId);
        const newParents = isSelected
            ? currentParents.filter(id => id !== parentId)
            : [...currentParents, parentId];

        onDependencyChange(node.id, newParents);
    };

    return (
        <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: '320px',
            background: 'white',
            color: 'black',
            border: '1px solid #ccc',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            zIndex: 1000,
            maxHeight: '80vh',
            overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0 }}>Edit Activity</h4>
                <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.2rem', color: '#666' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Basic Fields */}
                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>ID (Name)</label>
                    <input
                        value={node.id}
                        onChange={e => handleChange('id', e.target.value)}
                        style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Method</label>
                    <select
                        value={node.method}
                        onChange={e => handleChange('method', e.target.value)}
                        style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                    >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Endpoint</label>
                    <input
                        value={node.endpoint}
                        onChange={e => handleChange('endpoint', e.target.value)}
                        style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Parallel Group</label>
                    <input
                        value={node.parallelGroup || ''}
                        onChange={e => handleChange('parallelGroup', e.target.value || null)}
                        placeholder="Group Name (optional)"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                </div>

                {/* Dependencies Section */}
                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Run After (Connections)</label>
                    <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid #eee', padding: '5px', borderRadius: '4px' }}>
                        {allNodes.filter(n => n.id !== node.id).map(n => (
                            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                                <input
                                    type="checkbox"
                                    checked={currentParents.includes(n.id)}
                                    onChange={() => handleToggleParent(n.id)}
                                />
                                <span>{n.id}</span>
                            </div>
                        ))}
                        {allNodes.length <= 1 && <span style={{ color: '#999', fontSize: '11px' }}>No other nodes to connect.</span>}
                    </div>
                </div>

                {/* Actions */}
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                    <button
                        onClick={() => {
                            if (window.confirm(`Delete node "${node.id}"?`)) {
                                onDelete(node.id);
                            }
                        }}
                        style={{ width: '100%', padding: '8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        🗑️ Delete Activity
                    </button>
                </div>
            </div>
        </div>
    );
}
