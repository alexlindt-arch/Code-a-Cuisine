/**
 * @file cookbook-data.ts
 * @description TypeScript module for cookbook data.
 */
export interface CookbookCategory {
  slug: string;
  cuisine: string;
  title: string;
  description: string;
  image: string;
  banner: string;
  bannerMob?: string;
  accent: string;
}

export const cookbookCategories: CookbookCategory[] = [
  {
    slug: 'Italian',
    cuisine: 'Italian',
    title: 'Italian cuisine',
    description: 'Sun-soaked pasta, vibrant sauces and warm comfort classics.',
    image: 'assets/img/cookboog-gericht6.png',
    banner: 'assets/img/Italian-section.png',
    bannerMob: 'assets/img/Italian-Mob.svg',
    accent: 'assets/icons/hand.png',
  },
  {
    slug: 'German',
    cuisine: 'German',
    title: 'German cuisine',
    description: 'Hearty plates, familiar flavors and rich home-style cooking.',
    image: 'assets/img/cookboog-gericht1.png',
    banner: 'assets/img/German-section.png',
    bannerMob: 'assets/img/German-Mob.svg',
    accent: 'assets/icons/brezel.png',
  },
  {
    slug: 'Japanese',
    cuisine: 'Japanese',
    title: 'Japanese cuisine',
    description: 'Clean compositions, careful technique and precise balance.',
    image: 'assets/img/cookboog-gericht2.png',
    banner: 'assets/img/Japanese-section.png',
    bannerMob: 'assets/img/Japanese-Mob.svg',
    accent: 'assets/icons/stapchen.png',
  },
  {
    slug: 'Gourmet',
    cuisine: 'Gourmet',
    title: 'Gourmet cuisine',
    description: 'Plated elegance with restaurant-inspired combinations.',
    image: 'assets/img/cookboog-gericht3.png',
    banner: 'assets/img/Gourmet-section.png',
    bannerMob: 'assets/img/Gourmet-Mob.svg',
    accent: 'assets/icons/sterne.png',
  },
  {
    slug: 'Indian',
    cuisine: 'Indian',
    title: 'Indian cuisine',
    description: 'Aromatic spice layers, cozy bowls and bold depth.',
    image: 'assets/img/cookboog-gericht4.png',
    banner: 'assets/img/Indian-section.png',
    bannerMob: 'assets/img/Indian-Mob.svg',
    accent: 'assets/icons/suppen.png',
  },
  {
    slug: 'Fusion',
    cuisine: 'Fusion',
    title: 'Fusion cuisine',
    description: 'Unexpected pairings that still feel thoughtful and complete.',
    image: 'assets/img/cookboog-gericht5.png',
    banner: 'assets/img/Fusion-section.png',
    bannerMob: 'assets/img/Fusion-Mob.svg',
    accent: 'assets/icons/spieß.png',
  },
];
