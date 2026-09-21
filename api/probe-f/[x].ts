/* TEMPORARY. Does a dynamic-segment filename work at all? No imports. */
export default {
  async fetch(request: Request): Promise<Response> {
    return new Response(JSON.stringify({ probe: 'f', path: new URL(request.url).pathname }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
