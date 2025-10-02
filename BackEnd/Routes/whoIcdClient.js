import axios from "axios";

const {
  WHO_CLIENT_ID,
  WHO_CLIENT_SECRET,
  WHO_SCOPE = "icdapi_access",
  WHO_TOKEN_URL = "https://icdaccessmanagement.who.int/connect/token",
  WHO_BASE_URL = "https://id.who.int",
  WHO_API_VERSION = "v2",
  WHO_ACCEPT_LANGUAGE = "en",
  WHO_RELEASE_ID = "2024-05"
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
  const base = (WHO_BASE_URL || "https://id.who.int").replace(/\/+$/, "");
  const url = `${base}/icd/entity/search`;

  if (process.env.DEBUG_WHO === "1") console.log("[WHO]", { url, linearization, releaseId, q });

  try {
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
        linearization: linearization === "mms" ? "icd11-mms" : "tm2",
        releaseId,
        ...opts
      },
      timeout: 20000
    });

    const items = data?.destinationEntities || data?.items || data?.results || [];
    return items.map(it => ({
      code: it.code || it.id || it.uri || "",
      title: it.title?.["@value"] || it.title || it.label || "",
      score: it.score ?? null,
      uri: it.id || it.uri || null
    }));
  } catch (e) {
    if (e.response?.status === 404) return [];
    throw e;
  }
}

export const searchMMS = (q, opts) => searchLinearization("mms", q, opts);
export const searchTM2 = (q, opts) => searchLinearization("tm2", q, opts);
