import {
  Baby, Banknote, Bike, Book, Briefcase, Building2, Bus, Car, CircleEllipsis, Clapperboard, Coffee, Coins,
  CreditCard, Dumbbell, Film, Fuel, Gamepad2, Gem, Gift, GraduationCap, HandCoins, Heart, HeartPulse, House,
  Landmark, Laptop, Music, PawPrint, PiggyBank, Plane, Receipt, Shirt, ShoppingBasket, ShoppingCart, Smartphone,
  Sparkles, Store, Target, Utensils, Wallet, Wifi, Wrench, Zap, type LucideIcon,
} from 'lucide-react'

// Icons are stored on the server by their kebab-case Lucide name.
export const ICONS: Record<string, LucideIcon> = {
  'shopping-basket': ShoppingBasket,
  'shopping-cart': ShoppingCart,
  utensils: Utensils,
  coffee: Coffee,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  bike: Bike,
  plane: Plane,
  zap: Zap,
  house: House,
  wifi: Wifi,
  smartphone: Smartphone,
  'heart-pulse': HeartPulse,
  dumbbell: Dumbbell,
  'graduation-cap': GraduationCap,
  book: Book,
  shirt: Shirt,
  gem: Gem,
  film: Film,
  clapperboard: Clapperboard,
  'gamepad-2': Gamepad2,
  music: Music,
  gift: Gift,
  heart: Heart,
  baby: Baby,
  'paw-print': PawPrint,
  'credit-card': CreditCard,
  receipt: Receipt,
  wrench: Wrench,
  'building-2': Building2,
  briefcase: Briefcase,
  'hand-coins': HandCoins,
  store: Store,
  laptop: Laptop,
  landmark: Landmark,
  coins: Coins,
  banknote: Banknote,
  wallet: Wallet,
  'piggy-bank': PiggyBank,
  target: Target,
  sparkles: Sparkles,
  'circle-ellipsis': CircleEllipsis,
}

export const ICON_NAMES = Object.keys(ICONS)

export const COLORS = [
  '#059669', '#0D9488', '#0891B2', '#0EA5E9', '#2563EB', '#6366F1', '#8B5CF6', '#A855F7',
  '#EC4899', '#E11D48', '#F97316', '#EAB308', '#CA8A04', '#84CC16', '#64748B', '#78716C',
]

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? CircleEllipsis
}
