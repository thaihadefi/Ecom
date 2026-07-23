export function buildCategoryTree(categories: any, parentId: string = "") {
  const currentLevelCategories = categories.filter(
    (category: any) => (category.parent || "") === parentId
  );

  const tree = currentLevelCategories.map((category: any) => {
    const id = String(category._id || category.id || "");
    const children = buildCategoryTree(categories, id);

    return {
      id: id,
      name: category.name,
      avatar: category.avatar,
      slug: category.slug,
      status: category.status,
      children: children,
    };
  });

  return tree;
}