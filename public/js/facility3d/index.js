// Lazy registry of the amenity scenes: each facility lives in its own module
// and is only downloaded when it is opened.
const SCENES = {
  pool: () => import('./pool.js'),
  gym: () => import('./gym.js'),
  sauna: () => import('./sauna.js'),
  restaurant: () => import('./restaurant.js'),
  casino: () => import('./casino.js'),
  gameroom: () => import('./gameroom.js'),
  fountain: () => import('./fountain.js'),
  theater: () => import('./theater.js'),
  ballroom: () => import('./ballroom.js'),
};

export const hasFacilityScene = (id) => Object.hasOwn(SCENES, id);

/** Loads a facility module and builds its scene. */
export async function buildFacilityScene(id) {
  if (!hasFacilityScene(id)) throw new Error(`Unknown facility: ${id}`);
  const mod = await SCENES[id]();
  return mod.default();
}
