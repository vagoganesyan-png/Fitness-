import { useEffect, useMemo, useState } from "react";
import { loadFitnessData, saveFitnessData, storageKey } from "./lib/storage";
import type { Exercise, FitnessData, Set, Workout, WorkoutExercise } from "./types";

const navigation = ["Главная", "История", "Упражнения", "Статистика"];

const makeId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

const emptySet = (): Set => ({
  id: makeId("set"),
  weight: 0,
  repetitions: 0,
  completed: false,
});

const createWorkout = (): Workout => ({
  id: makeId("workout"),
  startedAt: new Date().toISOString(),
  status: "active",
  exercises: [],
});

const createWorkoutExercise = (item: Exercise, order: number): WorkoutExercise => ({
  id: makeId("workout-exercise"),
  exerciseId: item.id,
  exerciseNameSnapshot: item.name,
  primaryMuscleSnapshot: item.primaryMuscle,
  secondaryMusclesSnapshot: item.secondaryMuscles,
  order,
  sets: [emptySet(), emptySet(), emptySet()],
});

function App() {
  const [data, setData] = useState<FitnessData>(() => loadFitnessData());
  const [activeTab, setActiveTab] = useState("Главная");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");

  useEffect(() => {
    saveFitnessData(data);
  }, [data]);

  const activeWorkout = data.workouts.find((workout) => workout.status === "active");
  const lastWorkout = useMemo(
    () =>
      [...data.workouts]
        .filter((workout) => workout.status === "completed")
        .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))[0],
    [data.workouts],
  );

  const updateActiveWorkout = (update: (workout: Workout) => Workout) => {
    setData((previous) => ({
      ...previous,
      workouts: previous.workouts.map((workout) =>
        workout.status === "active" ? update(workout) : workout,
      ),
    }));
  };

  const startWorkout = () => {
    if (activeWorkout) {
      setActiveTab("Тренировка");
      return;
    }

    setData((previous) => ({ ...previous, workouts: [...previous.workouts, createWorkout()] }));
    setActiveTab("Тренировка");
  };

  const addExercise = () => {
    const exercise = data.exercises.find((item) => item.id === selectedExerciseId);
    if (!exercise) return;

    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: [...workout.exercises, createWorkoutExercise(exercise, workout.exercises.length)],
    }));
    setSelectedExerciseId("");
  };

  const updateSet = (exerciseId: string, setId: string, update: Partial<Set>) => {
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((item) => (item.id === setId ? { ...item, ...update } : item)),
            }
          : exercise,
      ),
    }));
  };

  const addSet = (exerciseId: string) => {
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        const previousSet = exercise.sets[exercise.sets.length - 1];
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            { ...emptySet(), weight: previousSet?.weight ?? 0 },
          ],
        };
      }),
    }));
  };

  const removeSet = (exerciseId: string, setId: string) => {
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: exercise.sets.filter((item) => item.id !== setId) }
          : exercise,
      ),
    }));
  };

  const removeExercise = (exerciseId: string) => {
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises
        .filter((exercise) => exercise.id !== exerciseId)
        .map((exercise, index) => ({ ...exercise, order: index })),
    }));
  };

  const moveExercise = (exerciseId: string, direction: -1 | 1) => {
    updateActiveWorkout((workout) => {
      const index = workout.exercises.findIndex((exercise) => exercise.id === exerciseId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= workout.exercises.length) return workout;

      const exercises = [...workout.exercises];
      [exercises[index], exercises[targetIndex]] = [exercises[targetIndex], exercises[index]];
      return { ...workout, exercises: exercises.map((exercise, itemIndex) => ({ ...exercise, order: itemIndex })) };
    });
  };

  const finishWorkout = () => {
    updateActiveWorkout((workout) => ({
      ...workout,
      status: "completed",
      completedAt: new Date().toISOString(),
    }));
    setActiveTab("Главная");
  };

  const renderWorkout = () => {
    if (!activeWorkout) {
      return (
        <div className="empty-state">
          <span className="empty-icon">✓</span>
          <strong>Активной тренировки нет</strong>
          <p className="muted">Начните новую тренировку с главного экрана.</p>
        </div>
      );
    }

    return (
      <div className="workout-editor">
        <div className="workout-toolbar">
          <button className="text-button" type="button" onClick={() => setActiveTab("Главная")}>← Назад</button>
          <span className="pill">В процессе</span>
        </div>

        <div className="exercise-picker">
          <select
            aria-label="Выберите упражнение"
            value={selectedExerciseId}
            onChange={(event) => setSelectedExerciseId(event.target.value)}
          >
            <option value="">Выбрать упражнение</option>
            {data.exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
            ))}
          </select>
          <button className="secondary-button" type="button" onClick={addExercise} disabled={!selectedExerciseId}>
            Добавить
          </button>
        </div>

        {activeWorkout.exercises.length === 0 && (
          <div className="compact-empty">
            <strong>Добавьте первое упражнение</strong>
            <span className="muted">Пустую тренировку тоже можно завершить.</span>
          </div>
        )}

        {activeWorkout.exercises.map((exercise, index) => (
          <article className="workout-exercise" key={exercise.id}>
            <div className="exercise-header">
              <div>
                <span className="exercise-number">{index + 1}</span>
                <div>
                  <strong>{exercise.exerciseNameSnapshot}</strong>
                  <span>{exercise.primaryMuscleSnapshot}</span>
                </div>
              </div>
              <div className="icon-actions">
                <button type="button" aria-label="Поднять упражнение" onClick={() => moveExercise(exercise.id, -1)} disabled={index === 0}>↑</button>
                <button type="button" aria-label="Опустить упражнение" onClick={() => moveExercise(exercise.id, 1)} disabled={index === activeWorkout.exercises.length - 1}>↓</button>
                <button type="button" aria-label="Удалить упражнение" onClick={() => removeExercise(exercise.id)}>×</button>
              </div>
            </div>

            <div className="set-list">
              {exercise.sets.map((item, setIndex) => (
                <div className={item.completed ? "set-row completed" : "set-row"} key={item.id}>
                  <span className="set-number">{setIndex + 1}</span>
                  <input
                    aria-label={`Вес, подход ${setIndex + 1}`}
                    type="number"
                    min="0"
                    step="0.5"
                    value={item.weight}
                    onChange={(event) => updateSet(exercise.id, item.id, { weight: Number(event.target.value) || 0 })}
                  />
                  <span className="input-suffix">кг</span>
                  <input
                    aria-label={`Повторения, подход ${setIndex + 1}`}
                    type="number"
                    min="0"
                    step="1"
                    value={item.repetitions}
                    onChange={(event) => updateSet(exercise.id, item.id, { repetitions: Number(event.target.value) || 0 })}
                  />
                  <span className="input-suffix">раз</span>
                  <input
                    aria-label={`RIR, подход ${setIndex + 1}`}
                    className="rir-input"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="RIR"
                    value={item.rir ?? ""}
                    onChange={(event) => updateSet(exercise.id, item.id, { rir: event.target.value === "" ? undefined : Number(event.target.value) })}
                  />
                  <button
                    className="check-button"
                    type="button"
                    aria-label={item.completed ? "Отменить выполнение" : "Отметить выполненным"}
                    onClick={() => updateSet(exercise.id, item.id, { completed: !item.completed })}
                  >
                    {item.completed ? "✓" : "○"}
                  </button>
                  <button className="remove-set" type="button" aria-label="Удалить подход" onClick={() => removeSet(exercise.id, item.id)}>×</button>
                </div>
              ))}
            </div>
            <button className="add-set-button" type="button" onClick={() => addSet(exercise.id)}>+ Добавить подход</button>
          </article>
        ))}

        <button className="finish-button" type="button" onClick={finishWorkout}>Завершить тренировку</button>
      </div>
    );
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PERSONAL TRAINING LOG</p>
          <h1>Fitness</h1>
        </div>
        <span className="status-dot" aria-label="Локальное хранение включено" />
      </header>

      {activeTab === "Тренировка" ? (
        <section className="content-card workout-card">
          <div className="section-heading">
            <div><p className="eyebrow">АКТИВНАЯ ТРЕНИРОВКА</p><h3>Сегодня</h3></div>
          </div>
          {renderWorkout()}
        </section>
      ) : (
        <>
          <section className="hero-card">
            <p className="eyebrow">ЭТАП 2 · АКТИВНАЯ ТРЕНИРОВКА</p>
            <h2>Тренируйся. Записывай. Сравнивай.</h2>
            <p className="muted">
              {activeWorkout
                ? "У вас есть незавершённая тренировка. Можно продолжить её в любой момент."
                : "Добавляйте упражнения и фиксируйте каждый подход прямо во время тренировки."}
            </p>
            <button className="primary-button" type="button" onClick={startWorkout}>
              {activeWorkout ? "Продолжить тренировку" : "Начать тренировку"}
            </button>
          </section>

          <section className="stats-grid" aria-label="Состояние приложения">
            <div className="stat-card"><span className="stat-value">{data.exercises.length}</span><span className="stat-label">упражнений в базе</span></div>
            <div className="stat-card"><span className="stat-value">{data.workouts.filter((item) => item.status === "completed").length}</span><span className="stat-label">завершённых тренировок</span></div>
          </section>

          <section className="content-card">
            <div className="section-heading">
              <div><p className="eyebrow">СОСТОЯНИЕ</p><h3>{activeTab}</h3></div>
              <span className="pill">Локально</span>
            </div>

            {activeTab === "Главная" && (
              <div className="empty-state">
                <span className="empty-icon">◎</span>
                <strong>{lastWorkout ? "Последняя тренировка сохранена" : "Тренировок пока нет"}</strong>
                <p className="muted">{lastWorkout ? "История будет доступна на следующем этапе." : "Начните тренировку, чтобы появилась первая запись."}</p>
              </div>
            )}

            {activeTab === "Упражнения" && (
              <div className="exercise-preview">
                {data.exercises.slice(0, 6).map((item) => (
                  <div className="exercise-row" key={item.id}><div><strong>{item.name}</strong><span>{item.primaryMuscle}</span></div><span className="row-arrow">→</span></div>
                ))}
                <p className="muted small-text">Редактирование справочника будет добавлено на Этапе 3.</p>
              </div>
            )}

            {activeTab === "История" && (
              <div className="empty-state">
                <span className="empty-icon">◷</span>
                <strong>{lastWorkout ? "Последняя тренировка записана" : "История появится после первой тренировки"}</strong>
                <p className="muted">Полноценный экран истории будет добавлен на Этапе 4.</p>
              </div>
            )}

            {activeTab === "Статистика" && (
              <div className="empty-state">
                <span className="empty-icon">↗</span>
                <strong>Статистика пока пуста</strong>
                <p className="muted">Расчёт объёма будет добавлен на Этапе 6.</p>
              </div>
            )}
          </section>
        </>
      )}

      <nav className="bottom-nav" aria-label="Основная навигация">
        {navigation.map((item) => (
          <button className={activeTab === item ? "nav-item active" : "nav-item"} key={item} type="button" onClick={() => setActiveTab(item)}>
            <span className="nav-mark" />{item}
          </button>
        ))}
      </nav>
      <p className="storage-note">Хранилище: {storageKey}</p>
    </main>
  );
}

export default App;
