import Link from "next/link";
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Party Room 首頁">
      <span className="brand-symbol">
        p<span>✦</span>
      </span>
      <span>
        party<span className="brand-light">room</span>
        <small>GOOD FRIENDS. GREAT NIGHTS.</small>
      </span>
    </Link>
  );
}
