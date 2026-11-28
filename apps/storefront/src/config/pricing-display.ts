/**
 * Public prices are hidden by default: customers send a request and the Impact Pro team replies with a proforma.
 * Set NEXT_PUBLIC_SHOW_PRICES=true to display prices again.
 */
export const SHOW_PRICES = process.env.NEXT_PUBLIC_SHOW_PRICES === "true";
