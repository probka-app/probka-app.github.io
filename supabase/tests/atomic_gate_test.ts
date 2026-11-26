// Офлайн-тест атомарного шлюзу для 8 платних функцій. Провайдери — заглушки (жодного справжнього платного виклику);
// paid_reserve/paid_check виконуються в СПРАВЖНІЙ локальній PostgreSQL (база gate_test з міграцією 20261126_paid_gate.sql).
const FN = Deno.args[0], FILE = Deno.args[1];
const SVC: Record<string, string> = { tts: "tts", stt: "stt", "image-gen": "image_gen", "stats-extract": "stats_extract", "kb-chat": "kb_chat", "video-spec": "video_spec", "ai-text": "ai_text", "voice-clone": "voice_clone" };
const svc = SVC[FN];
for (const [k, v] of Object.entries({ SUPABASE_URL: "http://sb.test", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "svc", ANTHROPIC_API_KEY: "d", ELEVENLABS_API_KEY: "d", GEMINI_API_KEY: "d", CF_ACCOUNT_ID: "acc", CF_AI_TOKEN: "d", YOUTUBE_API_KEY: "d", IMG_CHECK: "1" })) Deno.env.set(k, v);
async function sql(q: string): Promise<string> {
  const o = await new Deno.Command("su", { args: ["postgres", "-c", `psql -qtA -v ON_ERROR_STOP=1 -d gate_test -c "${q.replace(/"/g, '\\"')}"`] }).output();
  if (!o.success) throw new Error(new TextDecoder().decode(o.stderr));
  return new TextDecoder().decode(o.stdout).trim();
}
const st = { provider: 0, providerFail: 0, takes: 0, rpcDown: false };
let handler: (r: Request) => Promise<Response> = async () => new Response();
// @ts-ignore заглушка сервера
Deno.serve = (h) => { handler = h; return {} as Deno.HttpServer; };
const J = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const B64 = btoa("x".repeat(5000));
function provider(u: URL, req: Request): Response {
  st.provider++;
  if (st.providerFail > 0) { st.providerFail--; return J({ error: "boom" }, 500); }
  if (u.host === "api.anthropic.com") return J({ content: [{ type: "text", text: FN === "stats-extract" ? '{"items":[]}' : FN === "image-gen" ? '{"ok":true}' : "відповідь" }], stop_reason: "end_turn", usage: {} });
  if (u.host === "api.elevenlabs.io") return FN === "voice-clone" ? J({ voice_id: "v-new" }) : J({ audio_base64: B64, alignment: { characters: ["a"], character_start_times_seconds: [0], character_end_times_seconds: [1] } });
  if (u.host === "api.cloudflare.com") return u.pathname.includes("whisper") ? J({ result: { text: "привіт", words: [{ word: "привіт", start: 0, end: 1 }] } }) : J({ result: { image: B64 } });
  if (u.host === "generativelanguage.googleapis.com") return J({ candidates: [{ content: { parts: [{ text: '{"words":[{"w":"привіт","s":0,"e":1}]}' }, { inlineData: { mimeType: "image/png", data: B64 } }] }, finishReason: "STOP" }] });
  return J({});
}
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init), u = new URL(req.url);
  if (u.host !== "sb.test") {
    if (["www.youtube.com", "www.googleapis.com", "i.ytimg.com"].includes(u.host)) return J({ items: [] });
    if (req.method === "DELETE" && u.host === "api.elevenlabs.io") return J({});
    if (u.host === "generativelanguage.googleapis.com" && (u.pathname.startsWith("/upload/") || u.pathname.includes("/files"))) return u.pathname.startsWith("/upload/") && req.headers.get("x-goog-upload-command") === "start" ? new Response("{}", { headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=1" } }) : J({ file: { name: "files/1", uri: "u", state: "ACTIVE" } });
    return provider(u, req);
  }
  const tok = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (u.pathname === "/auth/v1/user") return tok === "tok-owner" ? J({ id: "00000000-0000-0000-0000-000000000001", aud: "authenticated" }) : J({ msg: "bad" }, 401);
  if (u.pathname === "/rest/v1/rpc/paid_reserve" || u.pathname === "/rest/v1/rpc/paid_check") {
    if (st.rpcDown) return J({ message: "down" }, 500);
    const p = (await req.json()).p_svc; if (!/^[a-z_]{2,40}$/.test(p)) return J("bad_svc");
    return J(await sql(`select public.${u.pathname.endsWith("reserve") ? "paid_reserve" : "paid_check"}('${p}')`));
  }
  if (u.pathname.startsWith("/rest/v1/rpc/")) { const n = u.pathname.split("/").pop()!; if (n.endsWith("_take")) st.takes++;
    return J(n === "is_owner" ? true : n === "voice_take" || n === "quota_take" ? 1 : n.endsWith("_take") ? true : n === "voice_left" || n === "quota_state" ? {} : null); }
  if (u.pathname.startsWith("/storage/v1/")) return new Response(new Uint8Array(4000), { headers: { "content-type": "video/mp4" } });
  const one = (req.headers.get("accept") || "").includes("vnd.pgrst.object");
  const row = { is_owner: true, clone_voice_id: null, nickname: "n", provider: "elevenlabs", voice_id: "v", enabled: true, id: "11111111-1111-1111-1111-111111111111" };
  return J(one ? row : [row]);
};
await import(FILE);
const BODY: Record<string, Record<string, unknown>> = {
  tts: { text: "Привіт, це перевірка озвучки.", voice: { kind: "preset", id: "p1" } },
  stt: { audio: "A".repeat(4000), mime: "audio/wav" },
  "image-gen": { prompt: "a cat on a roof", aspect: "1:1" },
  "stats-extract": { images: [{ type: "image/png", data: B64 }] },
  "kb-chat": { message: "що нового?" },
  "video-spec": { path: "00000000-0000-0000-0000-000000000001/1.mp4", mins: 1 },
  "ai-text": { prompt: "привіт світ", sys: ["director"] },
  "voice-clone": { consent: true, audio: "A".repeat(50000), mime: "audio/webm" },
};
const call = async (tok: string | null, body = BODY[FN]) => { const r = await handler(new Request("http://fn", { method: "POST", headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: JSON.stringify(body) })); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const setKeys = async (en: number | null, max: number | null) => { await sql(`delete from public.settings where key like 'paid_${svc}_%'; delete from public.paid_usage where svc='${svc}'`);
  if (en !== null) await sql(`insert into public.settings values ('paid_${svc}_enabled', ${en})`); if (max !== null) await sql(`insert into public.settings values ('paid_${svc}_daily_max', ${max})`); };
const used = async () => Number(await sql(`select coalesce(sum(used),0) from public.paid_usage where svc='${svc}'`));
let fail = 0; const out: string[] = [];
const check = (name: string, cond: boolean, info: string) => { if (!cond) fail++; out.push(`${cond ? "ok  " : "FAIL"} ${FN}: ${name} — ${info}`); };
const reset = () => { st.provider = 0; st.takes = 0; st.providerFail = 0; st.rpcDown = false; };
// 1. Без входу
reset(); await setKeys(null, null); let r = await call(null); check("без входу → 401", r.status === 401 && st.provider === 0, `${r.status} ${r.body.error}`);
// 2. Власник, ключів немає
reset(); r = await call("tok-owner"); check("ВЛАСНИК, ключів немає → 403 paid_disabled, 0 викликів, квоти не списано", r.status === 403 && r.body.error === "paid_disabled" && st.provider === 0 && st.takes === 0, `${r.status} ${r.body.error} · провайдер ${st.provider} · take ${st.takes}`);
// 3. enabled=0
reset(); await setKeys(0, 5); r = await call("tok-owner"); check("enabled=0 → 403", r.status === 403 && st.provider === 0, `${r.status} ${r.body.error}`);
// 4. без бюджету
reset(); await setKeys(1, null); r = await call("tok-owner"); check("увімкнено без бюджету → 403 paid_budget_missing", r.status === 403 && r.body.error === "paid_budget_missing" && st.provider === 0, `${r.status} ${r.body.error}`);
// 5. шлюз недоступний
reset(); await setKeys(1, 5); st.rpcDown = true; r = await call("tok-owner"); check("налаштування/шлюз недоступні → 503, 0 викликів", r.status === 503 && r.body.error === "policy_unavailable" && st.provider === 0, `${r.status} ${r.body.error}`);
// 6. дозволено: кожен виклик провайдера зарезервовано
reset(); await setKeys(1, 5); r = await call("tok-owner"); let u = await used();
check("явно ввімкнено → виклики провайдера = резерви в БД", st.provider >= 1 && st.provider === u, `${r.status} ${JSON.stringify(r.body).slice(0,80)} · провайдер ${st.provider} · зарезервовано ${u}`);
// 7. збій провайдера → повтори/запасний шлях теж резервують
reset(); await setKeys(1, 50); st.providerFail = 2; r = await call("tok-owner"); u = await used();
check("повтори/запасний провайдер після збою — кожна спроба резервується", st.provider === u, `${r.status} · провайдер ${st.provider} · зарезервовано ${u}`);
// 8. вичерпано
reset(); await setKeys(1, 1); await sql(`insert into public.paid_usage values ((now() at time zone 'utc')::date, '${svc}', 1)`); r = await call("tok-owner");
check("бюджет вичерпано → 429, 0 викликів", r.status === 429 && r.body.error === "paid_budget_exhausted" && st.provider === 0, `${r.status} ${r.body.error}`);
// 9. одночасні запити: 25 паралельних при ліміті 3
reset(); await setKeys(1, 3); const rs = await Promise.all(Array.from({ length: 25 }, () => call("tok-owner"))); u = await used();
const codes: Record<number, number> = {}; for (const x of rs) codes[x.status] = (codes[x.status] ?? 0) + 1;
check("25 одночасних запитів, ліміт 3 → викликів провайдера ≤ 3", st.provider <= 3 && u <= 3 && st.provider === u, `провайдер ${st.provider} · зарезервовано ${u} · коди ${JSON.stringify(codes)}`);
// 10. повторні запити після вичерпання
reset(); r = await call("tok-owner"); const r2 = await call("tok-owner"); check("повторні запити після вичерпання → 429, 0 викликів", r.status === 429 && r2.status === 429 && st.provider === 0, `${r.status}/${r2.status}`);
if (FN === "voice-clone") { reset(); await setKeys(null, null); r = await call("tok-owner", { delete: true }); check("видалення свого клону доступне без бюджету", r.status === 200 && st.provider === 0, `${r.status}`); }
await setKeys(null, null);
console.log(out.join("\n")); console.log(`${FN}: ${out.length - fail}/${out.length}; справжніх платних викликів: 0`); if (fail) Deno.exit(1);
