// Simulated 2D floor plans of the fictional Haraya Bay By Zaldy Land and the attached
// (equally fictional) Haraya Bay Galleria mall. Shop names, layouts, exits and
// safety equipment are ILLUSTRATIVE ONLY and have not been validated against
// any real building plan.
//
// Coordinates are SVG units in a 1200 × 760 plan; 1 unit ≈ 0.25 m.

export const METRES_PER_UNIT = 0.25;
export const PLAN = { w: 1200, h: 760 };

export const FLOORS = [
  { id: 'G', label: 'G', name: 'Ground floor', mall: true },
  { id: '2', label: '2', name: 'Level 2', mall: true },
  { id: '3', label: '3', name: 'Level 3', mall: true },
  { id: '4', label: '4', name: 'Level 4', mall: false },
  { id: 'R', label: 'R', name: 'Rooftop (Level 9)', mall: false },
];

export const BUILDINGS = {
  hotel: { name: 'Haraya Bay By Zaldy Land', rect: [40, 60, 600, 510] },
  mall: { name: 'Haraya Bay Galleria', rect: [700, 60, 460, 640] },
};

export const TYPES = {
  guest: 'Guest services',
  dining: 'Restaurants & bars',
  recreation: 'Recreation & wellness',
  events: 'Event venues',
  outdoor: 'Outdoor & attractions',
  shop: 'Shops',
  food: 'Food & cafés',
  service: 'Lifts, stairs & restrooms',
  staff: 'Staff only',
};

// ---------- zones ----------
// [id, floor, building, type, name, [x, y, w, h], door: [x, y] | null, link: node id, extra]

const Z = [];
const zone = (id, floor, building, type, name, rect, door, link, extra = {}) => Z.push({ id, floor, building, type, name, rect, door, link, ...extra });

// Hotel core repeated on every hotel floor
function hotelCore(f) {
  zone(`${f}-st1`, f, 'hotel', 'service', 'Stairs 1', [310, 300, 60, 90], null, `${f}.st1`, { tags: 'stairs staircase', vertical: 'stairs' });
  zone(`${f}-elA`, f, 'hotel', 'service', 'Elevators A', [380, 300, 90, 90], null, `${f}.elA`, { tags: 'lift elevator accessible', vertical: 'elevator' });
  zone(`${f}-wc`, f, 'hotel', 'service', 'Restrooms', [480, 300, 70, 90], null, `${f}.wc`, { tags: 'toilet cr comfort room washroom restroom accessible' });
  zone(`${f}-st2`, f, 'hotel', 'service', 'Stairs 2', [560, 70, 70, 70], null, `${f}.st2`, { tags: 'stairs fire stairs', vertical: 'stairs' });
}
// Galleria core repeated on mall floors
function mallCore(f) {
  zone(`${f}-atrium`, f, 'mall', 'service', 'Atrium & escalators', [870, 260, 120, 220], null, `${f}.esc`, { tags: 'escalator atrium', vertical: 'escalator' });
  zone(`${f}-mel`, f, 'mall', 'service', 'Galleria elevators', [1020, 310, 60, 70], null, `${f}.E345`, { tags: 'lift elevator accessible', vertical: 'elevator' });
  zone(`${f}-mwc`, f, 'mall', 'service', 'Galleria restrooms', [1020, 390, 130, 50], [1020, 415], `${f}.E415`, { tags: 'toilet cr comfort room washroom restroom accessible' });
  zone(`${f}-mst`, f, 'mall', 'service', 'Galleria stairs', [710, 630, 60, 60], null, `${f}.mst`, { tags: 'stairs fire stairs', vertical: 'stairs' });
}

// Ground floor
zone('casino', 'G', 'hotel', 'recreation', 'The Gilded Room', [50, 70, 290, 210], [195, 280], 'G.n195', {
  facility: 'casino', hours: 'Daily, 6:00 PM – 2:00 AM', desc: 'Casino-style lounge, visual simulation only. Adults 21+ with valid ID. No real gambling or money.', tags: 'casino lounge',
});
zone('boh-g', 'G', 'hotel', 'staff', 'Back of house (staff only)', [350, 70, 200, 210], null, null, { desc: 'Kitchens, housekeeping and offices. No guest access.' });
zone('lounge', 'G', 'hotel', 'dining', 'Lobby Lounge', [50, 300, 230, 90], [165, 390], 'G.c165', { hours: 'Daily, 7:00 AM – 11:00 PM', desc: 'Coffee, afternoon tea and evening drinks beside the lobby.', tags: 'cafe coffee bar' });
hotelCore('G');
zone('lobby', 'G', 'hotel', 'guest', 'Hotel lobby', [50, 400, 580, 160], null, 'G.lobby', { labelDy: -24, desc: 'Main hotel entrance, seating, ATM and the property directory kiosk.', tags: 'entrance lobby atm kiosk' });
zone('concierge', 'G', 'hotel', 'guest', 'Concierge & bell desk', [70, 415, 150, 45], [145, 460], 'G.lw', { hours: 'Open 24 hours', desc: 'Tours, transport, luggage storage and recommendations.', tags: 'luggage tours taxi' });
zone('frontdesk', 'G', 'hotel', 'guest', 'Front desk', [460, 415, 150, 45], [535, 460], 'G.le', { hours: 'Open 24 hours', desc: 'Check-in, check-out, room keys and guest assistance. First-aid kit available here (illustrative).', tags: 'reception check-in check out first aid' });
zone('link-g', 'G', 'hotel', 'service', 'Galleria link (to mall)', [630, 450, 70, 60], null, 'G.link', { desc: 'Covered walkway between the hotel lobby and the Galleria mall.', tags: 'mall walkway connection' });
zone('dropoff', 'G', 'hotel', 'outdoor', 'Drop-off & taxi bay', [150, 570, 380, 30], null, 'G.drop', { desc: 'Covered porte-cochère for cars, taxis and the hotel shuttle.', tags: 'taxi car shuttle parking' });
zone('plaza', 'G', 'hotel', 'outdoor', 'Fountain Plaza', [100, 610, 480, 135], null, 'G.plaza', {
  facility: 'fountain', venue: 'PLAZA', hours: 'Open 24 hours · Shows 7:00 & 9:00 PM', desc: 'Landscaped forecourt around the Grand Entrance Fountain. Illustrative assembly point.', tags: 'fountain garden outdoor assembly',
});
// Galleria ground floor
zone('botika', 'G', 'mall', 'shop', 'Isla Botika', [710, 70, 130, 100], [840, 120], 'G.W120', { desc: 'Pharmacy and personal care (fictional shop).', hours: '8:00 AM – 10:00 PM', tags: 'pharmacy medicine drugstore' });
zone('kape', 'G', 'mall', 'food', 'Kape Kultura', [710, 180, 130, 100], [840, 230], 'G.W230', { desc: 'Specialty coffee and pandesal sandwiches (fictional café).', hours: '7:00 AM – 10:00 PM', tags: 'coffee cafe' });
zone('sampaguita', 'G', 'mall', 'shop', 'Sampaguita Threads', [710, 290, 130, 150], [840, 365], 'G.W365', { desc: 'Filipino-designed fashion and barong (fictional shop).', hours: '10:00 AM – 9:00 PM', tags: 'fashion clothes' });
zone('lakbay', 'G', 'mall', 'shop', 'Lakbay Luggage & Travel', [710, 530, 130, 90], [840, 575], 'G.W575', { desc: 'Luggage, travel accessories and SIM cards (fictional shop).', hours: '10:00 AM – 9:00 PM', tags: 'luggage bags travel sim' });
zone('halo', 'G', 'mall', 'food', 'Halo-Halo Haven', [870, 70, 120, 90], [990, 115], 'G.E115', { desc: 'Halo-halo, ube and mango desserts (fictional shop).', hours: '10:00 AM – 10:00 PM', tags: 'dessert ice cream' });
zone('bayani', 'G', 'mall', 'shop', 'Bayani Books', [870, 170, 120, 80], [930, 250], 'G.X255', { desc: 'Books, maps and Filipino comics (fictional shop).', hours: '10:00 AM – 9:00 PM', tags: 'books bookstore' });
zone('info', 'G', 'mall', 'guest', 'Galleria information desk', [870, 500, 120, 95], [930, 495], 'G.X490', { desc: 'Directions, lost and found, stroller and wheelchair loan. First-aid point (illustrative).', hours: '10:00 AM – 9:00 PM', tags: 'information help lost found wheelchair first aid' });
zone('ment', 'G', 'mall', 'service', 'Galleria main entrance', [870, 640, 120, 60], null, 'G.ment', { desc: 'Street entrance to the Galleria.', tags: 'entrance exit' });
zone('market', 'G', 'mall', 'shop', 'Mabuhay Fresh Market', [1020, 70, 130, 230], [1020, 185], 'G.E185', { desc: 'Grocery, snacks and local produce (fictional supermarket).', hours: '8:00 AM – 10:00 PM', tags: 'grocery supermarket food snacks' });
zone('pixel', 'G', 'mall', 'shop', 'Pixel Pulo Electronics', [1020, 450, 130, 110], [1020, 505], 'G.E505', { desc: 'Phones, chargers and gadgets (fictional shop).', hours: '10:00 AM – 9:00 PM', tags: 'electronics phone charger gadgets' });
zone('tsinelas', 'G', 'mall', 'shop', 'Tsinelas & Co.', [1020, 570, 130, 110], [1020, 625], 'G.E625', { desc: 'Sandals, sneakers and slippers (fictional shop).', hours: '10:00 AM – 9:00 PM', tags: 'shoes footwear slippers' });
mallCore('G');

// Level 2
zone('ballroom', '2', 'hotel', 'events', 'Grand Ballroom', [50, 70, 300, 220], [200, 280], '2.n200', { facility: 'ballroom', venue: 'BALLROOM', desc: 'Pillarless ballroom for weddings, banquets and conferences, up to 600 guests.', tags: 'wedding banquet conference gala' });
zone('theater', '2', 'hotel', 'events', 'Haraya Theater', [360, 70, 190, 220], [455, 280], '2.n455', { facility: 'theater', venue: 'THEATER', desc: '320-seat theater for concerts, plays and film screenings.', tags: 'theatre show concert movie' });
zone('bridal', '2', 'hotel', 'events', 'Bridal / VIP room', [50, 300, 230, 90], [165, 390], '2.c165', { desc: 'Private holding room connected to the ballroom.', tags: 'vip bridal' });
hotelCore('2');
zone('foyer', '2', 'hotel', 'events', 'Pre-function foyer', [50, 400, 580, 50], null, '2.foyer', { desc: 'Registration and cocktail space outside the event venues.', tags: 'foyer registration' });
zone('studio', '2', 'hotel', 'events', 'Haraya Event Studio', [50, 460, 200, 100], [150, 460], '2.f150', { venue: 'STUDIO', desc: 'Workshop studio with island workstations and ovens, home of the cake-baking workshop.', tags: 'workshop class baking' });
zone('brasserie', '2', 'hotel', 'dining', 'Sunset Brasserie', [260, 460, 370, 100], [445, 460], '2.f445', { facility: 'restaurant', hours: '6:30 AM – 10:00 PM', desc: 'All-day dining and breakfast buffet facing the bay.', tags: 'restaurant breakfast buffet dinner' });
zone('link-2', '2', 'hotel', 'service', 'Galleria skybridge', [630, 400, 70, 50], null, '2.link', { desc: 'Enclosed bridge between the hotel events level and Galleria Level 2.', tags: 'mall bridge connection' });
zone('banig', '2', 'mall', 'shop', 'Banig Home & Living', [710, 70, 130, 210], [840, 175], '2.W175', { desc: 'Woven homeware and décor (fictional shop).', hours: '10:00 AM – 9:00 PM', tags: 'home decor furniture' });
zone('habi', '2', 'mall', 'shop', 'Habi Weaves', [710, 290, 130, 100], [840, 340], '2.W340', { desc: 'Handwoven textiles and bags (fictional shop).', hours: '10:00 AM – 9:00 PM', tags: 'textiles bags souvenirs' });
zone('laro', '2', 'mall', 'shop', 'Laro Toys & Games', [710, 460, 130, 160], [840, 540], '2.W540', { desc: 'Toys, board games and puzzles (fictional shop).', hours: '10:00 AM – 9:00 PM', tags: 'toys kids games' });
zone('cinema', '2', 'mall', 'recreation', 'Sinehan Bay Cinemas', [870, 70, 120, 180], [930, 250], '2.X255', { desc: 'Four-screen cinema (fictional).', hours: '11:00 AM – 12:00 AM', tags: 'cinema movies film' });
zone('lakad', '2', 'mall', 'shop', 'Lakad Sports', [870, 500, 120, 180], [930, 495], '2.X490', { desc: 'Sportswear and running gear (fictional shop).', hours: '10:00 AM – 9:00 PM', tags: 'sports shoes running' });
zone('dept', '2', 'mall', 'shop', 'Galleria Department Store', [1020, 70, 130, 230], [1020, 185], '2.E185', { desc: 'Fashion, beauty and homeware (fictional store).', hours: '10:00 AM – 9:00 PM', tags: 'department store fashion' });
zone('tala', '2', 'mall', 'shop', 'Tala Optical', [1020, 450, 130, 110], [1020, 505], '2.E505', { desc: 'Eyewear and eye checks (fictional shop).', hours: '10:00 AM – 8:00 PM', tags: 'glasses optical' });
zone('kulay', '2', 'mall', 'shop', 'Kulay Beauty', [1020, 570, 130, 110], [1020, 625], '2.E625', { desc: 'Cosmetics and skincare (fictional shop).', hours: '10:00 AM – 9:00 PM', tags: 'beauty cosmetics skincare' });
mallCore('2');

// Level 3
zone('sauna', '3', 'hotel', 'recreation', 'Cedar Sauna', [50, 70, 150, 220], [125, 280], '3.n125', { facility: 'sauna', hours: '7:00 AM – 9:00 PM', desc: 'Finnish cedar sauna, 45-minute sessions by reservation. Adults 18+.', tags: 'sauna spa' });
zone('spa', '3', 'hotel', 'recreation', 'Spa treatment suites', [210, 70, 110, 220], [265, 280], '3.n265', { hours: '9:00 AM – 9:00 PM', desc: 'Massage and treatment rooms (sample information).', tags: 'spa massage' });
zone('gym', '3', 'hotel', 'recreation', 'Haraya Fitness Centre', [330, 70, 220, 220], [440, 280], '3.n440', { facility: 'gym', hours: 'Open 24 hours', desc: 'Cardio, weights and stretching zone with bay views.', tags: 'gym fitness workout' });
zone('lockers', '3', 'hotel', 'service', 'Locker rooms', [50, 300, 230, 90], [165, 390], '3.c165', { desc: 'Changing rooms with showers for the spa, sauna and gym.', tags: 'lockers showers changing' });
hotelCore('3');
zone('meeting', '3', 'hotel', 'events', 'Meeting rooms 1–3', [50, 410, 370, 150], [235, 410], '3.c235', { desc: 'Small meeting rooms for 10–30 people (sample information).', tags: 'meeting boardroom' });
zone('kids', '3', 'hotel', 'recreation', 'Kids Club', [430, 410, 200, 150], [530, 410], '3.wc', { hours: '9:00 AM – 6:00 PM', desc: 'Supervised play room for ages 4–12 (sample information).', tags: 'kids children play' });
zone('foodhall', '3', 'mall', 'food', 'Kainan Food Hall', [710, 70, 280, 180], [855, 250], '3.W255', { desc: 'Food stalls with Filipino and Asian favourites (fictional).', hours: '10:00 AM – 10:00 PM', tags: 'food court lunch dinner' });
zone('lanes', '3', 'mall', 'recreation', 'Bay Lanes Bowling', [710, 290, 130, 150], [840, 365], '3.W365', { desc: 'Bowling lanes and a small arcade (fictional).', hours: '11:00 AM – 11:00 PM', tags: 'bowling arcade games' });
zone('kalye', '3', 'mall', 'food', 'Kalye Street Food', [710, 460, 130, 160], [840, 540], '3.W540', { desc: 'Isaw, fishballs and grilled skewers (fictional stalls).', hours: '11:00 AM – 10:00 PM', tags: 'street food snacks' });
zone('eventshall', '3', 'mall', 'events', 'Galleria Events Hall', [870, 500, 120, 180], [930, 495], '3.X490', { desc: 'Mall activity hall for exhibits and bazaars (fictional).', tags: 'bazaar exhibit' });
zone('ube', '3', 'mall', 'food', 'Ube & Co. Bakeshop', [1020, 70, 130, 230], [1020, 185], '3.E185', { desc: 'Ube cakes, ensaymada and pasalubong breads (fictional shop).', hours: '9:00 AM – 9:00 PM', tags: 'bakery bread cake' });
zone('pasalubong', '3', 'mall', 'shop', 'Pasalubong Center', [1020, 450, 130, 110], [1020, 505], '3.E505', { desc: 'Local snacks and souvenirs to take home (fictional shop).', hours: '10:00 AM – 9:00 PM', tags: 'souvenirs gifts' });
zone('ayos', '3', 'mall', 'shop', 'Ayos Tech Repair', [1020, 570, 130, 110], [1020, 625], '3.E625', { desc: 'Phone and laptop repair (fictional shop).', hours: '10:00 AM – 8:00 PM', tags: 'repair phone laptop' });
mallCore('3');

// Level 4
zone('gameroom', '4', 'hotel', 'recreation', 'Arcade & Game Hall', [50, 70, 500, 220], [295, 280], '4.n295', { facility: 'gameroom', hours: '9:00 AM – 11:00 PM', desc: 'Billiards, consoles, arcade, golf simulator and batting cage.', tags: 'arcade games billiards golf batting' });
zone('recdesk', '4', 'hotel', 'guest', 'Recreation desk', [50, 300, 230, 90], [165, 390], '4.c165', { hours: '9:00 AM – 11:00 PM', desc: 'Golf simulator and batting cage reservations (simulated).', tags: 'reservations desk' });
hotelCore('4');
zone('terrace', '4', 'hotel', 'outdoor', 'Sky Garden Terrace', [50, 410, 580, 150], [340, 410], '4.st1', { hours: '7:00 AM – 10:00 PM', desc: 'Landscaped terrace with seating and bay views.', tags: 'garden terrace outdoor' });

// Rooftop
zone('pool', 'R', 'hotel', 'recreation', 'Infinity Pool & Sun Deck', [50, 70, 500, 220], [295, 280], 'R.n295', { facility: 'pool', venue: 'POOLDECK', hours: '6:00 AM – 10:00 PM', desc: 'Heated rooftop pool with loungers and bay views.', tags: 'pool swimming' });
zone('towels', 'R', 'hotel', 'service', 'Towel station & lockers', [50, 300, 230, 90], [165, 390], 'R.c165', { desc: 'Pool towels and wristbands. First-aid point (illustrative).', tags: 'towels lockers first aid' });
hotelCore('R');
zone('poolbar', 'R', 'hotel', 'dining', 'Pool Bar', [50, 410, 280, 150], [190, 410], 'R.c165', { hours: '10:00 AM – 10:00 PM', desc: 'Juices, mocktails and light snacks.', tags: 'bar drinks snacks' });
zone('cabanas', 'R', 'hotel', 'outdoor', 'Sunset cabanas', [340, 410, 290, 150], [480, 410], 'R.wc', { desc: 'Shaded cabanas facing the sunset.', tags: 'cabana lounge' });

export const ZONES = Z;

// ---------- walkway graph ----------

const N = {};
const E = [];
const node = (id, x, y, extra = {}) => { N[id] = { id, floor: id.split('.')[0], x, y, ...extra }; return id; };
const edge = (a, b, kind = 'walk', cost) => E.push({ a, b, kind, cost });
const chain = (...ids) => ids.slice(1).forEach((id, i) => edge(ids[i], id));

function hotelGraph(f, { north = [], mid = [] } = {}) {
  const n = (x) => node(`${f}.n${x}`, x, 290);
  const northIds = [...new Set([...north, 295, 595])].sort((a, b) => a - b).map(n);
  chain(...northIds);
  node(`${f}.st2`, 595, 150, { say: 'Stairs 2' });
  edge(`${f}.st2`, `${f}.n595`);
  const midXs = [...new Set([...mid, 295, 340, 425, 515, 595])].sort((a, b) => a - b);
  const midIds = midXs.map((x) => {
    const id = { 295: `${f}.pw`, 340: `${f}.st1`, 425: `${f}.elA`, 515: `${f}.wc`, 595: `${f}.pe` }[x] ?? `${f}.c${x}`;
    return node(id, x, 395, x === 340 ? { say: 'Stairs 1' } : x === 425 ? { say: 'Elevators A' } : {});
  });
  chain(...midIds);
  edge(`${f}.n295`, `${f}.pw`);
  edge(`${f}.n595`, `${f}.pe`);
}

function mallGraph(f, westYs, eastYs) {
  const W = [...new Set([...westYs, 255, 490, 605, 660])].sort((a, b) => a - b).map((y) => node(`${f}.W${y}`, 855, y));
  const Ea = [...new Set([...eastYs, 255, 345, 415, 490, 605])].sort((a, b) => a - b).map((y) => node(`${f}.E${y}`, 1005, y, y === 345 ? { say: 'the Galleria elevators' } : {}));
  chain(...W);
  chain(...Ea);
  for (const y of [255, 490, 605]) { node(`${f}.X${y}`, 930, y); chain(`${f}.W${y}`, `${f}.X${y}`, `${f}.E${y}`); }
  node(`${f}.esc`, 930, 370, { say: 'the atrium escalators' });
  edge(`${f}.esc`, `${f}.X255`);
  edge(`${f}.esc`, `${f}.X490`);
  node(`${f}.mst`, 740, 660, { say: 'the Galleria stairs' });
  edge(`${f}.mst`, `${f}.W660`);
}

// Ground floor
hotelGraph('G', { north: [195, 450], mid: [165] });
node('G.lw', 145, 480); node('G.lpw', 295, 480); node('G.lobby', 340, 495, { say: 'the hotel lobby' }); node('G.le', 545, 480);
node('G.link', 665, 480, { say: 'the Galleria link' });
node('G.ent', 340, 560, { say: 'the hotel main entrance', exit: true }); node('G.drop', 340, 585); node('G.plaza', 340, 628, { assembly: true });
chain('G.lw', 'G.lpw', 'G.lobby', 'G.le', 'G.link');
chain('G.lobby', 'G.ent', 'G.drop', 'G.plaza');
edge('G.c165', 'G.lw'); edge('G.pw', 'G.lpw'); edge('G.elA', 'G.lobby'); edge('G.pe', 'G.le');
mallGraph('G', [120, 230, 365, 575], [115, 185, 505, 625]);
node('G.mlink', 720, 490);
edge('G.link', 'G.mlink'); edge('G.mlink', 'G.W490');
node('G.ment', 930, 650, { say: 'the Galleria main entrance', exit: true });
edge('G.ment', 'G.X605');
N['G.st2'].exit = true;
N['G.mst'].exit = true;

// Level 2
hotelGraph('2', { north: [200, 455], mid: [165] });
['f150', 'f295', 'foyer', 'f425', 'f445', 'f595'].forEach((k, i) => node(`2.${k}`, [150, 295, 340, 425, 445, 595][i], 425, k === 'foyer' ? { say: 'the pre-function foyer' } : {}));
node('2.link', 665, 425, { say: 'the Galleria skybridge' });
chain('2.f150', '2.f295', '2.foyer', '2.f425', '2.f445', '2.f595', '2.link');
edge('2.c165', '2.f150'); edge('2.pw', '2.f295'); edge('2.elA', '2.f425'); edge('2.pe', '2.f595');
mallGraph('2', [175, 340, 425, 540], [185, 505, 625]);
node('2.mlink', 720, 425);
edge('2.link', '2.mlink'); edge('2.mlink', '2.W425');

// Level 3
hotelGraph('3', { north: [125, 265, 440], mid: [165, 235] });
mallGraph('3', [365, 540], [185, 505, 625]);

// Level 4 and rooftop
hotelGraph('4', { mid: [165] });
hotelGraph('R', { mid: [165] });

// Vertical links
const hotelFloors = ['G', '2', '3', '4', 'R'];
const mallFloors = ['G', '2', '3'];
const vertical = (floors, key, kind, cost) => floors.slice(1).forEach((f, i) => edge(`${floors[i]}.${key}`, `${f}.${key}`, kind, cost(floors[i], f)));
const gap = (a, b) => (b === 'R' ? 5 : 1);
vertical(hotelFloors, 'elA', 'elevator', (a, b) => 60 + 25 * gap(a, b));
vertical(hotelFloors, 'st1', 'stairs', (a, b) => 70 * gap(a, b));
vertical(hotelFloors, 'st2', 'stairs', (a, b) => 70 * gap(a, b));
vertical(mallFloors, 'esc', 'escalator', () => 70);
vertical(mallFloors, 'E345', 'elevator', () => 85);
vertical(mallFloors, 'mst', 'stairs', () => 70);
for (const f of ['2', '3', '4', 'R']) N[`${f}.st1`].exit = N[`${f}.st2`].exit = true;
for (const f of ['2', '3']) N[`${f}.mst`].exit = true;

// Zone door nodes
for (const z of Z) {
  if (!z.link) continue;
  if (z.door) {
    node(`${z.floor}.@${z.id}`, z.door[0], z.door[1], { zone: z.id });
    edge(`${z.floor}.@${z.id}`, z.link);
    z.node = `${z.floor}.@${z.id}`;
  } else {
    z.node = z.link;
  }
}

export const NODES = N;
export const EDGES = E;

// ---------- illustrative safety layer ----------

export const SAFETY = {
  extinguishers: {
    G: [[230, 295], [610, 395], [855, 300], [1005, 560], [60, 470]],
    2: [[300, 300], [610, 430], [855, 300], [1005, 560]],
    3: [[300, 300], [610, 395], [855, 300], [1005, 560]],
    4: [[300, 300], [610, 395]],
    R: [[300, 300], [610, 395]],
  },
  firstAid: { G: [[560, 440], [960, 545]], 2: [[340, 432]], 3: [[160, 345]], R: [[200, 345]] },
  aed: { G: [[300, 520]], 2: [[400, 432]], 3: [[930, 300]] },
  callPoints: {
    G: [[52, 395], [628, 300], [880, 605], [1150, 470]],
    2: [[52, 395], [628, 300], [880, 605]],
    3: [[52, 395], [628, 300], [880, 605]],
    4: [[52, 395], [628, 300]],
    R: [[52, 395], [628, 300]],
  },
};
