export function verifyAuth(request: Request): boolean {
  const key = request.headers.get("x-api-key");
  return key === process.env.API_SECRET;
}
