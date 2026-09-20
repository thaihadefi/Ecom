const FORMULA_START = /^[=+\-@\t\r]/;

export const safeCsvOptions = {
  formatters: {
    string: (value: string): string => {
      const text = FORMULA_START.test(value) ? `'${value}` : value;
      return `"${text.replace(/"/g, '""')}"`;
    },
  },
};
