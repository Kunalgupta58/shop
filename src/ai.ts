import Constants from 'expo-constants';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/complete';
const SYSTEM_PROMPT = `You are a medical invoice parser. Extract all medicine line items from this bill image and return ONLY a valid JSON array with these keys per item: name, batch, qty (integer), mrp (decimal), rate (decimal), expiry (MM/YYYY), mfg. No explanation, no markdown, just the JSON array.`;

function getAnthropicApiKey(): string | undefined {
  return (
    (Constants.expoConfig?.extra?.ANTHROPIC_API_KEY as string) ||
    (Constants.manifest?.extra?.ANTHROPIC_API_KEY as string) ||
    process.env.ANTHROPIC_API_KEY
  );
}

export function hasAnthropicApiKey(): boolean {
  return Boolean(getAnthropicApiKey());
}

export async function parseBillImageAsync(base64Image: string): Promise<any[]> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error('Anthropic API key is missing. Set ANTHROPIC_API_KEY in app config or env.');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      prompt: `${SYSTEM_PROMPT}\n${base64Image}`,
      max_tokens_to_sample: 900,
      temperature: 0,
      top_p: 1,
      stop_sequences: [],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errorBody}`);
  }

  const payload = await response.json();
  const rawText = payload.completion || payload.output || '';
  const jsonStringMatch = rawText.match(/\[.*\]/s);
  if (!jsonStringMatch) {
    throw new Error('Unable to find JSON array in API response.');
  }

  try {
    return JSON.parse(jsonStringMatch[0]);
  } catch (error) {
    throw new Error(`Failed to parse JSON from API response: ${error}`);
  }
}
