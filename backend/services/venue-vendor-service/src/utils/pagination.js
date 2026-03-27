const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const buildPagination = (query) => {
  const page = toPositiveInt(query.page, 1);
  const limit = Math.min(toPositiveInt(query.limit, 20), 100);
  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

module.exports = { buildPagination };
