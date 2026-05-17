export function normalizeIsbn(value: string) {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

export function isValidIsbn10(value: string) {
  const isbn = normalizeIsbn(value);
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = isbn.split("").reduce((total, char, index) => {
    const digit = char === "X" ? 10 : Number(char);
    return total + digit * (10 - index);
  }, 0);
  return sum % 11 === 0;
}

export function isValidIsbn13(value: string) {
  const isbn = normalizeIsbn(value);
  if (!/^\d{13}$/.test(isbn)) return false;
  const sum = isbn.split("").reduce((total, char, index) => {
    return total + Number(char) * (index % 2 === 0 ? 1 : 3);
  }, 0);
  return sum % 10 === 0;
}

export function isbn13To10(value: string) {
  const isbn = normalizeIsbn(value);
  if (!isbn.startsWith("978") || !isValidIsbn13(isbn)) return undefined;
  const base = isbn.slice(3, 12);
  const sum = base.split("").reduce((total, char, index) => total + Number(char) * (10 - index), 0);
  const check = 11 - (sum % 11);
  return `${base}${check === 10 ? "X" : check === 11 ? "0" : check}`;
}

export function isbn10To13(value: string) {
  const isbn = normalizeIsbn(value);
  if (!isValidIsbn10(isbn)) return undefined;
  const base = `978${isbn.slice(0, 9)}`;
  const sum = base.split("").reduce((total, char, index) => total + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return `${base}${check}`;
}
