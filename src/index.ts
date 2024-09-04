/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// For now, let's just operate on a known short VTT
const PLACEHOLDER_VTT = 'https://customer-igynxd2rwhmuoxw8.cloudflarestream.com/86319f6f2c108ce2487d2a9bb6be9234/text/en.vtt?p=eyJ0eXBlIjoiZmlsZSIsInZpZGVvSUQiOiI4NjMxOWY2ZjJjMTA4Y2UyNDg3ZDJhOWJiNmJlOTIzNCIsIm93bmVySUQiOjM0MjA5Mjc1LCJjcmVhdG9ySUQiOiJzdHJlYW0iLCJ0cmFjayI6ImY1NTIwYWRiNjNiYzY2Njg3ZGNkM2ViMDZmMjUxYzQ4IiwicmVuZGl0aW9uIjoiNzM4NDE1MjE5IiwibXV4aW5nIjoiNzkyOTc3MjI2In0&s=w7Y2YgLCkkwEwpNwCWIWwqM3TFfDmcKAwqIiWcKoWkrDvMKOwqhpNB3Ck2c';

export default {
	async fetch(request: Request, env, ctx): Promise<Response> {
		// Step One: Get our input. For now, use a known placeholder and skip error handling.
		const input = await fetch(PLACEHOLDER_VTT).then(res => res.text());

		// Done: Return what we have.
		return new Response(input);
	},
};
