export interface Product { id: string; name: string }
export function ProductCard({ product }: { product: Product }) {
  return <article>{product.name}</article>;
}
