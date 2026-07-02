export type InterfaceName = 'PageTitle' | 'PageMetadata' | 'PageAssets' | 'PageStructuredData';

export const PAGE_INTERFACE_FIELDS: Record<InterfaceName, string[]> = {
  PageTitle: ['title'],
  PageMetadata: ['meta', 'og', 'rel'],
  PageAssets: ['scripts', 'styles', 'preloads'],
  PageStructuredData: ['structuredData'],
};

export function isInterfaceName(v: string): v is InterfaceName {
  return v in PAGE_INTERFACE_FIELDS;
}
