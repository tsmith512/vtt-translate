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

interface cue {
  number: number;
  start: number;
  end: number;
  content: string;
}

// For now, let's just operate on a known short VTT
const PLACEHOLDER_VTT = 'https://customer-igynxd2rwhmuoxw8.cloudflarestream.com/b8d6856117263fbb0af673be613aafbd/text/en.vtt?p=eyJ0eXBlIjoiZmlsZSIsInZpZGVvSUQiOiJiOGQ2ODU2MTE3MjYzZmJiMGFmNjczYmU2MTNhYWZiZCIsIm93bmVySUQiOjM0MjA5Mjc1LCJjcmVhdG9ySUQiOiJzdHJlYW0iLCJ0cmFjayI6ImYwNzM5MDdmNWU1MjE2YTMzNjYwZjY1ZWFmZGI0YjkyIiwicmVuZGl0aW9uIjoiNjg5NTQ3NjkzIiwibXV4aW5nIjoiNzQzMzk4NjQzIn0&s=w4B5wpjDgMKpwrkwCMOBwpnDsw1mHsKYwqnCvcOyw4c4w68eAMODBcKyCsO7PMKDG8KS';

/**
 *
 * @param input (string) A formatted VTT file
 * @returns
 */
const vttToCues = (input: string): cue[] => {
  // @TODO: Retain the meta info at the top somehow
  const [meta, ...stack] = input.split('\n\n');
  return stack.map(i => convertCue(i));
};

/**
 * Convert a single SRT cue to a VTT cue, with some limited sanitation
 *
 * @param input (string) A single VTT cue
 * @returns (cue) Object with cue info parsed
 */
 const convertCue = (input: string): cue => {
  // EXAMPLES:

  // 1
  // 00:00:03.395 --> 00:00:06.728
  // Captain's Log, Stardate 44286.5.

  // 2
  // 00:00:06.765 --> 00:00:09.165
  // The <i>Enterprise</i> is conducting
  // a security survey

  const [id, time, ...text] = input.split('\n');

  const number = parseInt(id);

  // @TODO: Eliminate positioning markers
  const [start, end] = time.split(' --> ').map(x => convertTime(x));

  const content = text
    // Eliminate newlines
    .join(' ')
    // @TODO: Eliminate formatting markers
  ;


  return {
    number,
    start,
    end,
    content,
  };
};

/**
 * Convert a timestamp to seconds
 *
 * @param input (string) HH:MM:SS.mmm
 * @returns (float) SS.mmm
 */
const convertTime = (input: string): number => {
  return input
    .split(':')
    .map(x => parseFloat(x))
    .reverse()
    .reduce((a, c, i): number => {
      return a + (c * (60**i));
  }, 0);
}

export default {
  async fetch(request: Request, env, ctx): Promise<Response> {
    // Step One: Get our input. For now, use a known placeholder and skip error handling.
    const input = await fetch(PLACEHOLDER_VTT).then(res => res.text());

    // Step Two: Parse the input so we have text
    const captions = vttToCues(input);

    // Step Three: What if we just translate the cue-stack as-is?
    await Promise.all(captions.map(async (q) => {
      const translation = await env.AI.run(
        "@cf/meta/m2m100-1.2b",
        {
          text: q.content,
          source_lang: "en",
          target_lang: "es",
        }
      );

      q.content = translation?.translated_text ?? q.content;
    }));

    // Done: Return what we have.
    return new Response(captions.map(c => (`#${c.number}: ${c.start} --> ${c.end}: ${c.content.toString()}`)).join('\n'));
  },
};
