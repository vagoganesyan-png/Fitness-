import { starterExercises } from "../data/exercises";
import type { FitnessData } from "../types";

const STORAGE_KEY = "fitness:data:v1";

const createInitialData = (): FitnessData => ({
  version: 1,
  exercises: starterExercises,
  workouts: [],
});

export const loadFitnessData = (): FitnessData => {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    const initialData = createInitialData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    return initialData;
  }

  try {
    const parsed = JSON.parse(raw) as FitnessData;
    if (parsed.version === 1 && Array.isArray(parsed.exercises) && Array.isArray(parsed.workouts)) {
      return parsed;
    }
  } catch {
    // Повреждённые данные не должны ломать приложение.
  }

  const fallbackData = createInitialData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackData));
  return fallbackData;
};

export const saveFitnessData = (data: FitnessData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const storageKey = STORAGE_KEY;
