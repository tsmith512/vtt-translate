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
};

const convertSeconds = (seconds: number): string => {
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  seconds -= (minutes * 60);
  minutes -= (hours * 60);

  let ms = seconds % 1;
  seconds -= ms;

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    `${seconds.toString().padStart(2, '0')}.${Math.floor(ms * 1000)}`
  ].join(':');
}

const consolidate = (stack: cue[]): cue[] => {
  const result: cue[] = [];

  // As we concat cues, we need to keep track of what we've started
  let newNumber: number = stack[0].number;
  let newStart: number = 0;
  let newContent: string = '';
  let cueLength = 0;

  for (let thisIndex = 0; thisIndex < stack.length; thisIndex++) {
    const thisCue = stack[thisIndex];

    // Are we starting a new cue?
    if (cueLength === 0) {
      newNumber = thisCue.number;
      newStart = thisCue.start;
      newContent = '';
    }

    // Break this up by sentence-ending punctuation.
    const sentences = thisCue.content.split(/(?<=[.?!]+)/g);

    // Cut here; we have one fragment and it has a sentence terminator.
    const cut = sentences.length === 1 && thisCue.content.match(/[.?!]/);

    // If we need to cut or we're at the end, finish up.
    if (cut || thisIndex === stack.length) {
      newContent += ' ' + thisCue.content;

      result.push({
        number: newNumber,
        start: newStart,
        end: thisCue.end,
        content: newContent,
      });

      cueLength = 0;
    }

    // We have 1 or more sentence breakers, split this cue.
    else if (sentences.length > 1) {
      // Save the last fragment for later
      const nextContent = sentences.pop();

      // Put holdover content and all-but-last fragment into the content
      newContent += ' ' + sentences.join(' ');

      const thisLength = (thisCue.end - thisCue.start) / 2;

      result.push({
        number: newNumber,
        start: newStart,
        end: thisCue.start + (thisLength / 2),
        content: newContent,
      });

      // Treat the next one as a holdover
      cueLength = 1;
      // @ts-ignore --- this will be okay, we know we have enough
      newContent = nextContent;
      // Start the next consolidated cue halfway into this cue's original duration
      newStart = thisCue.start + (thisLength / 2) + 0.001;
      // Set the next consolidate cue's number to this cue's number
      newNumber = thisCue.number;
    }

    // We only have 1 fragment and we aren't supposed to cut; run it in
    else if (sentences.length === 1) {
      cueLength++;
      newContent += ' ' + thisCue.content;
    }

    // We shouldn't get here... right?
    else {
      console.log('unknown state');
      continue;
    }
  }

  // Renumber the cue stack
  return result.map((q, i) => {
    q.number = i + 1;
    return q;
  });
};

const cuesToVTT = (input: cue[]): string => {
  const output = input.map(cue => {
    return [
      cue.number,
      `${convertSeconds(cue.start)} --> ${convertSeconds(cue.end)}`,
      cue.content
    ].join('\n');
  });

  return ['WEBVTT', ...output].join('\n\n') + '\n';
};

export default {
  async fetch(request: Request, env, ctx): Promise<Response> {
    // Step One: Get our input. For now, use a known placeholder and skip error handling.
    const input = await fetch(PLACEHOLDER_VTT).then(res => res.text());

    // Step Two: Parse the input so we have text
    const captions = vttToCues(input);

    // Can we group sentences?
    const sentences = consolidate(captions);

    // Step Three: What if we just translate the cue-stack as-is?
    await Promise.all(sentences.map(async (q) => {
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
    return new Response(cuesToVTT(sentences));
  },
};
