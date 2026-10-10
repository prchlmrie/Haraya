import { getRoomType, STATUSES } from './inventory.js';
import { isValidDate, nightsBetween, today } from './dates.js';

export const MAX_NIGHTS = 30;

export class AppError extends Error {
  constructor(message, status = 400, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+()\-\s\d]{7,20}$/;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateGuest(input) {
  const guest = {
    firstName: clean(input.firstName),
    lastName: clean(input.lastName),
    email: clean(input.email).toLowerCase(),
    phone: clean(input.phone),
  };
  const errors = {};
  if (!guest.firstName) errors.firstName = 'First name is required.';
  else if (guest.firstName.length > 60) errors.firstName = 'First name is too long.';
  if (!guest.lastName) errors.lastName = 'Last name is required.';
  else if (guest.lastName.length > 60) errors.lastName = 'Last name is too long.';
  if (!guest.email) errors.email = 'Email is required.';
  else if (!EMAIL.test(guest.email)) errors.email = 'Enter a valid email address.';
  if (!guest.phone) errors.phone = 'Phone number is required.';
  else if (!PHONE.test(guest.phone)) errors.phone = 'Enter a valid phone number (digits, spaces, +, -).';
  if (Object.keys(errors).length) throw new AppError('Please correct the highlighted guest details.', 400, errors);
  return guest;
}

/**
 * Validates stay details. `allowPastCheckIn` lets staff record walk-ins or
 * edit stays that already started; guests may only book from today onward.
 */
export function validateStay(input, { allowPastCheckIn = false } = {}) {
  const stay = {
    category: clean(input.category).toUpperCase(),
    checkIn: clean(input.checkIn),
    checkOut: clean(input.checkOut),
    guests: Number(input.guests ?? 1),
    specialRequests: clean(input.specialRequests).slice(0, 500),
  };
  const errors = {};
  const type = getRoomType(stay.category);
  if (!type) errors.category = 'Select a valid room category.';

  if (!isValidDate(stay.checkIn)) errors.checkIn = 'Enter a valid check-in date.';
  if (!isValidDate(stay.checkOut)) errors.checkOut = 'Enter a valid check-out date.';
  if (!errors.checkIn && !errors.checkOut) {
    if (stay.checkOut <= stay.checkIn) {
      errors.checkOut = 'Check-out date must be after the check-in date.';
    } else if (nightsBetween(stay.checkIn, stay.checkOut) > MAX_NIGHTS) {
      errors.checkOut = `Stays are limited to ${MAX_NIGHTS} nights.`;
    }
    if (!allowPastCheckIn && stay.checkIn < today()) {
      errors.checkIn = 'Check-in date cannot be in the past.';
    }
  }

  if (!Number.isInteger(stay.guests) || stay.guests < 1) {
    errors.guests = 'Number of guests must be at least 1.';
  } else if (type && stay.guests > type.capacity) {
    errors.guests = `${type.name} accommodates up to ${type.capacity} guests.`;
  }

  if (Object.keys(errors).length) throw new AppError('Please correct the highlighted stay details.', 400, errors);
  return stay;
}

export function validateDateRange(checkIn, checkOut) {
  if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
    throw new AppError('Provide valid check-in and check-out dates (YYYY-MM-DD).');
  }
  if (checkOut <= checkIn) {
    throw new AppError('Check-out date must be after the check-in date.');
  }
}

export function validateStatus(status) {
  if (!STATUSES.includes(status)) {
    throw new AppError(`Status must be one of: ${STATUSES.join(', ')}.`);
  }
  return status;
}
