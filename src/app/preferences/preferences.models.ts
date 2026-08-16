export type CookingTimeId = 'quick' | 'medium' | 'complex';
export type CuisineId = 'german' | 'italian' | 'indian' | 'japanese' | 'gourmet' | 'fusion';
export type DietId = 'vegetarian' | 'vegan' | 'keto' | 'none';

export interface CookingTimeOption {
  id: CookingTimeId;
  label: string;
  hint: string;
}

export interface Option<T extends string> {
  id: T;
  label: string;
}

export interface StoredIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface StoredRecipeContext {
  ingredients: StoredIngredient[];
  preferences?: {
    portions: number;
    cooks: number;
    cookingTime: CookingTimeId;
    cuisine: CuisineId;
    diets: DietId[];
  };
}

export interface RecipeRequestPayload {
  ingredients: StoredIngredient[];
  preferences: {
    portions: number;
    cooks: number;
    cookingTime: CookingTimeId;
    cuisine: CuisineId;
    diets: DietId[];
  };
  clientIp: string;
  requestedAt: string;
}

export interface QuotaStatus {
  date: string;
  ipAddress: string;
  ipVersion: 'ipv4' | 'ipv6' | 'unknown';
  perIpLimit: number;
  perIpUsed: number;
  perIpRemaining: number;
  globalLimit: number;
  globalUsed: number;
  globalRemaining: number;
}

export interface RecipeResponsePayload {
  result?: unknown;
  quota?: QuotaStatus;
}

export interface QuotaResponsePayload {
  message?: string;
  quota?: QuotaStatus;
}

export interface LocalIpQuotaWindowRecord {
  ipAddress: string;
  ipVersion: 'ipv4' | 'ipv6' | 'unknown';
  timestamps: number[];
}

export interface LocalQuotaWindowStore {
  records: LocalIpQuotaWindowRecord[];
}

export interface QuotaCardSummary {
  show: boolean;
  kind: 'none' | 'local' | 'remote';
  localUsage: number;
  perIpRemaining: number | null;
  globalRemaining: number | null;
  message: string | null;
}
