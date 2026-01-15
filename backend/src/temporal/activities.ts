import axios from "axios";

export async function httpCallActivity(input: {
  method: "GET" | "POST";
  endpoint: string;
  payload?: any;
}) {
  const res = await axios({
    method: input.method,
    url: `http://localhost:3001${input.endpoint}`,
    data: input.payload || {}, // Ensure payload is not undefined
    headers: {
      "Content-Type": "application/json"
    }
  });

  return res.data;
}
