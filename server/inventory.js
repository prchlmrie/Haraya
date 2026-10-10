// Fixed room inventory for the simulated hotel: exactly 20 rooms.
export const ROOM_TYPES = [
  {
    code: 'ECONOMY',
    name: 'Economy Room',
    rate: 4500,
    capacity: 2,
    roomCount: 10,
    floor: 1,
    size: '24 sqm',
    bed: '1 Queen Bed',
    view: 'Garden view',
    image: '/img/economy.jpg',
    description:
      'A warm, thoughtfully designed retreat with handcrafted wood accents, a plush queen bed and a calming garden outlook. Ideal for solo travellers and couples.',
    amenities: ['Free Wi-Fi', 'Rain shower', 'Smart TV', 'Work desk', 'Mini fridge'],
  },
  {
    code: 'DELUXE',
    name: 'Deluxe Room',
    rate: 8500,
    capacity: 3,
    roomCount: 6,
    floor: 2,
    size: '38 sqm',
    bed: '1 King Bed + Sofa',
    view: 'Partial bay view',
    image: '/img/deluxe.jpg',
    description:
      'Classic elegance with tailored furnishings, a king bed and separate lounge seating. Floor-to-ceiling drapes open to sweeping views of the bay.',
    amenities: ['Free Wi-Fi', 'Bathtub & shower', 'Nespresso machine', 'Lounge sofa', 'Minibar'],
  },
  {
    code: 'VIP',
    name: 'VIP Suite',
    rate: 18000,
    capacity: 4,
    roomCount: 4,
    floor: 3,
    size: '72 sqm',
    bed: '1 King Bed + Living Area',
    view: 'Panoramic bay view',
    image: '/img/suite-2.jpg',
    description:
      'Our signature suite with an open-plan living area, glass-walled bath and panoramic sunset views. Includes executive lounge access and butler service.',
    amenities: ['Executive lounge', 'Butler service', 'Soaking tub', 'Living area', 'Late check-out'],
  },
];

export const STATUSES = ['Pending', 'Confirmed', 'Checked In', 'Checked Out', 'Cancelled'];

// Only these statuses hold a room. Cancelled and Checked Out reservations release it.
export const BLOCKING_STATUSES = ['Pending', 'Confirmed', 'Checked In'];

export const TOTAL_ROOMS = ROOM_TYPES.reduce((sum, t) => sum + t.roomCount, 0);

export function getRoomType(code) {
  return ROOM_TYPES.find((t) => t.code === code);
}

// Room numbers: Economy 101-110, Deluxe 201-206, VIP 301-304.
export function buildRoomList() {
  const rooms = [];
  for (const type of ROOM_TYPES) {
    for (let i = 1; i <= type.roomCount; i++) {
      rooms.push({ number: String(type.floor * 100 + i), category: type.code });
    }
  }
  return rooms;
}
