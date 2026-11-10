import { de } from './de';
import { en } from './en';

export type { Translations } from './en';
export type Locale = 'en' | 'de';

export const translations = { en, de };

/** Where each language lives. English is the default (and x-default) at the root. */
export const HOME: Record<Locale, string> = { en: '/', de: '/de/' };

export const other = (lang: Locale): Locale => (lang === 'en' ? 'de' : 'en');
