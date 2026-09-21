/* TEMPORARY. Does the Web handler signature work at all? No imports. */
export default {
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({ probe: 'a', style: 'web-fetch', node: process.version }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
