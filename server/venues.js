// Bookable event venues of the fictional Haraya Bay By Zaldy Land. Capacities and
// layouts are sample information for the academic simulation.

export const VENUES = [
  {
    code: 'THEATER',
    name: 'Haraya Theater',
    floor: 'Level 2',
    capacity: 320,
    scene: 'theater',
    description: 'A 320-seat proscenium theater with a sprung stage, red velvet curtains, a 9-metre projection screen and a line-array sound system.',
    features: ['Proscenium stage with fly curtains', 'Raked seating in 12 rows with two aisles', 'Laser projector and 9 m screen', 'Line-array speakers and stage lighting rig', 'Accessible seating at row A'],
    setups: [],
  },
  {
    code: 'BALLROOM',
    name: 'Grand Ballroom',
    floor: 'Level 2',
    capacity: 600,
    scene: 'ballroom',
    description: 'A pillarless ballroom with crystal chandeliers, a parquet dance floor and a raised stage, suited to weddings, birthdays, corporate events, galas and banquets.',
    features: ['Three crystal chandeliers and dimmable cove lighting', 'Parquet dance floor and raised stage', 'Built-in LED wall and sound system', 'Bridal / VIP holding room', 'Dedicated banquet kitchen'],
    setups: [
      { id: 'wedding', label: 'Wedding reception', capacity: 360, note: 'Round tables of 10, head table, dance floor and floral arch.' },
      { id: 'banquet', label: 'Formal banquet', capacity: 480, note: 'Long banquet tables with candelabra and a stage for speeches.' },
      { id: 'conference', label: 'Corporate conference', capacity: 600, note: 'Theater-style rows facing the stage and LED wall, with a lectern.' },
    ],
  },
  {
    code: 'STUDIO',
    name: 'Haraya Event Studio',
    floor: 'Level 2',
    capacity: 40,
    scene: null,
    description: 'A bright workshop studio with island workstations, ovens and an instructor demo counter, used for classes and hands-on workshops.',
    features: ['10 island workstations', 'Convection ovens and mixers', 'Demo counter with overhead camera', 'Hand-wash stations'],
    setups: [],
  },
  {
    code: 'POOLDECK',
    name: 'Pool Deck',
    floor: 'Rooftop',
    capacity: 150,
    scene: 'pool',
    description: 'The rooftop sun deck beside the infinity pool, used for sunset sessions and cocktail receptions.',
    features: ['Sunset bay view', 'Pool bar', 'Portable sound system'],
    setups: [],
  },
  {
    code: 'PLAZA',
    name: 'Fountain Plaza',
    floor: 'Ground',
    capacity: 250,
    scene: 'fountain',
    description: 'The landscaped forecourt around the Grand Entrance Fountain, used for light shows and open-air gatherings.',
    features: ['Programmable fountain jets and lights', 'Landscaped seating', 'Covered drop-off'],
    setups: [],
  },
];

export const venueByCode = (code) => VENUES.find((v) => v.code === code) ?? null;
