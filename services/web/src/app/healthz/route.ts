// Liveness: the server answers. Like the API's, it never checks dependencies.
export function GET() {
  return Response.json({ status: "ok" });
}
