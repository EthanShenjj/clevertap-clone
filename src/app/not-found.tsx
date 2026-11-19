import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>A little off the path</h1>
      <p>We couldn&apos;t find this page.</p>
      <Link className="btn primary" href="/overview">
        Return to your workspace
      </Link>
    </div>
  );
}
