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