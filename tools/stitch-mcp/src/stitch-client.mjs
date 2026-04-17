import { StitchToolClient } from "@google/stitch-sdk";
import { getRequiredEnv } from "./config.mjs";

export async function withToolClient(fn) {
  const apiKey = getRequiredEnv("STITCH_API_KEY");
  const client = new StitchToolClient({ apiKey });

  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

export async function callTool(name, args) {
  return withToolClient((client) => client.callTool(name, args));
}

export async function fetchTextFromUrl(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch HTML from Stitch (${response.status} ${response.statusText}).`);
  }

  return response.text();
}
