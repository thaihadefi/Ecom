export type CategoryLike = {
  _id?: unknown;
  id?: string;
  name?: string | null;
  avatar?: string | null;
  slug?: string | null;
  status?: string | null;
  parent?: string | null;
};

export interface CategoryTreeNode {
  id: string;
  name?: string;
  avatar?: string;
  slug?: string;
  status?: string;
  children: CategoryTreeNode[];
}

export function buildCategoryTree(categories: CategoryLike[], parentId: string = ""): CategoryTreeNode[] {
  const currentLevelCategories = categories.filter(
    (category) => (category.parent || "") === parentId
  );

  const tree = currentLevelCategories.map((category) => {
    const id = String(category._id || category.id || "");
    const children = buildCategoryTree(categories, id);

    return {
      id: id,
      name: category.name || undefined,
      avatar: category.avatar || undefined,
      slug: category.slug || undefined,
      status: category.status || undefined,
      children: children,
    };
  });

  return tree;
}
