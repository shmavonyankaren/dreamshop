// Persistence-only aggregation adapter. Production eligibility pipeline is executed unchanged.
const id = value => value?.toHexString ? value.toHexString() : value;
const get = (row, path) => path.split(".").reduce((value, key) => value?.[key], row);
const expression = (value, row) => {
  if (typeof value === "string" && value.startsWith("$")) return get(row, value.slice(1));
  if (value && typeof value === "object" && !value.toHexString) {
    if (value.$eq) return id(expression(value.$eq[0], row)) === id(expression(value.$eq[1], row));
    if (value.$arrayElemAt) return expression(value.$arrayElemAt[0], row)?.[value.$arrayElemAt[1]];
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expression(item, row)]));
  }
  return value;
};
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$and") return value.every(part => matches(row, part));
    if (key === "$or") return value.some(part => matches(row, part));
    if (key === "$expr") return expression(value, row);
    const actual = id(get(row, key));
    if (value && typeof value === "object" && !value.toHexString) {
      if ("$in" in value) return value.$in.map(id).includes(actual ?? null);
      if ("$ne" in value) return actual !== id(value.$ne);
      if ("$regex" in value) return new RegExp(value.$regex, value.$options).test(String(actual));
      if ("$exists" in value) return (actual !== undefined) === value.$exists;
    }
    return actual === id(value);
  });
}
function aggregate(pipeline, collections) {
  let rows = [...collections.products].map(row => ({ ...row }));
  for (const stage of pipeline) {
    if (stage.$match) rows = rows.filter(row => matches(row, stage.$match));
    else if (stage.$lookup) { const l = stage.$lookup; rows = rows.map(row => ({ ...row, [l.as]: [...collections[l.from]].filter(other => id(get(other, l.foreignField)) === id(get(row, l.localField))) })); }
    else if (stage.$unwind) { const field = stage.$unwind.slice(1); rows = rows.flatMap(row => (row[field] ?? []).map(value => ({ ...row, [field]: value }))); }
    else if (stage.$sort) rows.sort((a, b) => { for (const [key, direction] of Object.entries(stage.$sort)) { if (get(a, key) > get(b, key)) return direction; if (get(a, key) < get(b, key)) return -direction; } return 0; });
    else if ("$skip" in stage) rows = rows.slice(stage.$skip);
    else if (stage.$limit) rows = rows.slice(0, stage.$limit);
    else if (stage.$count) rows = rows.length ? [{ [stage.$count]: rows.length }] : [];
    else if (stage.$project) rows = rows.map(row => Object.fromEntries(Object.entries(stage.$project).map(([key, value]) => [key, value === 1 ? row[key] : expression(value, row)])));
    else throw new Error("Unsupported test pipeline stage: " + Object.keys(stage));
  }
  return rows;
}
function fixtures(products, owner = "a".repeat(24)) {
  return { products: [...products], stores: [{ _id: owner, owner, status: "active", name: "Fixture store", slug: "fixture-store" }], users: [{ _id: owner, status: "active", applicationStatus: "active", merchantStatus: "approved" }], categories: [...products].map(p => p.category).filter(c => c && typeof c === "object") };
}
module.exports = { aggregate, matches, fixtures };
