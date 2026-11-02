import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-4xl font-semibold">Page not found</h1>
      <p className="mt-2">That path is not part of VaultBank.</p>
      <Link className="mt-6 inline-block font-semibold" to="/">Go home</Link>
    </div>
  );
}

export function UnauthorizedPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-4xl font-semibold">Unauthorized</h1>
      <p className="mt-2">Your role does not include this area.</p>
      <Link className="mt-6 inline-block font-semibold" to="/login">Sign in</Link>
    </div>
  );
}

export function ErrorPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-4xl font-semibold">Temporarily unavailable</h1>
      <p className="mt-2">VaultBank is in maintenance. Simulated balances are unchanged.</p>
    </div>
  );
}
