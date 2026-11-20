import { ProductCard, type Product } from './ProductCard';
export function ProductList({ products }: { products: Product[] }) {
  return <section>{products.map(p => <ProductCard key={p.id} product={p} />)}</section>;
}
