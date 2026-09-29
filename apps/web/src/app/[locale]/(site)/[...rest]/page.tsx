import { notFound } from 'next/navigation';

// Unmatched paths under a locale render the localized not-found page (with a 404 status).
export default function CatchAll() {
  notFound();
}
