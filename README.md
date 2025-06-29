# Olumi - Better decisions faster

## OpenAI Integration

### Security Guidelines

All OpenAI API requests must be routed through the Supabase Edge Function. Never store or reference API keys in client-side code.

### Edge Function Usage

The `openai-proxy` Edge Function securely handles all OpenAI API requests. To use it:

1. Make a POST request to the Edge Function endpoint
2. Include the user's authentication token in the Authorization header
3. Send the messages and options in the request body
4. Handle the response, which will contain the content from OpenAI

### Rate Limiting

The Edge Function implements rate limiting to prevent abuse. Each user is limited to 10 requests per minute.

### Error Handling

The Edge Function provides sanitized error messages to avoid leaking sensitive information. Always handle these errors gracefully in the UI.

### Updating the Edge Function

To update the Edge Function:

1. Modify the code in `supabase/functions/openai-proxy/index.ts`
2. Deploy using the Supabase CLI or dashboard
3. Update the corresponding client code in `src/lib/api.ts` if necessary

Remember to set the `OPENAI_API_KEY` secret in the Supabase dashboard.