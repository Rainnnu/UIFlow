import { useState } from 'react';
import { SearchInput } from './SearchInput';
import { ProductList } from './ProductList';
const initialProducts = [{ id: '1', name: 'Keyboard' }];
export function ProductPage() {
  const [keyword, setKeyword] = useState('');
  const products = initialProducts;
  const filtered = products.filter(p => p.name.includes(keyword));
  return <main>
    <SearchInput value={keyword} onChange={setKeyword} />
    <ProductList products={filtered} />
  </main>;
}
