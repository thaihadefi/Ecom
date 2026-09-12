import crypto from 'crypto';

export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const generateRandomString = (length: number = 6): string => {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters[crypto.randomInt(characters.length)];
  }
  return result;
}

export const generateRandomNumber = (length: number = 4): string => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += crypto.randomInt(10).toString();
  }
  return result;
}

export const shuffleArray = <T>(items: T[]): T[] => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
