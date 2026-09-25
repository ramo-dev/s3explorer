import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names, letting later classes win over earlier ones.
 * `twMerge` resolves conflicts the way the cascade would if the classes were
 * adjacent (e.g. `p-2 p-4` -> `p-4`); `clsx` handles conditionals and arrays.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
