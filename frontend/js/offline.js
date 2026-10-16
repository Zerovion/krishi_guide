// Offline fallback: a faithful JavaScript port of backend `score_crop` so the crop
// planner still ranks crops with no network (field use, poor signal). The Python
// backend remains the source of truth; tests/test_offline_parity.py checks that this
// port returns identical scores and reasons for a grid of farm profiles.
const DISTRICT_ASSOCIATIONS = {
  sugarcane: ['maharashtra', 'sangli', 'kolhapur', 'satara', 'pune', 'solapur', 'karnataka', 'uttar pradesh'],
  soybean: ['madhya pradesh', 'vidarbha', 'amravati', 'akola', 'indore', 'ujjain'],
  paddy: ['assam', 'kerala', 'west bengal', 'odisha', 'chhattisgarh'],
  mustard: ['rajasthan', 'bharatpur', 'alwar', 'jaipur'],
  apple: ['shimla', 'kullu', 'himachal pradesh'],
};

// Python's round() uses banker's rounding; match it so scores are identical.
function pyRound(x) {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

export function scoreCrop(crop, p) {
  let score = crop.base - 22;
  const reasons = [];
  if (crop.seasons.length && crop.seasons.includes(p.season)) {
    score += 13; reasons.push('Season matches the crop catalogue.');
  } else {
    score -= 28; reasons.push('Season does not match the crop catalogue.');
  }
  if (crop.soils.includes(p.soil)) {
    score += 12; reasons.push('Soil category matches the crop catalogue.');
  } else {
    score -= 13; reasons.push('Soil category is not a listed match.');
  }
  if (p.water === crop.water) {
    score += 10; reasons.push('Water availability aligns with the crop category.');
  } else if (p.water === 'low' && crop.water === 'high') {
    score -= 22; reasons.push('High water demand conflicts with limited water.');
  } else if (p.water === 'low' && crop.water === 'moderate') {
    score -= 9; reasons.push('Crop may need more water than is available.');
  } else if (p.water === 'moderate' && crop.water === 'high') {
    score -= 10; reasons.push('Water availability may be a concern.');
  } else {
    score += 4; reasons.push('Available water may support this crop; confirm locally.');
  }
  if (crop.cost[0] * p.area > p.budget) {
    score -= 17; reasons.push('Illustrative starting cost exceeds the stated budget.');
  } else if (crop.cost[1] * p.area <= p.budget) {
    score += 8; reasons.push('Illustrative cost range fits within the stated budget.');
  }
  if (p.goal === 'lowcost') score += Math.max(0, 12 - crop.cost[0] / 1000);
  if (p.goal === 'water') score += crop.water === 'low' ? 12 : (crop.water === 'moderate' ? 1 : -13);
  if (p.goal === 'short') score += parseInt(/\d+/.exec(crop.duration)[0], 10) <= 80 ? 12 : 5;

  const district = (p.district || '').toLowerCase();
  const hits = (terms) => terms.some((term) => district.includes(term));
  if (DISTRICT_ASSOCIATIONS[crop.id] && hits(DISTRICT_ASSOCIATIONS[crop.id])) {
    score += 15;
    reasons.push(`District context (${p.district}) has a coarse catalogue association with this crop; validate with local experts.`);
  } else if (Object.values(DISTRICT_ASSOCIATIONS).some(hits)) {
    score -= 3;
    reasons.push(`District context (${p.district}) used as a small ranking adjustment, not a suitability guarantee.`);
  }
  return { score: Math.max(12, Math.min(97, pyRound(score))), reasons };
}

export function rankCrops(crops, profile) {
  return crops
    .map((crop) => ({ crop, ...scoreCrop(crop, profile) }))
    .sort((a, b) => b.score - a.score);
}
