
const PREDEFINED_TASKS = [
    { id: 'fetch_user', label: 'Fetch User', method: 'GET', endpoint: '/users/{id}' },
    { id: 'fraud_check', label: 'Fraud Check', method: 'GET', endpoint: '/fraud-scores/{id}' },
    { id: 'enrich_profile', label: 'Enrich Profile', method: 'POST', endpoint: '/enrich/{id}' },
    { id: 'audit_log', label: 'Audit Log', method: 'POST', endpoint: '/audit-logs' },
];

export default function Toolbox({ onAdd }: { onAdd: (task: any) => void }) {
    return (
        <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', background: 'white' }}>
            <h4>Toolbox</h4>
            <p style={{ fontSize: '12px', color: '#666' }}>Click to add step</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {PREDEFINED_TASKS.map(task => (
                    <button
                        key={task.id}
                        onClick={() => onAdd(task)}
                        style={{
                            padding: '0.5rem',
                            textAlign: 'left',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        <strong style={{ color: 'black' }}>{task.label}</strong>
                        <div style={{ fontSize: '10px', color: '#333' }}>{task.method} {task.endpoint}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}
