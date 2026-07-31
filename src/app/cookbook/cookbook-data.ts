export interface CookbookCategory {
  slug: string;
  title: string;
  description: string;
  image: string;
  accent: string;
}

export const cookbookCategories: CookbookCategory[] = [
  {
    slug: 'italian',
    title: 'Italian cuisine',
    description: 'Sun-soaked pasta, vibrant sauces and warm comfort classics.',
    image: 'assets/img/Italian-section.png',
    accent: '🍝',
  },
  {
    slug: 'german',
    title: 'German cuisine',
    description: 'Hearty plates, familiar flavors and rich home-style cooking.',
    image: 'assets/img/German-section.png',
    accent: '🥨',
  },
  {
    slug: 'japanese',
    title: 'Japanese cuisine',
    description: 'Clean compositions, careful technique and precise balance.',
    image: 'assets/img/Japanese-section.png',
    accent: '🥢',
  },
  {
    slug: 'gourmet',
    title: 'Gourmet cuisine',
    description: 'Plated elegance with restaurant-inspired combinations.',
    image: 'assets/img/Gourmet-section.png',
    accent: '✨',
  },
  {
    slug: 'indian',
    title: 'Indian cuisine',
    description: 'Aromatic spice layers, cozy bowls and bold depth.',
    image: 'assets/img/menu-4.png',
    accent: '🥘',
  },
  {
    slug: 'fusion',
    title: 'Fusion cuisine',
    description: 'Unexpected pairings that still feel thoughtful and complete.',
    image: 'assets/img/Fusion-section.png',
    accent: '🍢',
  },
];
