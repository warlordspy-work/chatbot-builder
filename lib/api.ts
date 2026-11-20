// Shared helpers for the API routes.
// Every route wraps its work in try/catch and answers with errorResponse(),
// so a failure always returns a readable JSON message instead of an empty 500.

export function errorResponse(e: unknown, where: string, status = 500) {
  const raw = e instanceof Error ? e.message : String(e);
  console.error(`[${where}]`, raw);

  const m = raw.toLowerCase();
  let hint = '';
  if (m.includes('429') || m.includes('resource_exhausted') || m.includes('quota')) {
    hint = 'The AI is rate limited right now. Wait a minute and try again.';
  } else if (m.includes('503') || m.includes('unavailable') || m.includes('overloaded')) {
    hint = 'The AI is busy at the moment. Try again in a few seconds.';
  } else if (m.includes('not found') && m.includes('model')) {
    hint = 'GEMINI_MODEL is not valid for this key. Check the model name in the environment variables.';
  } else if (m.includes('api key') || m.includes('api_key') || m.includes('permission_denied') || m.includes('401')) {
    hint = 'Check GEMINI_API_KEY on this host. It may be missing or wrong.';
  } else if (m.includes('permission denied for')) {
    hint = 'The database user is missing permissions. Run the GRANT statements in the Supabase SQL Editor.';
  } else if (m.includes('supabaseurl') || m.includes('invalid path') || m.includes('fetch failed')) {
    hint = 'Check SUPABASE_URL on this host. It must look like https://xxxx.supabase.co with nothing after it.';
  } else if (m.includes('does not exist') || m.includes('schema cache')) {
    hint = 'A database table is missing. Run the table SQL from the guide in Supabase.';
  }

  return Response.json(
    {
      error: hint || 'Something went wrong on the server.',
      detail: raw.slice(0, 600),
    },
    { status }
  );
}
