import { useState } from "react";
import axios from "axios";

export default function ChatDebug() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<any[]>([]);

  async function submit() {
    const res = await axios.post("http://localhost:3001/chat", {
      description: input
    });

    setLog([...log, { input, ...res.data }]);
    setInput("");
  }

  return (
    <div style={{ padding: "1rem" }}>
      <textarea
        style={{ width: "100%", height: "80px" }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Describe your workflow..."
      />
      <button onClick={submit}>Send</button>

      <div style={{ marginTop: "1rem" }}>
        {log.map((entry, i) => (
          <div key={i} style={{ marginBottom: "1rem", borderBottom: "1px solid #ccc", paddingBottom: "0.5rem" }}>
            <b>User:</b> {entry.input}
            <pre><b>Raw AI Output:</b> {entry.raw}</pre>
            {entry.parsed && <pre><b>Parsed JSON:</b> {JSON.stringify(entry.parsed, null, 2)}</pre>}
            {entry.error && <pre style={{ color: "red" }}><b>Validation Error:</b> {entry.error}</pre>}
          </div>
        ))}
      </div>
    </div>
  );
}
