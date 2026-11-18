import Link from "next/link";

/** 404 page with a way back to the dashboard. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-ink-3 mt-2">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="bg-brand-700 mt-6 inline-flex min-h-11 items-center rounded-lg px-4 font-semibold text-white"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
