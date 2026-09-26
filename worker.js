export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "TechPulse News Engine" });
    }
    return Response.json({
      ok: true,
      service: "TechPulse News Engine",
      message: "Backend is ready. News automation will be connected next."
    });
  }
};