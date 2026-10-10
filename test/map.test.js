import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, NODES, EDGES, FLOORS } from '../public/js/map-data.js';
import { VENUES } from '../server/venues.js';

const adj = new Map(Object.keys(NODES).map((id) => [id, []]));
for (const e of EDGES) {
  adj.get(e.a)?.push([e.b, e.kind]);
  adj.get(e.b)?.push([e.a, e.kind]);
}

function reachable(start, allow) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const u = queue.shift();
    for (const [v, kind] of adj.get(u)) if (allow(kind) && !seen.has(v)) { seen.add(v); queue.push(v); }
  }
  return seen;
}

const guestZones = ZONES.filter((z) => z.type !== 'staff');

test('map graph only references existing nodes and unique zone ids', () => {
  for (const e of EDGES) {
    assert.ok(NODES[e.a], `missing node ${e.a}`);
    assert.ok(NODES[e.b], `missing node ${e.b}`);
  }
  assert.equal(new Set(ZONES.map((z) => z.id)).size, ZONES.length);
  const floorIds = new Set(FLOORS.map((f) => f.id));
  for (const z of ZONES) assert.ok(floorIds.has(z.floor), `${z.id} has unknown floor ${z.floor}`);
});

test('every guest area is reachable from the lobby, including step-free', () => {
  const any = reachable('G.lobby', () => true);
  const stepFree = reachable('G.lobby', (k) => k !== 'stairs' && k !== 'escalator');
  for (const z of guestZones) {
    assert.ok(z.node && NODES[z.node], `${z.id} has no graph node`);
    assert.ok(any.has(z.node), `${z.id} is unreachable`);
    assert.ok(stepFree.has(z.node), `${z.id} has no step-free route`);
  }
});

test('illustrative evacuation: every area reaches an exit on its floor without lifts or escalators', () => {
  for (const z of guestZones.filter((g) => !g.vertical)) {
    const walk = reachable(z.node, (k) => k === 'walk');
    assert.ok([...walk].some((id) => NODES[id].exit), `${z.id} has no walking route to an exit`);
  }
});

test('every bookable event venue appears on the map', () => {
  for (const v of VENUES) assert.ok(ZONES.some((z) => z.venue === v.code), `venue ${v.code} missing from map`);
});
