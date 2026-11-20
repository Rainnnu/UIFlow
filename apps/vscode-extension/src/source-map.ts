import type { Position, SourceRef } from '../../../packages/core/src/index';

export interface Mapping { key: string; file: string; anchor: string; role: SourceRef['role'] }
// Deliberately fixed M1 mappings, not a source analyzer. Anchors must occur exactly once.
export const mappings: Mapping[] = [
  ...['ProductPage', 'SearchInput', 'ProductList', 'ProductCard'].map((name, index): Mapping => ({ key: ['page', 'search', 'list', 'card'][index], file: `${name}.tsx`, anchor: `export function ${name}`, role: 'definition' })),
  { key: 'search', file: 'ProductPage.tsx', anchor: '<SearchInput value={keyword} onChange={setKeyword} />', role: 'usage' },
  { key: 'list', file: 'ProductPage.tsx', anchor: '<ProductList products={filtered} />', role: 'usage' },
  { key: 'card', file: 'ProductList.tsx', anchor: '<ProductCard key={p.id} product={p} />', role: 'usage' },
  { key: 'keyword', file: 'ProductPage.tsx', anchor: "const [keyword, setKeyword] = useState('');", role: 'declaration' },
  { key: 'setter', file: 'ProductPage.tsx', anchor: "const [keyword, setKeyword] = useState('');", role: 'declaration' },
  { key: 'products', file: 'ProductPage.tsx', anchor: 'const products = initialProducts;', role: 'declaration' },
  { key: 'filtered', file: 'ProductPage.tsx', anchor: 'const filtered = products.filter(p => p.name.includes(keyword));', role: 'declaration' },
  { key: 'filter', file: 'ProductPage.tsx', anchor: 'products.filter(p => p.name.includes(keyword))', role: 'expression' },
  ...['keyword-filter', 'products-filter', 'filter-filtered'].map((key): Mapping => ({ key, file: 'ProductPage.tsx', anchor: 'products.filter(p => p.name.includes(keyword))', role: 'expression' })),
  ...['filtered-list', 'list::products'].map((key): Mapping => ({ key, file: 'ProductPage.tsx', anchor: 'products={filtered}', role: 'binding' })),
  ...['keyword-search', 'search::value'].map((key): Mapping => ({ key, file: 'ProductPage.tsx', anchor: 'value={keyword}', role: 'binding' })),
  ...['search-setter', 'search::onChange'].map((key): Mapping => ({ key, file: 'ProductPage.tsx', anchor: 'onChange={setKeyword}', role: 'binding' })),
  { key: 'setter-keyword', file: 'ProductPage.tsx', anchor: "const [keyword, setKeyword] = useState('');", role: 'declaration' }
];
export function findSource(text: string, uri: string, mapping: Mapping): SourceRef {
  const offset = text.indexOf(mapping.anchor);
  if (offset < 0 || text.indexOf(mapping.anchor, offset + 1) >= 0) throw new Error(`演示源码已变化，无法唯一定位：${mapping.file}`);
  const position = (at: number): Position => { const lines = text.slice(0, at).split('\n'); return { line: lines.length - 1, character: lines[lines.length - 1].length }; };
  return { uri, start: position(offset), end: position(offset + mapping.anchor.length), role: mapping.role };
}
