// Readiness: the web app holds no state and needs nothing to start, so it's ready once it answers.
// On SIGTERM, Next.js stops taking new connections and finishes the ones in flight.
export function GET() {
  return Response.json({ status: "ready" });
}
