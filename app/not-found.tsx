import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-ink-3">The page you are looking for does not exist.</p>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 font-semibold text-white">
        Back to dashboard
      </Link>
    </div>
  );
}
