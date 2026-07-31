# Code-a-Cuisine Next Steps

## Current Focus

Goal: introduce a database layer so generated recipes are stored permanently and step 2 of the checklist can be implemented cleanly.

Available database URL:

- `https://code-a-cuisine-ccf1f-default-rtdb.firebaseio.com/`

## Current Project State

- Angular frontend is working locally.
- n8n recipe generation is working locally.
- Recipes are currently request-based and stored only in local browser state / localStorage.
- A persistent recipe library does not exist yet.

## Next Implementation Steps

1. Confirm Firebase setup details
   - Verify that the Realtime Database exists and is reachable.
   - Decide whether the frontend will use Firebase SDK or REST calls.
   - Collect the remaining Firebase web app config if SDK usage is planned:
     - `apiKey`
     - `authDomain`
     - `projectId`
     - `storageBucket`
     - `messagingSenderId`
     - `appId`
     - `databaseURL`

2. Define the recipe data model
   - Create one stable schema for generated recipes.
   - Suggested root collection/path:
     - `recipes/{recipeId}`
   - Suggested fields:
     - `title`
     - `description`
     - `estimatedMinutes`
     - `ingredients`
     - `steps`
     - `cuisine`
     - `cookingTime`
     - `diets`
     - `cooks`
     - `portions`
     - `createdAt`
     - `sourceIngredients`

3. Integrate Firebase into Angular
   - Install required packages.
   - Add configuration through Angular environment handling.
   - Create a dedicated data access service for recipes.

4. Persist recipes after successful generation
   - After the n8n response is parsed successfully, save each generated recipe to Firebase.
   - Keep the current local results flow working during the migration.

5. Build the recipe library page
   - Add a dedicated route for the permanent recipe library.
   - Load saved recipes from Firebase.
   - Show card overview with title, cooking time, and cuisine.

6. Add library filters and paging
   - Filter by cuisine.
   - Later add pagination / batching when the recipe count grows.

7. Connect detail view to Firebase data
   - Open recipe details from the library using an id-based route.
   - Keep compatibility with current local result navigation until the migration is complete.

8. Add robustness
   - Loading state for Firebase reads.
   - Error state for failed reads or writes.
   - Empty state for an empty library.

9. Add Firebase security and limits
   - Decide whether public read access is allowed.
   - Restrict writes if needed.
   - Align future quota / rate-limiting with the checklist requirements.

10. Final cleanup after migration
   - Reduce the current dependency on localStorage where possible.
   - Update README with Firebase setup and local development steps.
   - Add tests for the new persistence flow.

## Recommended Order For The Very Next Session

1. Use REST calls for Firebase persistence.
2. Create recipe persistence service around Angular HttpClient.
3. Save generated recipes to Firebase Realtime Database.
4. Replace the current cookbook mock data with Firebase reads.
5. Connect cookbook detail navigation to persistent recipe ids.

## Open Inputs Still Needed

- Desired database rules for public/private access.
- Decision whether recipe saving should happen from Angular or inside n8n.
