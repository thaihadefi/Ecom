// json2csv needs plain values: ObjectIds become id strings and Dates ISO strings, which is also the
// shape the product CSV import reads back.
export const toCsvRows = <T>(docs: T[]): Record<string, unknown>[] => JSON.parse(JSON.stringify(docs));

const FORMULA_START = /^[=+\-@\t\r]/;

export const safeCsvOptions = {
  formatters: {
    string: (value: string): string => {
      const text = FORMULA_START.test(value) ? `'${value}` : value;
      return `"${text.replace(/"/g, '""')}"`;
    },
  },
};
