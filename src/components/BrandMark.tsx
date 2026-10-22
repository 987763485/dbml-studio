export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <div className="logo" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 20 20" fill="none">
        <rect x="2.2" y="2.6" width="6.2" height="4.6" rx="1.2" stroke="currentColor" strokeWidth="1.25" />
        <rect x="11.6" y="12.8" width="6.2" height="4.6" rx="1.2" stroke="currentColor" strokeWidth="1.25" />
        <rect x="11.6" y="2.6" width="6.2" height="4.6" rx="1.2" stroke="currentColor" strokeWidth="1.25" />
        <path
          d="M8.4 4.9h3.2M14.7 7.2v5.6M5.3 7.2v5.6a2 2 0 0 0 2 2h4.3"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
