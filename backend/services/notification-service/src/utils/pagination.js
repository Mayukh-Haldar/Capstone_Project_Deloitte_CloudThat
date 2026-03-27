const parsePagination = (query = {}) => {
  const page = Math.max(Number(query.page) || 0, 0);
  const size = Math.min(Math.max(Number(query.size) || 20, 1), 100);
  return {
    page,
    size,
    skip: page * size
  };
};

const buildPage = ({ items, page, size, totalElements }) => ({
  content: items,
  page,
  size,
  totalElements,
  totalPages: totalElements === 0 ? 0 : Math.ceil(totalElements / size)
});

module.exports = { parsePagination, buildPage };
