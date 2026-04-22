import { test, expect } from '@playwright/test';

const BASE_URL      = 'https://eventhub.rahulshettyacademy.com';
const USER_EMAIL    = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();
  await expect(page.getByRole('link', { name: /Browse Events/i }).first()).toBeVisible();
}

/**
 * Books the first non-sold-out event.
 * Returns { bookingRef, eventTitle } from the confirmation card.
 * Precondition: user must already be logged in.
 */
async function bookEvent(page) {
  await page.goto(`${BASE_URL}/events`);

  // First card with a visible Book Now button (not sold out)
  const firstCard = page.getByTestId('event-card').filter({
    has: page.getByTestId('book-now-btn'),
  }).first();
  await expect(firstCard).toBeVisible();

  const eventTitle = (await firstCard.getByRole('heading', { level: 3 }).textContent())?.trim() ?? '';
  console.log(`Booking event: "${eventTitle}"`);

  await firstCard.getByTestId('book-now-btn').click();
  await expect(page).toHaveURL(/\/events\/\d+/);

  // Fill customer form
  await page.getByLabel('Full Name').fill('Test User');
  await page.locator('#customer-email').fill('testuser@example.com');
  await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
  await page.locator('#confirm-booking').click();

  // Wait for booking reference on confirmation card
  const refEl = page.locator('.booking-ref').first();
  await expect(refEl).toBeVisible();
  const bookingRef = (await refEl.textContent())?.trim() ?? '';
  console.log(`Booking confirmed. Ref: ${bookingRef}`);
  return { bookingRef, eventTitle };
}

/**
 * Clears all bookings for a clean slate.
 * Safe to call when already empty.
 */
async function clearBookings(page) {
  await page.goto(`${BASE_URL}/bookings`);
  const alreadyEmpty = await page.getByText('No bookings yet').isVisible().catch(() => false);
  if (alreadyEmpty) return;

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /clear all bookings/i }).click();
  await expect(page.getByText('No bookings yet')).toBeVisible();
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe('Booking Flow — Critical Happy Paths', () => {

  // TC-001 ───────────────────────────────────────────────────────────────────
  test('TC-001: booking card appears on bookings list with correct data', async ({ page }) => {
    // -- Step 1: Login, clean state, create one booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef, eventTitle } = await bookEvent(page);

    // -- Step 2: Navigate to /bookings --
    await page.goto(`${BASE_URL}/bookings`);

    // -- Step 3: Verify booking card shows ref, event title, and confirmed status --
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(eventTitle);
    await expect(card).toContainText('confirmed');
  });

  // TC-002 ───────────────────────────────────────────────────────────────────
  test('TC-002: booking detail page shows all sections', async ({ page }) => {
    // -- Step 1: Login, clean state, create one booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef, eventTitle } = await bookEvent(page);

    // -- Step 2: Navigate to bookings list and open detail --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Header badge displays the booking ref --
    await expect(page.getByText(bookingRef).first()).toBeVisible();

    // -- Step 4: Event Details section is present --
    await expect(page.getByText('Event Details')).toBeVisible();
    await expect(page.getByText(eventTitle).first()).toBeVisible();

    // -- Step 5: Customer Details section is present --
    await expect(page.getByText('Customer Details')).toBeVisible();
    await expect(page.getByText('Test User')).toBeVisible();
    await expect(page.getByText('testuser@example.com')).toBeVisible();

    // -- Step 6: Payment Summary section is present --
    await expect(page.getByText('Payment Summary')).toBeVisible();
    await expect(page.getByText('Total Paid')).toBeVisible();

    // -- Step 7: Refund eligibility button is present (client-side, no API) --
    await expect(page.locator('#check-refund-btn')).toBeVisible();
  });

  // TC-003 + TC-506 ──────────────────────────────────────────────────────────
  test('TC-003: cancel booking from detail page — confirm dialog, toast, redirect', async ({ page }) => {
    // -- Step 1: Login, clean state, create one booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef } = await bookEvent(page);

    // -- Step 2: Navigate to booking detail via bookings list --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Click Cancel Booking --
    await page.getByRole('button', { name: 'Cancel Booking' }).click();

    // -- Step 4: ConfirmDialog appears with correct title and Yes button --
    await expect(page.getByText('Cancel this booking?')).toBeVisible();
    await expect(page.locator('#confirm-dialog-yes')).toBeVisible();

    // -- Step 5: Confirm cancellation --
    await page.locator('#confirm-dialog-yes').click();

    // -- Step 6: Redirected to /bookings with success toast (TC-506) --
    await expect(page).toHaveURL(`${BASE_URL}/bookings`);
    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();

    // -- Step 7: Booking is gone — empty state renders --
    await expect(page.getByText('No bookings yet')).toBeVisible();
  });

});
