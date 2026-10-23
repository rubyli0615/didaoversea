export function BrandLogo({ light = false }: { light?: boolean }) {
  return <div className={`brand-logo${light ? " light" : ""}`}><img src="/dida-logo-reference.png" alt="DidaTravel" /></div>;
}
