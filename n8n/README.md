# n8n Recipe Agent

The recipe generator is an n8n workflow: `code-a-cuisine-recipe-agent.json`.
The Angular app sends `POST <n8nBaseUrl>webhook/code-a-cuisine-recipe` and expects
`{ request, quota, result: { recipes: [...] } }` back (429 on quota, 502 on errors).

## Run it on your own n8n instance

1. **Create an instance**
   - n8n Cloud: sign up at https://n8n.io, your URL looks like `https://<name>.app.n8n.cloud/`
   - or self-host: `docker run -it --rm -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n`
     (needs a public HTTPS domain, otherwise the deployed app cannot reach it)
2. **Import the workflow**: Workflows → *Import from File* → `code-a-cuisine-recipe-agent.json`
3. **Connect the AI model**: open the *Ollama Chat Model* node and create an Ollama credential
   - Ollama Cloud: Base URL `https://ollama.com`, API key from https://ollama.com/settings/keys
   - or your own Ollama server with the model `gemma4:31b` pulled
   - any other chat model node (OpenAI, Anthropic, Gemini) can replace it, keep the *Structured Output Parser* attached
4. **Activate** the workflow (toggle top right). Only the production URL `/webhook/...` works when active; `/webhook-test/...` is not used by the app.
5. **Point the app at it**: set `n8nBaseUrl` in `src/environments/environment.ts` and `environment.prod.ts`
   to your instance URL (with trailing slash), then build and deploy.

## Quick test

```bash
curl -X POST https://<name>.app.n8n.cloud/webhook/code-a-cuisine-recipe \
  -H "Content-Type: application/json" \
  -d '{"ingredients":[{"name":"tomato","quantity":2,"unit":"pcs"}],"preferences":{"portions":2,"cooks":1,"cookingTime":"quick","cuisine":"italian","diets":["none"]}}'
```

## Notes

- The *Check IP Quota* node stores usage in the Firebase Realtime Database
  (`quotaRolling/` and `quota/`), limits: 3 per IP / 12 globally per 24h. Adjust `perIpLimit` and `globalLimit` there.
- The webhook allows all origins by default. To restrict CORS, set *Allowed Origins* in the *Recipe Webhook* node options.
