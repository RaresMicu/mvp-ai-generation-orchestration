import { useState } from "react";
import { generateWorkflow } from "../api";

export default function Chat({ onWorkflow }: any) {
  const [input, setInput] = useState("");

  async function submit() {
    const res = await generateWorkflow(input);
    onWorkflow(res.data);
  }

  return (
    <div>
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Describe your workflow..."
      />
      <button onClick={submit}>Generate</button>
    </div>
  );
}
