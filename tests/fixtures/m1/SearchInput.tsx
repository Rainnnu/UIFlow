export function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input value={value} onChange={e => onChange(e.target.value)} />;
}
