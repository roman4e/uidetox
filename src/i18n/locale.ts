let currentLocale = 'uk-UA';

export function setLocale(locale: string): void {
  currentLocale = locale;
}

export function getLocale(): string {
  return currentLocale;
}
