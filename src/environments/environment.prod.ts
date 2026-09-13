// Base URL of the n8n instance that runs n8n/code-a-cuisine-recipe-agent.json.
// Swap this single value to move the app to another n8n instance.
const n8nBaseUrl = 'https://maik649.app.n8n.cloud/';

export const environment = {
  production: true,
  n8nBaseUrl,
  recipeWebhookUrl: `${n8nBaseUrl}webhook/`,
  firebaseDatabaseUrl: 'https://code-a-cuisine-ccf1f-default-rtdb.firebaseio.com',
};
