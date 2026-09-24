import { AVATAR_COUNT } from '@ludo/engine';

const NAMES = [
  'Aarav', 'Riya', 'Kabir', 'Isha', 'Vihaan', 'Anaya', 'Arjun', 'Diya', 'Rohan', 'Meera',
  'Aditya', 'Saanvi', 'Ishaan', 'Kavya', 'Reyansh', 'Myra', 'Dev', 'Tara', 'Krish', 'Pihu',
];

let counter = 0;

export function makeBot(exclude: Set<string>): { userId: string; name: string; avatar: number; level: number } {
  const pool = NAMES.filter((n) => !exclude.has(n));
  const name = pool[Math.floor(Math.random() * pool.length)] ?? 'Guest';
  exclude.add(name);
  counter = (counter + 1) % 1_000_000;
  return {
    userId: `bot-${counter}`,
    name,
    avatar: Math.floor(Math.random() * AVATAR_COUNT),
    level: 1 + Math.floor(Math.random() * 12),
  };
}
