export interface CookbookCategory {
  slug: string;
  title: string;
  description: string;
  image: string;
  banner: string;
  accent: string;
}

export const cookbookCategories: CookbookCategory[] = [
  {
    slug: 'Italian',
    title: 'Italian cuisine',
    description: 'Sun-soaked pasta, vibrant sauces and warm comfort classics.',
    image: 'assets/img/cookboog-gericht6.png',
    banner: 'assets/img/Italian-section.png',
    accent: 'assets/icons/hand.png',
  },
  {
    slug: 'German',
    title: 'German cuisine',
    description: 'Hearty plates, familiar flavors and rich home-style cooking.',
    image: 'assets/img/cookboog-gericht1.png',
    banner: 'assets/img/German-section.png',
    accent: 'assets/icons/brezel.png',
  },
  {
    slug: 'Japanese',
    title: 'Japanese cuisine',
    description: 'Clean compositions, careful technique and precise balance.',
    image: 'assets/img/cookboog-gericht2.png',
    banner: 'assets/img/Japanese-section.png',
    accent: 'assets/icons/stapchen.png',
  },
  {
    slug: 'Gourmet',
    title: 'Gourmet cuisine',
    description: 'Plated elegance with restaurant-inspired combinations.',
    image: 'assets/img/cookboog-gericht3.png',
    banner: 'assets/img/Gourmet-section.png',
    accent: 'assets/icons/sterne.png',
  },
  {
    slug: 'Indian',
    title: 'Indian cuisine',
    description: 'Aromatic spice layers, cozy bowls and bold depth.',
    image: 'assets/img/cookboog-gericht4.png',
    banner: 'assets/img/Ingredients-section.png',
    accent: 'assets/icons/suppen.png',
  },
  {
    slug: 'Fusion',
    title: 'Fusion cuisine',
    description: 'Unexpected pairings that still feel thoughtful and complete.',
    image: 'assets/img/cookboog-gericht5.png',
    banner: 'assets/img/Fusion-section.png',
    accent: 'assets/icons/spieß.png',
  },
];
