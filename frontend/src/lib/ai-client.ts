import axios from "axios";

export const aiClient = axios.create({
  baseURL: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  headers: {
    "X-Internal-Secret": process.env.AI_SERVICE_SECRET ?? "",
    "Content-Type": "application/json",
  },
  timeout: 60000,
});
