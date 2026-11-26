// Безпечна аварійна заглушка: штатний спосіб відкату для платних функцій (ai-text, voice-clone тощо).
// Не звертається до жодного провайдера й бази; відповідає 503, поки власник не погодить відновлення робочої версії.
// Розгортання: під іменем відповідної функції (verify_jwt=false), напр. `ai-text` або `voice-clone`.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
Deno.serve((req) => req.method === "OPTIONS" ? new Response("ok", { headers: cors })
  : new Response(JSON.stringify({ error: "temporarily_disabled" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } }));
