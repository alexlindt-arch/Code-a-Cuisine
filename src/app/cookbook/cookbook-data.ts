/**
 * @file cookbook-data.ts
 * @description Static cookbook categories (one per cuisine) plus the virtual "All recipes" category.
 */

/** A cookbook category shown on the cookbook page and as its own category page. */
export interface CookbookCategory {
  slug: string;
  cuisine: string;
  title: string;
  description: string;
  image: string;
  /** Desktop banner; categories without a banner show a text heading instead. */
  banner?: string;
  bannerMob?: string;
  accent: string;
}

/** Route slug of the category that lists every generated recipe without filtering. */
export const ALL_RECIPES_SLUG = 'all';

/** The cuisine categories, in display order. */
export const cookbookCategories: CookbookCategory[] = [
  {
    slug: 'Italian',
    cuisine: 'Italian',
    title: 'Italian cuisine',
    description: 'Sun-soaked pasta, vibrant sauces and warm comfort classics.',
    image: 'assets/img/cookboock-gericht6.png',
    banner: 'assets/img/Italian-section.svg',
    bannerMob: 'assets/img/Italian-Mob.svg',
    accent: 'assets/icons/hand.png',
  },
  {
    slug: 'German',
    cuisine: 'German',
    title: 'German cuisine',
    description: 'Hearty plates, familiar flavors and rich home-style cooking.',
    image: 'assets/img/cookboock-gericht1.png',
    banner: 'assets/img/German-section.svg',
    bannerMob: 'assets/img/German-Mob.svg',
    accent: 'assets/icons/brezel.png',
  },
  {
    slug: 'Japanese',
    cuisine: 'Japanese',
    title: 'Japanese cuisine',
    description: 'Clean compositions, careful technique and precise balance.',
    image: 'assets/img/cookboock-gericht2.png',
    banner: 'assets/img/Japanese-section.svg',
    bannerMob: 'assets/img/Japanese-Mob.svg',
    accent: 'assets/icons/stapchen.png',
  },
  {
    slug: 'Gourmet',
    cuisine: 'Gourmet',
    title: 'Gourmet cuisine',
    description: 'Plated elegance with restaurant-inspired combinations.',
    image: 'assets/img/cookboock-gericht3.png',
    banner: 'assets/img/Gourmet-section.svg',
    bannerMob: 'assets/img/Gourmet-Mob.svg',
    accent: 'assets/icons/sterne.png',
  },
  {
    slug: 'Indian',
    cuisine: 'Indian',
    title: 'Indian cuisine',
    description: 'Aromatic spice layers, cozy bowls and bold depth.',
    image: 'assets/img/cookboock-gericht4.png',
    banner: 'assets/img/Indian-section.svg',
    bannerMob: 'assets/img/Indian-Mob.svg',
    accent: 'assets/icons/suppen.png',
  },
  {
    slug: 'Fusion',
    cuisine: 'Fusion',
    title: 'Fusion cuisine',
    description: 'Unexpected pairings that still feel thoughtful and complete.',
    image: 'assets/img/cookboock-gericht5.png',
    banner: 'assets/img/Fusion-section.svg',
    bannerMob: 'assets/img/Fusion-Mob.svg',
    accent: 'assets/icons/spieß.png',
  },
];

/** Virtual category that shows all generated recipes of every cuisine. */
export const allRecipesCategory: CookbookCategory = {
  slug: ALL_RECIPES_SLUG,
  cuisine: 'All',
  title: 'All recipes',
  description: 'Every recipe generated with Code à Cuisine, newest first.',
  image: 'assets/img/cookboock-gericht5.png',
  accent: 'assets/icons/heart.png',
};

/**
 * Finds a cookbook category by its route slug (case-insensitive), including the "all" category.
 * @param slug - Route parameter of the category page.
 * @returns The category, or null when the slug is unknown.
 */
export function findCookbookCategory(slug: string | null): CookbookCategory | null {
  const normalizedSlug = slug?.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }
  if (normalizedSlug === ALL_RECIPES_SLUG) {
    return allRecipesCategory;
  }
  return cookbookCategories.find((category) => category.slug.toLowerCase() === normalizedSlug) ?? null;
}
