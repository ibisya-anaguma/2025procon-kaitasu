export type ClassDictionary = Record<string, boolean | null | undefined>;
export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassDictionary
  | ClassValue[];

const appendClass = (value: ClassValue, classes: string[]): void => {
  if (!value && value !== 0) {
    return;
  }

  if (typeof value === "string" || typeof value === "number") {
    if (value === "") {
      return;
    }

    classes.push(String(value));
    return;
  }

  if (typeof value === "boolean") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => appendClass(item, classes));
    return;
  }

  Object.entries(value).forEach(([key, condition]) => {
    if (condition) {
      classes.push(key);
    }
  });
};

export const cn = (...inputs: ClassValue[]): string => {
  const classes: string[] = [];

  inputs.forEach((value) => appendClass(value, classes));

  return classes.join(" ");
};
