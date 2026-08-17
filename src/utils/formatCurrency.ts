import type { MinorUnitAmount } from '../types/product.types';
import type { Restaurant } from '../types/restaurant.types';

const LOCALE_BY_CURRENCY: Record<Restaurant['currency'], string> = {
  COP: 'es-CO',
  USD: 'en-US',
  MXN: 'es-MX',
};

/**
 * ISO 4217 minor-unit exponent per currency: how many minor units make up
 * one major unit (10^exponent). COP is commonly quoted without cents, so we
 * treat it as exponent 0 — 1 minor unit === 1 peso — which keeps the same
 * "always store an integer, never a float" guarantee without an artificial
 * x100 multiplier that nobody would ever type in an admin form.
 */
const MINOR_UNIT_EXPONENT: Record<Restaurant['currency'], number> = {
  COP: 0,
  USD: 2,
  MXN: 2,
};

/**
 * Formats an integer minor-unit amount into a localized, currency-symbol
 * string. Money is never represented as a float anywhere in the app —
 * this is the single place division happens, purely for display.
 */
export function formatCurrency(amountMinor: MinorUnitAmount, currency: Restaurant['currency']): string {
  const exponent = MINOR_UNIT_EXPONENT[currency];
  const amount = amountMinor / 10 ** exponent;

  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: 'currency',
    currency,
    maximumFractionDigits: exponent,
    minimumFractionDigits: exponent,
  }).format(amount);
}
