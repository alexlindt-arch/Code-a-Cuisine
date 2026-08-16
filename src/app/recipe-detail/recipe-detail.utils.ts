export interface RecipeStepView {
  title: string;
  description: string;
}

export interface RecipeShape {
  title: string;
  description: string;
  estimatedMinutes: number;
  ingredients: string[];
  steps: string[];
}

const ingredientSynonymGroups = [
  ['apple', 'apfel', 'apples', 'aepfel'],
  ['applesauce', 'apfelmus', 'apple sauce', 'apfel sosse'],
  ['basil', 'basilikum'],
  ['butter', 'butterschmalz'],
  ['cinnamon', 'zimt'],
  ['chicken', 'chicken breast', 'huhn', 'huehnchen', 'huehnchenbrust', 'huhnerbrust', 'hahnchen', 'hahnchenbrust', 'haehnchen', 'haehnchenbrust'],
  ['flour', 'mehl'],
  ['garlic', 'knoblauch'],
  ['milk', 'milch'],
  ['mozzarella'],
  ['onion', 'zwiebel'],
  ['rice pudding', 'milchreis'],
  ['rice', 'reis'],
  ['salt', 'salz'],
  ['sugar', 'zucker'],
  ['tomato', 'tomatoes', 'tomate', 'tomaten'],
];

export function normalizeIngredientName(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^\s*\d+(?:[.,]\d+)?\s*(?:g|gram|grams|kg|ml|l|liter|liters|piece|pieces|stk|stuck)\s+/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return normalized.endsWith('s') && !normalized.endsWith('ss')
    ? normalized.slice(0, -1)
    : normalized;
}

export function ingredientsMatch(generatedIngredient: string, requestedName: string): boolean {
  const generatedVariants = getIngredientVariants(normalizeIngredientName(generatedIngredient));
  const requestedVariants = getIngredientVariants(requestedName);

  return generatedVariants.some((generatedVariant) => requestedVariants.some((requestedVariant) =>
    generatedVariant === requestedVariant
    || generatedVariant.includes(requestedVariant)
    || requestedVariant.includes(generatedVariant)
  ));
}

function getIngredientVariants(value: string): string[] {
  const matchingGroup = ingredientSynonymGroups.find((group) =>
    group.some((synonym) => value === synonym || value.includes(synonym) || synonym.includes(value))
  );

  return matchingGroup ?? [value];
}

export function toStepView(raw: string, index: number): RecipeStepView {
  const trimmed = raw.trim();
  const colonMatch = trimmed.match(/^([^:]{3,80}):\s+([\s\S]+)$/);
  if (colonMatch) {
    return {
      title: isGenericStepTitle(colonMatch[1].trim())
        ? buildStepTitleFromDescription(colonMatch[2].trim(), index)
        : colonMatch[1].trim(),
      description: colonMatch[2].trim(),
    };
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length > 1 && lines[0].length <= 80) {
    return {
      title: isGenericStepTitle(lines[0]) ? buildStepTitleFromDescription(lines.slice(1).join(' '), index) : lines[0],
      description: lines.slice(1).join(' '),
    };
  }

  const cleaned = stripGenericStepPrefix(trimmed);
  if (cleaned && cleaned !== trimmed) {
    return { title: buildStepTitleFromDescription(cleaned, index), description: cleaned };
  }

  return {
    title: isGenericStepTitle(trimmed) ? buildStepTitleFromDescription(trimmed, index) : `Step ${index + 1}`,
    description: trimmed,
  };
}

function isGenericStepTitle(value: string): boolean {
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return /^step\d*$/.test(compact) || /^schritt\d*$/.test(compact);
}

function stripGenericStepPrefix(value: string): string {
  return value
    .replace(/^step\s*\d*\s*[:.)\-–—]*\s*/i, '')
    .replace(/^schritt\s*\d*\s*[:.)\-–—]*\s*/i, '')
    .replace(/^\d+\s*[:.)\-–—]+\s*/, '')
    .trim();
}

function buildStepTitleFromDescription(description: string, index: number): string {
  const cleaned = stripGenericStepPrefix(description);
  if (!cleaned) {
    return `Step ${index + 1}`;
  }

  const titleWords = cleaned.split(/[.!?]/)[0]
    .replace(/[^A-Za-z0-9' -]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 5);

  if (titleWords.length < 2) {
    return `Step ${index + 1}`;
  }

  return titleWords.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

export function extractResult(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) {
    return payload;
  }

  const objectPayload = payload as Record<string, unknown>;
  return objectPayload['result'] ?? objectPayload['output'] ?? objectPayload['data'] ?? objectPayload['response'] ?? payload;
}

export function parseRecipeArray(input: unknown): RecipeShape[] {
  if (Array.isArray(input)) {
    return input.filter(isRecipe).map(toRecipeShape);
  }

  if (typeof input === 'string') {
    const parsed = tryParseFromText(input);
    return parsed ? parseRecipeArray(parsed) : [];
  }

  if (typeof input !== 'object' || input === null) {
    return [];
  }

  const objectInput = input as Record<string, any>;
  const recipes = objectInput['recipes']
    ?? objectInput['data']?.recipes
    ?? objectInput['output']?.recipes
    ?? objectInput['response']?.recipes;
  return Array.isArray(recipes) ? recipes.filter(isRecipe).map(toRecipeShape) : [];
}

function toRecipeShape(value: RecipeShape): RecipeShape {
  return {
    title: value.title,
    description: value.description,
    estimatedMinutes: value.estimatedMinutes,
    ingredients: value.ingredients,
    steps: value.steps,
  };
}

function tryParseFromText(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
      try {
        return JSON.parse(fencedMatch[1]);
      } catch {
        return null;
      }
    }

    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
      try {
        return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function isRecipe(value: unknown): value is RecipeShape {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const recipe = value as Partial<RecipeShape>;
  return typeof recipe.title === 'string'
    && typeof recipe.description === 'string'
    && typeof recipe.estimatedMinutes === 'number'
    && Array.isArray(recipe.ingredients)
    && recipe.ingredients.every((item) => typeof item === 'string')
    && Array.isArray(recipe.steps)
    && recipe.steps.every((item) => typeof item === 'string');
}
