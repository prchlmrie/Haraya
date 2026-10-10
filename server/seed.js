import { addDays, today } from './dates.js';

// Fictional sample guests. Dates are offsets (in days) from the day the
// database is first created so the demo always has current activity.
const SAMPLE = [
  { firstName: 'Maria', lastName: 'Santos', phone: '+63 917 555 0101', category: 'ECONOMY', from: -2, to: 1, guests: 2, status: 'Checked In' },
  { firstName: 'Jose', lastName: 'Reyes', phone: '+63 918 555 0102', category: 'DELUXE', from: -1, to: 2, guests: 2, status: 'Checked In' },
  { firstName: 'Angela', lastName: 'Cruz', phone: '+63 919 555 0103', category: 'VIP', from: -1, to: 3, guests: 3, status: 'Checked In', specialRequests: 'Airport transfer on departure.' },
  { firstName: 'Liza', lastName: 'Mendoza', phone: '+63 920 555 0104', category: 'ECONOMY', from: -3, to: 0, guests: 1, status: 'Checked In' },
  { firstName: 'Paolo', lastName: 'Garcia', phone: '+63 921 555 0105', category: 'ECONOMY', from: 0, to: 2, guests: 2, status: 'Confirmed' },
  { firstName: 'Camille', lastName: 'Tan', phone: '+63 922 555 0106', category: 'DELUXE', from: 0, to: 1, guests: 3, status: 'Confirmed', specialRequests: 'Extra pillows, please.' },
  { firstName: 'Miguel', lastName: 'Torres', phone: '+63 923 555 0107', category: 'ECONOMY', from: 1, to: 4, guests: 1, status: 'Pending' },
  { firstName: 'Mark', lastName: 'Dela Cruz', phone: '+63 924 555 0108', category: 'ECONOMY', from: 2, to: 5, guests: 2, status: 'Confirmed' },
  { firstName: 'Carlo', lastName: 'Bautista', phone: '+63 925 555 0109', category: 'DELUXE', from: 3, to: 6, guests: 2, status: 'Confirmed' },
  { firstName: 'Bea', lastName: 'Villanueva', phone: '+63 926 555 0110', category: 'VIP', from: 5, to: 8, guests: 4, status: 'Pending', specialRequests: 'Celebrating an anniversary.' },
  { firstName: 'Sofia', lastName: 'Ramos', phone: '+63 927 555 0111', category: 'DELUXE', from: 7, to: 10, guests: 2, status: 'Confirmed' },
  { firstName: 'Rafael', lastName: 'Lim', phone: '+63 928 555 0112', category: 'ECONOMY', from: 10, to: 12, guests: 1, status: 'Confirmed' },
  { firstName: 'Daniel', lastName: 'Aquino', phone: '+63 929 555 0113', category: 'ECONOMY', from: -6, to: -3, guests: 2, status: 'Checked Out' },
  { firstName: 'Isabel', lastName: 'Navarro', phone: '+63 930 555 0114', category: 'VIP', from: 2, to: 4, guests: 2, status: 'Cancelled' },
];

export function seedIfEmpty(db, service) {
  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded'").get();
  if (seeded) return false;

  const base = today();
  for (const s of SAMPLE) {
    const email = `${s.firstName}.${s.lastName}`.toLowerCase().replace(/\s+/g, '') + '@example.com';
    // All sample data goes through the normal booking rules, so it can never
    // exceed the room inventory or double-book a room.
    const r = service.createReservation(
      {
        firstName: s.firstName,
        lastName: s.lastName,
        email,
        phone: s.phone,
        category: s.category,
        checkIn: addDays(base, s.from),
        checkOut: addDays(base, s.to),
        guests: s.guests,
        specialRequests: s.specialRequests ?? '',
        status: s.status === 'Pending' ? 'Pending' : 'Confirmed',
      },
      { actor: 'Staff' },
    );
    if (s.status === 'Checked In' || s.status === 'Checked Out') {
      // Historical front-desk states are written directly because the live
      // check-in rule only allows checking in on/after today's arrival date.
      // Neither state adds room usage beyond the already-validated booking.
      db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run(s.status, r.id);
    }
    if (s.status === 'Cancelled') service.cancelReservation(r.id, { actor: 'Guest' });
  }

  db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', ?)").run(base);
  return true;
}

const BAKEBE_DESCRIPTION = `Unleash your inner cake boss with a fun, hands-on DIY cake-baking experience! Learn to create your own cake in a beginner-friendly baking studio environment. Ingredients, tools and equipment are provided, and an iPad-guided application helps you follow your chosen baking project step by step. In-house baking instructors are on hand to guide participants throughout the experience.

No previous baking experience is required!

Explore creative cake designs: My Queen, Unicorn's Childhood, Honey Bee Bee, Mind Construction, Light Me Up and Monster Cake.

How it works: 1) pick your cake design at check-in, 2) follow the iPad-guided recipe at your own workstation, 3) decorate with help from an instructor, 4) box up your cake and take it home.`;

/** Next 30 September on or after `base` (the year is stored in the event record and can be edited by staff). */
function nextSept30(base) {
  const year = Number(base.slice(0, 4));
  const candidate = `${year}-09-30`;
  return candidate >= base ? candidate : `${year + 1}-09-30`;
}

function nextDate(base, month, day) {
  const year = Number(base.slice(0, 4));
  const candidate = `${year}-${month}-${day}`;
  return candidate >= base ? candidate : `${year + 1}-${month}-${day}`;
}

/** Fictional sample events and registrations. Uses the normal event rules (no venue overlaps). */
export function seedEventsIfEmpty(db, events) {
  if (db.prepare("SELECT value FROM meta WHERE key = 'events_seeded'").get()) return false;
  const base = today();
  const bakebeDate = nextSept30(base);
  const samples = [
    {
      title: 'Bakebe DIY Cake-Baking Workshop', category: 'Workshop', poster: 'cake', venue: 'STUDIO',
      date: bakebeDate, startTime: '10:00', endTime: '16:00', capacity: 40, price: 999,
      priceNote: 'Sample advertised starting price per cake-making experience',
      description: BAKEBE_DESCRIPTION,
      includes: ['All ingredients for one cake', 'Baking tools, apron and equipment', 'iPad-guided recipe application', 'Help from in-house baking instructors', 'Take-home cake box'],
      sampleNote: `Sample event information based on a supplied promotional advertisement. The date (30 September ${bakebeDate.slice(0, 4)}) and price are to be confirmed. Not an official partnership with Bakebe or The Dessert Museum.`,
      registrations: [['Bea', 'Villanueva', 2], ['Paolo', 'Garcia', 1], ['Camille', 'Tan', 3]],
    },
    {
      title: 'Manila Bay Jazz Night', category: 'Music', poster: 'jazz', venue: 'THEATER',
      date: addDays(base, 3), startTime: '19:30', endTime: '22:00', capacity: 320, price: 1200,
      priceNote: 'Per person, includes one welcome drink',
      description: 'An evening of swing, bossa nova and OPM jazz standards with the fictional Haraya House Quintet and guest vocalists.',
      includes: ['Reserved seat', 'Welcome drink at the theater bar'],
      registrations: [['Jose', 'Reyes', 2], ['Sofia', 'Ramos', 2], ['Rafael', 'Lim', 1]],
    },
    {
      title: 'Family Movie Matinee', category: 'Film', poster: 'film', venue: 'THEATER',
      date: addDays(base, 1), startTime: '14:00', endTime: '16:00', capacity: 200, price: 0,
      priceNote: 'Free for hotel guests',
      description: 'A big-screen animated feature for the whole family, with popcorn served in the lobby.',
      includes: ['Free popcorn', 'Kids\u2019 activity sheet'],
      registrations: [['Mark', 'Dela Cruz', 4]],
    },
    {
      title: 'Sarswela Revival: A Filipino Musical Evening', category: 'Performance', poster: 'theater', venue: 'THEATER',
      date: addDays(base, 9), startTime: '19:00', endTime: '21:30', capacity: 300, price: 1500,
      priceNote: 'Orchestra seating',
      description: 'A staged revival of classic sarswela songs and scenes performed by a fictional repertory company, with live orchestra.',
      includes: ['Printed programme'],
    },
    {
      title: 'Stand-up Comedy Showcase', category: 'Performance', poster: 'theater', venue: 'THEATER',
      date: addDays(base, -5), startTime: '20:00', endTime: '22:00', capacity: 250, price: 800,
      description: 'Five rising comedians test new material in an intimate late show.', past: true,
    },
    {
      title: 'Sunset Acoustic Session', category: 'Music', poster: 'music', venue: 'POOLDECK',
      date: base, startTime: '17:00', endTime: '19:00', capacity: 120, price: 0, priceNote: 'Free for hotel guests',
      description: 'Unplugged covers on the rooftop deck as the sun sets over the bay.',
    },
    {
      title: 'Santos\u2013Reyes Wedding Reception', category: 'Wedding', poster: 'wedding', venue: 'BALLROOM', setup: 'wedding',
      date: addDays(base, 6), startTime: '17:00', endTime: '23:00', capacity: 280, price: 0, registration: 'invite', visibility: 'private',
      organizer: 'Santos & Reyes families', contactEmail: 'santos.reyes.wedding@example.com',
      description: 'Private wedding reception (fictional sample booking).',
    },
    {
      title: 'Bayfront Leadership Summit', category: 'Corporate', poster: 'corporate', venue: 'BALLROOM', setup: 'conference',
      date: addDays(base, 12), startTime: '08:30', endTime: '17:30', capacity: 450, price: 3500, registration: 'open',
      priceNote: 'Full-day pass with lunch',
      description: 'A one-day conference on hospitality, sustainability and digital service, with keynotes and panel discussions (fictional speakers).',
      includes: ['Conference pass', 'Lunch and two coffee breaks', 'Digital certificate'],
      registrations: [['Carlo', 'Bautista', 1], ['Angela', 'Cruz', 2]],
    },
    {
      title: 'Christmas Tree Lighting & Fountain Show', category: 'Festive', poster: 'festive', venue: 'PLAZA',
      date: nextDate(base, '12', '01'), startTime: '18:00', endTime: '20:00', capacity: 250, price: 0, priceNote: 'Free and open to all',
      description: 'Carols, hot tsokolate and the first lighting of the giant parol and Christmas tree, followed by a choreographed fountain light show.',
      includes: ['Carolers', 'Hot chocolate station', 'Fountain light show'],
    },
    {
      title: 'New Year\u2019s Eve Gala Dinner', category: 'Gala', poster: 'gala', venue: 'BALLROOM', setup: 'banquet',
      date: nextDate(base, '12', '31'), startTime: '19:00', endTime: '23:59', capacity: 400, price: 6500,
      priceNote: 'Per person, five-course dinner',
      description: 'A black-tie countdown with a five-course dinner, live band, midnight toast and a view of the bay fireworks.',
      includes: ['Five-course dinner', 'Live band and DJ', 'Midnight sparkling toast'],
    },
  ];

  for (const s of samples) {
    const { registrations = [], past = false, ...input } = s;
    const event = events.createEvent({ registration: 'open', visibility: 'public', ...input }, { allowPast: past });
    if (past) events.setStatus(event.id, 'Completed');
    for (const [firstName, lastName, tickets] of registrations) {
      events.register(event.id, {
        firstName, lastName, tickets,
        email: `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, '') + '@example.com',
        phone: '+63 917 555 0199',
      });
    }
  }
  events.requestVenue({
    title: 'Garcia Debut (18th Birthday)', category: 'Birthday', venue: 'BALLROOM', setup: 'wedding',
    date: addDays(base, 20), startTime: '18:00', endTime: '22:00', capacity: 180,
    description: 'Debut celebration with cotillion and 18 roses (fictional request).',
    firstName: 'Paolo', lastName: 'Garcia', email: 'paolo.garcia@example.com', phone: '+63 921 555 0105',
  });

  db.prepare("INSERT INTO meta (key, value) VALUES ('events_seeded', ?)").run(base);
  return true;
}
