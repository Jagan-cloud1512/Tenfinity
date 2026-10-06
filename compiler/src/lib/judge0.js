import axios from "axios";

const api = axios.create({
  baseURL: "https://resume-sandlot-yiddish.ngrok-free.dev",
  timeout: 10000,
  headers: { "ngrok-skip-browser-warning": "true" },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const submitCode = async (sourceCode, languageId, stdin = "") => {
  const { data } = await api.post("/submissions", {
    source_code: sourceCode,
    language_id: languageId,
    stdin,
  }, { params: { base64_encoded: "false" } });

  const token = data.token;

  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    const { data: result } = await api.get(`/submissions/${token}`, {
      params: { base64_encoded: "false" },
    });
    // status 1 = In Queue, 2 = Processing
    if (result.status?.id > 2) return result;
  }

  throw new Error("Timed out waiting for Judge0 result.");
};
