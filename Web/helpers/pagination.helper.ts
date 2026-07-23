export interface Pagination {
  totalRecord: number;
  totalPage: number;
  currentPage: number;
  limitItems: number;
  skip: number;
}

export const getPagination = (
  queryPage: any,
  limitItems: number,
  totalRecord: number
): Pagination => {
  let page = 1;
  if (queryPage) {
    const parsedPage = parseInt(`${queryPage}`, 10);
    if (parsedPage > 0) {
      page = parsedPage;
    }
  }

  const totalPage = Math.ceil(totalRecord / limitItems) || 1;
  const skip = (page - 1) * limitItems;

  return {
    totalRecord,
    totalPage,
    currentPage: page,
    limitItems,
    skip,
  };
};
