export type MuscleGroup =
  | "Грудь"
  | "Спина"
  | "Ноги"
  | "Плечи"
  | "Руки"
  | "Пресс"
  | "Все тело";

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface Set {
  id: string;
  weight: number;
  repetitions: number;
  rir?: number;
  completed: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  primaryMuscleSnapshot: MuscleGroup;
  secondaryMusclesSnapshot: MuscleGroup[];
  order: number;
  sets: Set[];
}

export interface Workout {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "active" | "completed";
  exercises: WorkoutExercise[];
}

export interface FitnessData {
  version: 1;
  exercises: Exercise[];
  workouts: Workout[];
}
