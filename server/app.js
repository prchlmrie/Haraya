import express from 'express';
import { join } from 'node:path';
import { ROOM_TYPES, STATUSES, TOTAL_ROOMS } from './inventory.js';
import { addDays, isValidDate, today } from './dates.js';
import { AppError } from './validation.js';
import { EVENT_CATEGORIES, EVENT_STATUSES } from './events.js';

export function createApp(service, { publicDir, threeDir, fontsDir, events } = {}) {
  const app = express();
  app.use(express.json({ limit: '50kb' }));
  if (publicDir) app.use(express.static(publicDir));
  // Three.js is served locally (no CDN) for the 3D room tours; only the browser builds are exposed.
  if (threeDir) {
    app.use('/vendor/three/build', express.static(join(threeDir, 'build'), { maxAge: '1d' }));
    app.use('/vendor/three/examples/jsm', express.static(join(threeDir, 'examples', 'jsm'), { maxAge: '1d' }));
  }
  // Web fonts (Cormorant Garamond, Jost) are self-hosted from @fontsource: only the font files are exposed.
  if (fontsDir) {
    for (const family of ['cormorant-garamond', 'jost']) {
      app.use(`/vendor/fonts/${family}`, express.static(join(fontsDir, family, 'files'), { maxAge: '7d' }));
    }
  }

  const api = express.Router();

  // ---------- shared / guest ----------

  api.get('/config', (_req, res) => {
    res.json({ today: today(), totalRooms: TOTAL_ROOMS, statuses: STATUSES, roomTypes: ROOM_TYPES });
  });

  api.get('/availability', (req, res) => {
    const checkIn = req.query.checkIn || today();
    const checkOut = req.query.checkOut || addDays(checkIn, 1);
    res.json({ checkIn, checkOut, roomTypes: service.getAvailability(checkIn, checkOut) });
  });

  api.post('/reservations', (req, res) => {
    const reservation = service.createReservation(req.body, { actor: 'Guest' });
    res.status(201).json({ reservation, message: `Booking confirmed! Your reference number is ${reservation.reference}.` });
  });

  api.post('/reservations/lookup', (req, res) => {
    const reservation = service.findForGuest(req.body.reference, req.body.email);
    res.json({ reservation, notifications: service.notificationsFor(reservation.id) });
  });

  api.put('/reservations/:reference', (req, res) => {
    const current = service.findForGuest(req.params.reference, req.body.email);
    const reservation = service.updateReservation(current.id, req.body, { actor: 'Guest' });
    res.json({ reservation, notifications: service.notificationsFor(reservation.id), message: 'Your reservation has been updated.' });
  });

  api.post('/reservations/:reference/cancel', (req, res) => {
    const current = service.findForGuest(req.params.reference, req.body.email);
    const reservation = service.cancelReservation(current.id, { actor: 'Guest' });
    res.json({ reservation, notifications: service.notificationsFor(reservation.id), message: `Reservation ${reservation.reference} has been cancelled.` });
  });

  // ---------- staff ----------

  api.get('/staff/dashboard', (req, res) => {
    const date = isValidDate(req.query.date) ? req.query.date : today();
    res.json(service.dashboard(date));
  });

  api.get('/staff/rooms', (req, res) => {
    const start = isValidDate(req.query.start) ? req.query.start : today();
    const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 31);
    res.json(service.roomTimeline(start, days));
  });

  api.get('/staff/free-rooms', (req, res) => {
    const { category, checkIn, checkOut, excludeId } = req.query;
    res.json({ rooms: service.freeRoomNumbers(String(category ?? '').toUpperCase(), checkIn, checkOut, excludeId) });
  });

  api.get('/staff/reservations', (req, res) => {
    const { q, category, status, from, to } = req.query;
    if ((from && !isValidDate(from)) || (to && !isValidDate(to))) throw new AppError('Filter dates must be valid dates.');
    res.json({ reservations: service.listReservations({ q, category, status, from, to }) });
  });

  api.get('/staff/reservations/:id', (req, res) => {
    const reservation = service.getReservation(req.params.id);
    res.json({ reservation, notifications: service.notificationsFor(reservation.id) });
  });

  api.post('/staff/reservations', (req, res) => {
    const reservation = service.createReservation(req.body, { actor: 'Staff' });
    res.status(201).json({ reservation, message: `Reservation ${reservation.reference} created for room ${reservation.roomNumber}.` });
  });

  api.put('/staff/reservations/:id', (req, res) => {
    const reservation = service.updateReservation(req.params.id, req.body, { actor: 'Staff' });
    res.json({ reservation, message: `Reservation ${reservation.reference} updated.` });
  });

  api.patch('/staff/reservations/:id/status', (req, res) => {
    const reservation = service.setStatus(req.params.id, req.body.status);
    res.json({ reservation, message: `${reservation.reference} is now ${reservation.status}.` });
  });

  api.post('/staff/reservations/:id/cancel', (req, res) => {
    const reservation = service.cancelReservation(req.params.id, { actor: 'Staff' });
    res.json({ reservation, message: `Reservation ${reservation.reference} cancelled.` });
  });

  api.get('/staff/guests', (req, res) => {
    res.json({ guests: service.listGuests(req.query.q) });
  });

  api.get('/staff/guests/:id', (req, res) => {
    res.json({ guest: service.getGuest(req.params.id) });
  });

  api.put('/staff/guests/:id', (req, res) => {
    const guest = service.updateGuest(req.params.id, req.body);
    res.json({ guest, message: `Guest ${guest.firstName} ${guest.lastName} updated.` });
  });

  api.get('/staff/notifications', (_req, res) => {
    res.json({ notifications: service.recentNotifications(50) });
  });

  if (events) mountEventRoutes(api, events);

  app.use('/api', api);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });

  return app;
}

function mountEventRoutes(api, events) {
  const filters = (q) => {
    if ((q.from && !isValidDate(q.from)) || (q.to && !isValidDate(q.to))) throw new AppError('Filter dates must be valid dates.');
    return { q: q.q, venue: q.venue, category: q.category, status: q.status, from: q.from, to: q.to };
  };

  // ---------- public ----------

  api.get('/venues', (_req, res) => {
    res.json({ venues: events.venues(), categories: EVENT_CATEGORIES, statuses: EVENT_STATUSES });
  });

  api.get('/venues/:code/schedule', (req, res) => {
    res.json({ events: events.venueSchedule(req.params.code) });
  });

  api.get('/venues/:code/availability', (req, res) => {
    res.json({ date: req.query.date, booked: events.bookedSlots(req.params.code, req.query.date) });
  });

  api.post('/venues/:code/requests', (req, res) => {
    const event = events.requestVenue({ ...req.body, venue: req.params.code });
    res.status(201).json({ event, message: `Request ${event.code} received. The time slot is held while our events team reviews it.` });
  });

  api.get('/events', (req, res) => {
    res.json({ events: events.listEvents({ ...filters(req.query), publicOnly: true }) });
  });

  api.get('/events/:id', (req, res) => {
    res.json({ event: events.getPublicEvent(req.params.id) });
  });

  api.post('/events/:id/register', (req, res) => {
    const { registration, event } = events.register(req.params.id, req.body);
    res.status(201).json({ registration, event, message: `You're registered! Your reference is ${registration.reference}.` });
  });

  api.post('/event-registrations/:reference/cancel', (req, res) => {
    const registration = events.cancelRegistrationByGuest(req.params.reference, req.body.email);
    res.json({ registration, message: `Registration ${registration.reference} cancelled.` });
  });

  // ---------- staff ----------

  api.get('/staff/events', (req, res) => {
    res.json({ events: events.listEvents(filters(req.query)) });
  });

  api.get('/staff/events/conflicts', (req, res) => {
    const { venue, date, startTime, endTime, excludeId } = req.query;
    res.json({ conflicts: events.findConflicts({ venue: String(venue ?? '').toUpperCase(), date, startTime, endTime, excludeId }) });
  });

  api.get('/staff/events/:id', (req, res) => {
    res.json({ event: events.getEvent(req.params.id) });
  });

  api.post('/staff/events', (req, res) => {
    const event = events.createEvent(req.body);
    res.status(201).json({ event, message: `Event ${event.code} scheduled at ${event.venueName}.` });
  });

  api.put('/staff/events/:id', (req, res) => {
    const event = events.updateEvent(req.params.id, req.body);
    res.json({ event, message: `Event ${event.code} updated.` });
  });

  api.patch('/staff/events/:id/status', (req, res) => {
    const event = events.setStatus(req.params.id, req.body.status);
    res.json({ event, message: `${event.code} is now ${event.status}.` });
  });

  api.post('/staff/events/:id/cancel', (req, res) => {
    const event = events.cancelEvent(req.params.id);
    res.json({ event, message: `Event ${event.code} cancelled. Registered attendees were notified.` });
  });

  api.post('/staff/event-registrations/:id/cancel', (req, res) => {
    const registration = events.cancelRegistration(req.params.id);
    res.json({ registration, message: `Registration ${registration.reference} cancelled.` });
  });
}
