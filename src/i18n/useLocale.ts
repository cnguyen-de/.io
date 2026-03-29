import { ref, computed } from 'vue';
import { en } from './en';
import { de } from './de';

export type Locale = 'en' | 'de';

const translations = { en, de };

// Module-level singleton — shared across all component instances
const locale = ref<Locale>('en');

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const lang = (navigator.language ?? '').toLowerCase();
  return lang.startsWith('de') ? 'de' : 'en';
}

export function useLocale() {
  const t = computed(() => translations[locale.value]);

  function init() {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem('locale') as Locale | null;
    locale.value = stored === 'en' || stored === 'de' ? stored : detectBrowserLocale();
  }

  function setLocale(next: Locale) {
    locale.value = next;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('locale', next);
    }
  }

  function toggle() {
    setLocale(locale.value === 'en' ? 'de' : 'en');
  }

  return { locale, t, init, toggle };
}
