import axios from "axios";

const {
  WHO_CLIENT_ID,
  WHO_CLIENT_SECRET,
  WHO_SCOPE = "icdapi_access",
  WHO_TOKEN_URL = "https://icdaccessmanagement.who.int/connect/token",
  WHO_BASE_URL = "https://id.who.int",
  WHO_API_VERSION = "v2",
  WHO_ACCEPT_LANGUAGE = "en",
  WHO_RELEASE_ID = "latest"
} = process.env;

let tokenCache = { token: null, exp: 0 };

async function getToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.exp > now + 30_000) return tokenCache.token;

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("scope", WHO_SCOPE);

  const basic = Buffer.from(`${WHO_CLIENT_ID}:${WHO_CLIENT_SECRET}`).toString("base64");
  const { data } = await axios.post(WHO_TOKEN_URL, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basic}`
    },
    timeout: 15000
  });

  tokenCache = {
    token: data.access_token,
    exp: Date.now() + (data.expires_in || 3600) * 1000
  };
  return tokenCache.token;
}

export async function searchLinearization(linearization, q, opts = {}) {
  if (!q) return [];
  const token = await getToken();
  const releaseId = opts.releaseId || WHO_RELEASE_ID || "latest";
  const url = `${WHO_BASE_URL}/icd/release/11/${releaseId}/${linearization}/search`;

  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "API-Version": WHO_API_VERSION,
      "Accept-Language": WHO_ACCEPT_LANGUAGE
    },
    params: {
      q,
      flatResults: true,
      useFlexisearch: true,
      ...opts
    },
    timeout: 20000
  });

  const items = data?.items || data?.results || data || [];
  return items.map(it => ({
    code: it.code || it.id || it.uri || "",
    title: it.title || it.label || "",
    score: it.score ?? null,
    uri: it.id || it.uri || null
  }));
}

export const searchMMS = (q, opts) => searchLinearization("mms", q, opts);
export const searchTM2 = (q, opts) => searchLinearization("tm2", q, opts);
