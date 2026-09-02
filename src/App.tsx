import { useEffect, useMemo, useRef, useState } from "react";
import { loadFitnessData, saveFitnessData, storageKey } from "./lib/storage";
import type { Exercise, FitnessData, MuscleGroup, Set, Workout, WorkoutExercise } from "./types";

const navigation = ["Главная", "История", "Упражнения", "Статистика"];
const muscleGroups: MuscleGroup[] = ["Грудь", "Спина", "Ноги", "Плечи", "Руки", "Пресс", "Все тело"];
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const emptySet = (): Set => ({ id: makeId("set"), weight: 0, repetitions: 0, completed: false });
const createWorkout = (): Workout => ({ id: makeId("workout"), startedAt: new Date().toISOString(), status: "active", exercises: [] });
const createWorkoutExercise = (item: Exercise, order: number): WorkoutExercise => ({
  id: makeId("workout-exercise"), exerciseId: item.id, exerciseNameSnapshot: item.name,
  primaryMuscleSnapshot: item.primaryMuscle, secondaryMusclesSnapshot: item.secondaryMuscles,
  order, sets: [emptySet(), emptySet(), emptySet()],
});
const cloneExerciseForRepeat = (item: WorkoutExercise, order: number): WorkoutExercise => ({
  ...item, id: makeId("workout-exercise"), order, sets: [emptySet(), emptySet(), emptySet()],
});
type ExerciseForm = { name: string; primaryMuscle: MuscleGroup; secondaryMuscles: MuscleGroup[] };
const blankExerciseForm: ExerciseForm = { name: "", primaryMuscle: "Грудь", secondaryMuscles: [] };

const formatDate = (date: string) => new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const formatTime = (date: string) => new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function App() {
  const [data, setData] = useState<FitnessData>(() => loadFitnessData());
  const [activeTab, setActiveTab] = useState("Главная");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [viewingWorkoutId, setViewingWorkoutId] = useState<string | null>(null);
  const [exerciseForm, setExerciseForm] = useState<ExerciseForm>(blankExerciseForm);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [formOrigin, setFormOrigin] = useState<"directory" | "workout">("directory");
  const [backupMessage, setBackupMessage] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const [statsPeriod, setStatsPeriod] = useState<"week" | "month" | "3months" | "6months" | "year" | "all" | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => { saveFitnessData(data); }, [data]);

  const activeWorkout = data.workouts.find((workout) => workout.status === "active");
  const editingWorkout = editingWorkoutId ? data.workouts.find((workout) => workout.id === editingWorkoutId) : undefined;
  const workoutInEditor = editingWorkout ?? activeWorkout;
  const lastWorkout = useMemo(
    () => [...data.workouts].filter((workout) => workout.status === "completed")
      .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))[0],
    [data.workouts],
  );
  const completedWorkouts = useMemo(
    () => [...data.workouts].filter((workout) => workout.status === "completed")
      .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt)),
    [data.workouts],
  );
  const viewedWorkout = data.workouts.find((workout) => workout.id === viewingWorkoutId);

  const formatKg = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });

  const downloadBackup = () => {
    const file = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fitness-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupMessage("Резервная копия скачана");
  };

  const importBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as FitnessData;
        if (imported.version !== 1 || !Array.isArray(imported.exercises) || !Array.isArray(imported.workouts)) throw new Error("invalid");
        setData(imported);
        setBackupMessage("Данные восстановлены");
      } catch {
        setBackupMessage("Не удалось прочитать файл");
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const openImport = () => importInputRef.current?.click();

  const getStatsRanges = () => {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);
    if (statsPeriod === "week") start.setDate(start.getDate() - 6);
    if (statsPeriod === "month") start.setDate(start.getDate() - 29);
    if (statsPeriod === "3months") start.setDate(start.getDate() - 89);
    if (statsPeriod === "6months") start.setDate(start.getDate() - 179);
    if (statsPeriod === "year") start.setDate(start.getDate() - 364);
    if (statsPeriod === "all") {
      const dates = data.workouts.filter((workout) => workout.status === "completed").map((workout) => new Date(workout.completedAt ?? workout.startedAt).getTime());
      start = dates.length ? new Date(Math.min(...dates)) : new Date(now);
    }
    if (statsPeriod === "custom" && customStart) start = new Date(`${customStart}T00:00:00`);
    if (statsPeriod === "custom" && customEnd) end.setTime(new Date(`${customEnd}T23:59:59.999`).getTime());
    const duration = Math.max(1, end.getTime() - start.getTime() + 1);
    return { current: { start, end }, previous: { start: new Date(start.getTime() - duration), end: new Date(start.getTime() - 1) } };
  };

  const volumeForRange = (range: { start: Date; end: Date }) => {
    const byMuscle: Record<string, number> = {};
    let total = 0;
    data.workouts.filter((workout) => {
      if (workout.status !== "completed") return false;
      const date = new Date(workout.completedAt ?? workout.startedAt);
      return date >= range.start && date <= range.end;
    }).forEach((workout) => workout.exercises.forEach((exercise) => exercise.sets.forEach((item) => {
      if (!item.completed || item.weight <= 0 || item.repetitions <= 0) return;
      const volume = item.weight * item.repetitions;
      total += volume;
      byMuscle[exercise.primaryMuscleSnapshot] = (byMuscle[exercise.primaryMuscleSnapshot] ?? 0) + volume;
    })));
    return { total, byMuscle };
  };

  const renderStats = () => {
    const ranges = getStatsRanges();
    const currentStats = volumeForRange(ranges.current);
    const previousStats = volumeForRange(ranges.previous);
    const delta = previousStats.total > 0 ? ((currentStats.total - previousStats.total) / previousStats.total) * 100 : null;
    const muscles = Object.entries(currentStats.byMuscle).sort((a, b) => b[1] - a[1]);
    const periodLabels = { week: "Неделя", month: "Месяц", "3months": "3 месяца", "6months": "6 месяцев", year: "Год", all: "Всё время", custom: "Свои даты" };
    return <div className="stats-panel">
      <div className="period-picker">{Object.entries(periodLabels).map(([key, label]) => <button className={statsPeriod === key ? "period-button active" : "period-button"} type="button" key={key} onClick={() => setStatsPeriod(key as typeof statsPeriod)}>{label}</button>)}</div>
      {statsPeriod === "custom" && <div className="date-picker"><label>С<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><label>По<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></div>}
      <div className="volume-card"><span className="eyebrow">ОБЩИЙ ОБЪЁМ · {periodLabels[statsPeriod].toUpperCase()}</span><strong>{formatKg(currentStats.total)} кг</strong><span className={delta === null ? "comparison neutral" : delta >= 0 ? "comparison positive" : "comparison negative"}>{delta === null ? "Нет данных для сравнения" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% к предыдущему периоду`}</span></div>
      <div className="stats-section"><div className="section-heading"><div><p className="eyebrow">РАСПРЕДЕЛЕНИЕ</p><h3>По группам мышц</h3></div></div>
        {muscles.length === 0 ? <div className="compact-empty"><strong>Нет выполненных подходов</strong><span className="muted">Отметьте подход выполненным, чтобы он попал в объём.</span></div> : <div className="muscle-bars">{muscles.map(([muscle, volume]) => <div className="muscle-bar-row" key={muscle}><div><span>{muscle}</span><strong>{formatKg(volume)} кг</strong></div><div className="bar-track"><span style={{ width: `${Math.max(4, (volume / muscles[0][1]) * 100)}%` }} /></div></div>)}</div>}
      </div>
    </div>;
  };

  const previousExerciseFor = (exerciseId: string, currentWorkoutId: string) => {
    const previousWorkouts = [...data.workouts]
      .filter((workout) => workout.status === "completed" && workout.id !== currentWorkoutId)
      .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt));
    for (const workout of previousWorkouts) {
      const exercise = workout.exercises.find((item) => item.exerciseId === exerciseId);
      if (exercise) return exercise;
    }
    return undefined;
  };

  const updateWorkout = (workoutId: string, update: (workout: Workout) => Workout) => {
    setData((previous) => ({ ...previous, workouts: previous.workouts.map((workout) =>
      workout.id === workoutId ? update(workout) : workout) }));
  };
  const updateEditorWorkout = (update: (workout: Workout) => Workout) => {
    if (workoutInEditor) updateWorkout(workoutInEditor.id, update);
  };

  const startWorkout = () => {
    if (activeWorkout) { setEditingWorkoutId(null); setActiveTab("Тренировка"); return; }
    setData((previous) => ({ ...previous, workouts: [...previous.workouts, createWorkout()] }));
    setEditingWorkoutId(null);
    setActiveTab("Тренировка");
  };

  const addExerciseToWorkout = (exercise: Exercise) => {
    updateEditorWorkout((workout) => ({ ...workout, exercises: [...workout.exercises, createWorkoutExercise(exercise, workout.exercises.length)] }));
  };
  const addExercise = () => {
    const exercise = data.exercises.find((item) => item.id === selectedExerciseId);
    if (exercise) addExerciseToWorkout(exercise);
    setSelectedExerciseId("");
  };
  const updateSet = (exerciseId: string, setId: string, update: Partial<Set>) => {
    updateEditorWorkout((workout) => ({ ...workout, exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId ? { ...exercise, sets: exercise.sets.map((item) => item.id === setId ? { ...item, ...update } : item) } : exercise) }));
  };
  const addSet = (exerciseId: string) => {
    updateEditorWorkout((workout) => ({ ...workout, exercises: workout.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      const previousSet = exercise.sets[exercise.sets.length - 1];
      return { ...exercise, sets: [...exercise.sets, { ...emptySet(), weight: previousSet?.weight ?? 0 }] };
    }) }));
  };
  const removeSet = (exerciseId: string, setId: string) => {
    updateEditorWorkout((workout) => ({ ...workout, exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId ? { ...exercise, sets: exercise.sets.filter((item) => item.id !== setId) } : exercise) }));
  };
  const removeExercise = (exerciseId: string) => {
    updateEditorWorkout((workout) => ({ ...workout, exercises: workout.exercises.filter((exercise) => exercise.id !== exerciseId)
      .map((exercise, index) => ({ ...exercise, order: index })) }));
  };
  const moveExercise = (exerciseId: string, direction: -1 | 1) => {
    updateEditorWorkout((workout) => {
      const index = workout.exercises.findIndex((exercise) => exercise.id === exerciseId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= workout.exercises.length) return workout;
      const exercises = [...workout.exercises];
      [exercises[index], exercises[targetIndex]] = [exercises[targetIndex], exercises[index]];
      return { ...workout, exercises: exercises.map((exercise, itemIndex) => ({ ...exercise, order: itemIndex })) };
    });
  };
  const finishWorkout = () => {
    if (!workoutInEditor) return;
    if (workoutInEditor.status === "active") {
      updateWorkout(workoutInEditor.id, (workout) => ({ ...workout, status: "completed", completedAt: new Date().toISOString() }));
    }
    setEditingWorkoutId(null);
    setActiveTab("История");
  };

  const repeatWorkout = (source: Workout) => {
    if (activeWorkout && !window.confirm("Текущая тренировка будет заменена новой. Продолжить?")) return;
    const repeated: Workout = {
      id: makeId("workout"), startedAt: new Date().toISOString(), status: "active",
      exercises: source.exercises.map((exercise, index) => cloneExerciseForRepeat(exercise, index)),
    };
    setData((previous) => ({
      ...previous,
      workouts: [...previous.workouts.filter((workout) => workout.status !== "active"), repeated],
    }));
    setEditingWorkoutId(null);
    setViewingWorkoutId(null);
    setActiveTab("Тренировка");
  };

  const openWorkout = (workoutId: string) => { setViewingWorkoutId(workoutId); setActiveTab("История"); };
  const editWorkout = (workoutId: string) => { setEditingWorkoutId(workoutId); setViewingWorkoutId(null); setActiveTab("Тренировка"); };
  const deleteWorkout = (workoutId: string) => {
    if (!window.confirm("Удалить эту тренировку?")) return;
    setData((previous) => ({ ...previous, workouts: previous.workouts.filter((workout) => workout.id !== workoutId) }));
    setViewingWorkoutId(null);
  };

  const openNewExercise = (origin: "directory" | "workout") => {
    setEditingExerciseId(null); setExerciseForm(blankExerciseForm); setFormOrigin(origin); setShowExerciseForm(true);
  };
  const openEditExercise = (exercise: Exercise) => {
    setEditingExerciseId(exercise.id);
    setExerciseForm({ name: exercise.name, primaryMuscle: exercise.primaryMuscle, secondaryMuscles: exercise.secondaryMuscles });
    setFormOrigin("directory"); setShowExerciseForm(true);
  };
  const saveExercise = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = exerciseForm.name.trim();
    if (!name) return;
    if (editingExerciseId) {
      setData((previous) => ({ ...previous, exercises: previous.exercises.map((exercise) =>
        exercise.id === editingExerciseId ? { ...exercise, ...exerciseForm, name, updatedAt: new Date().toISOString() } : exercise) }));
    } else {
      const created: Exercise = { id: makeId("exercise"), ...exerciseForm, name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      setData((previous) => ({ ...previous, exercises: [...previous.exercises, created] }));
      if (formOrigin === "workout" && workoutInEditor) addExerciseToWorkout(created);
    }
    setShowExerciseForm(false); setExerciseForm(blankExerciseForm);
  };
  const deleteExercise = (exerciseId: string) => {
    if (!window.confirm("Удалить упражнение из справочника? Старые тренировки не изменятся.")) return;
    setData((previous) => ({ ...previous, exercises: previous.exercises.filter((exercise) => exercise.id !== exerciseId) }));
  };
  const toggleSecondaryMuscle = (group: MuscleGroup) => {
    setExerciseForm((previous) => ({ ...previous, secondaryMuscles: previous.secondaryMuscles.includes(group)
      ? previous.secondaryMuscles.filter((item) => item !== group) : [...previous.secondaryMuscles, group] }));
  };

  const renderExerciseForm = () => showExerciseForm && <div className="form-panel">
    <div className="section-heading"><div><p className="eyebrow">{editingExerciseId ? "РЕДАКТИРОВАНИЕ" : "НОВОЕ УПРАЖНЕНИЕ"}</p><h3>{editingExerciseId ? "Изменить упражнение" : "Добавить упражнение"}</h3></div><button className="close-button" type="button" onClick={() => setShowExerciseForm(false)}>×</button></div>
    <form onSubmit={saveExercise}>
      <label>Название<input autoFocus required value={exerciseForm.name} onChange={(event) => setExerciseForm({ ...exerciseForm, name: event.target.value })} /></label>
      <label>Основная группа мышц<select value={exerciseForm.primaryMuscle} onChange={(event) => setExerciseForm({ ...exerciseForm, primaryMuscle: event.target.value as MuscleGroup })}>{muscleGroups.map((group) => <option key={group}>{group}</option>)}</select></label>
      <fieldset><legend>Дополнительные группы</legend><div className="muscle-options">{muscleGroups.filter((group) => group !== exerciseForm.primaryMuscle).map((group) => <label className="checkbox-label" key={group}><input type="checkbox" checked={exerciseForm.secondaryMuscles.includes(group)} onChange={() => toggleSecondaryMuscle(group)} />{group}</label>)}</div></fieldset>
      <button className="primary-button form-submit" type="submit">{editingExerciseId ? "Сохранить изменения" : "Создать упражнение"}</button>
    </form>
  </div>;

  const renderWorkout = () => {
    if (!workoutInEditor) return <div className="empty-state"><span className="empty-icon">✓</span><strong>Тренировки нет</strong><p className="muted">Вернитесь в историю или начните новую тренировку.</p></div>;
    const isEditingCompleted = workoutInEditor.status === "completed";
    return <div className="workout-editor">
      <div className="workout-toolbar"><button className="text-button" type="button" onClick={() => { setEditingWorkoutId(null); setActiveTab(isEditingCompleted ? "История" : "Главная"); }}>← Назад</button><span className="pill">{isEditingCompleted ? "Редактирование" : "В процессе"}</span></div>
      <div className="exercise-picker"><select aria-label="Выберите упражнение" value={selectedExerciseId} onChange={(event) => setSelectedExerciseId(event.target.value)}><option value="">Выбрать упражнение</option>{data.exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select><button className="secondary-button" type="button" onClick={addExercise} disabled={!selectedExerciseId}>Добавить</button></div>
      {!isEditingCompleted && <button className="quick-add-button" type="button" onClick={() => openNewExercise("workout")}>＋ Быстро создать новое упражнение</button>}
      {workoutInEditor.exercises.length === 0 && <div className="compact-empty"><strong>Добавьте упражнение</strong><span className="muted">Тренировку можно завершить даже пустой.</span></div>}
      {workoutInEditor.exercises.map((exercise, index) => {
      const previousExercise = previousExerciseFor(exercise.exerciseId, workoutInEditor.id);
      return <article className="workout-exercise" key={exercise.id}>
        <div className="exercise-header"><div><span className="exercise-number">{index + 1}</span><div><strong>{exercise.exerciseNameSnapshot}</strong><span>{exercise.primaryMuscleSnapshot}</span></div></div><div className="icon-actions"><button type="button" aria-label="Поднять упражнение" onClick={() => moveExercise(exercise.id, -1)} disabled={index === 0}>↑</button><button type="button" aria-label="Опустить упражнение" onClick={() => moveExercise(exercise.id, 1)} disabled={index === workoutInEditor.exercises.length - 1}>↓</button><button type="button" aria-label="Удалить упражнение" onClick={() => removeExercise(exercise.id)}>×</button></div></div>
        <div className="set-list">{exercise.sets.map((item, setIndex) => {
          const previousSet = previousExercise?.sets[setIndex];
          return <div className="set-entry" key={item.id}>
            <div className={item.completed ? "set-row completed" : "set-row"}><span className="set-number">{setIndex + 1}</span><input aria-label={`Вес, подход ${setIndex + 1}`} type="number" min="0" step="0.1" value={item.weight === 0 ? "" : item.weight} placeholder="0" onChange={(event) => updateSet(exercise.id, item.id, { weight: Number(event.target.value) || 0 })} /><span className="input-suffix">кг</span><input aria-label={`Повторения, подход ${setIndex + 1}`} type="number" min="0" step="1" value={item.repetitions === 0 ? "" : item.repetitions} placeholder="0" onChange={(event) => updateSet(exercise.id, item.id, { repetitions: Number(event.target.value) || 0 })} /><span className="input-suffix">раз</span><input aria-label={`RIR, подход ${setIndex + 1}`} className="rir-input" type="number" min="0" step="1" placeholder="RIR" value={item.rir ?? ""} onChange={(event) => updateSet(exercise.id, item.id, { rir: event.target.value === "" ? undefined : Number(event.target.value) })} /><button className="check-button" type="button" aria-label={item.completed ? "Отменить выполнение" : "Отметить выполненным"} onClick={() => updateSet(exercise.id, item.id, { completed: !item.completed })}>{item.completed ? "✓" : "○"}</button><button className="remove-set" type="button" aria-label="Удалить подход" onClick={() => removeSet(exercise.id, item.id)}>×</button></div>
            {previousSet && <span className="past-result">Прошлый раз: {previousSet.weight} кг × {previousSet.repetitions}{previousSet.rir !== undefined ? ` · RIR ${previousSet.rir}` : ""}{previousSet.completed ? " ✓" : ""}</span>}
          </div>;
        })}</div><button className="add-set-button" type="button" onClick={() => addSet(exercise.id)}>+ Добавить подход</button>
      </article>;
      })}
      <button className="finish-button" type="button" onClick={finishWorkout}>{isEditingCompleted ? "Сохранить изменения" : "Завершить тренировку"}</button>
      {renderExerciseForm()}
    </div>;
  };

  const renderWorkoutDetails = () => viewedWorkout && <div className="history-detail">
    <div className="detail-header"><button className="text-button" type="button" onClick={() => setViewingWorkoutId(null)}>← Все тренировки</button><button className="danger-text detail-delete" type="button" onClick={() => deleteWorkout(viewedWorkout.id)}>Удалить</button></div>
    <p className="eyebrow">ТРЕНИРОВКА</p><h3>{formatDate(viewedWorkout.completedAt ?? viewedWorkout.startedAt)}</h3><p className="muted detail-time">{formatTime(viewedWorkout.completedAt ?? viewedWorkout.startedAt)} · {viewedWorkout.exercises.length} упражнений</p>
    {viewedWorkout.exercises.length === 0 && <div className="compact-empty"><strong>Тренировка завершена без упражнений</strong></div>}
    {viewedWorkout.exercises.map((exercise, index) => <article className="history-exercise" key={exercise.id}><div className="history-exercise-title"><strong>{index + 1}. {exercise.exerciseNameSnapshot}</strong><span>{exercise.primaryMuscleSnapshot}</span></div>{exercise.sets.length ? <div className="history-sets">{exercise.sets.map((item, setIndex) => <span key={item.id}>{setIndex + 1}. {item.weight} кг × {item.repetitions}{item.rir !== undefined ? ` · RIR ${item.rir}` : ""}{item.completed ? " ✓" : ""}</span>)}</div> : <p className="muted">Подходов нет</p>}</article>)}
    <div className="detail-actions"><button className="secondary-button" type="button" onClick={() => editWorkout(viewedWorkout.id)}>Редактировать</button><button className="primary-button" type="button" onClick={() => repeatWorkout(viewedWorkout)}>Повторить тренировку</button></div>
  </div>;

  const renderHistory = () => viewedWorkout ? renderWorkoutDetails() : <div className="history-list">
    {completedWorkouts.length === 0 && <div className="empty-state"><span className="empty-icon">◷</span><strong>История пока пуста</strong><p className="muted">Завершите первую тренировку, и она появится здесь.</p></div>}
    {completedWorkouts.map((workout) => <button className="history-row" type="button" key={workout.id} onClick={() => openWorkout(workout.id)}><span className="history-date">{formatDate(workout.completedAt ?? workout.startedAt)}</span><span className="history-meta">{workout.exercises.length} упражнений <b>→</b></span></button>)}
  </div>;

  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">PERSONAL TRAINING LOG</p><h1>Fitness</h1></div><span className="status-dot" aria-label="Локальное хранение включено" /></header>
    {activeTab === "Тренировка" ? <section className="content-card workout-card"><div className="section-heading"><div><p className="eyebrow">{editingWorkoutId ? "РЕДАКТИРОВАНИЕ" : "АКТИВНАЯ ТРЕНИРОВКА"}</p><h3>{editingWorkoutId ? "Изменить тренировку" : "Сегодня"}</h3></div></div>{renderWorkout()}</section> : <>
      <section className="hero-card"><p className="eyebrow">ЭТАП 4 · ИСТОРИЯ</p><h2>Тренируйся. Записывай. Сравнивай.</h2><p className="muted">{activeWorkout ? "У вас есть незавершённая тренировка. Можно продолжить её в любой момент." : "Каждая завершённая тренировка сохраняется на этом устройстве."}</p><div className="hero-actions"><button className="primary-button" type="button" onClick={startWorkout}>{activeWorkout ? "Продолжить тренировку" : "Начать тренировку"}</button>{lastWorkout && <button className="hero-link" type="button" onClick={() => repeatWorkout(lastWorkout)}>Повторить последнюю</button>}</div></section>
      <section className="stats-grid"><div className="stat-card"><span className="stat-value">{data.exercises.length}</span><span className="stat-label">упражнений в базе</span></div><div className="stat-card"><span className="stat-value">{completedWorkouts.length}</span><span className="stat-label">завершённых тренировок</span></div></section>
      {activeTab === "Главная" && <section className="backup-card">
        <div><p className="eyebrow">СОХРАННОСТЬ ДАННЫХ</p><h3>Резервная копия</h3><p className="muted">Скачайте данные, чтобы не потерять тренировки при очистке Safari или смене устройства.</p></div>
        <div className="backup-actions"><button className="secondary-button" type="button" onClick={downloadBackup}>Скачать данные</button><button className="text-button" type="button" onClick={openImport}>Восстановить</button></div>
        {backupMessage && <span className="backup-message">{backupMessage}</span>}
        <input ref={importInputRef} className="hidden-input" type="file" accept="application/json,.json" onChange={importBackup} />
      </section>}
      <section className="content-card"><div className="section-heading"><div><p className="eyebrow">РАЗДЕЛ</p><h3>{activeTab}</h3></div>{activeTab === "Упражнения" && <button className="secondary-button" type="button" onClick={() => openNewExercise("directory")}>＋ Добавить</button>}</div>
        {activeTab === "Главная" && <div className="empty-state"><span className="empty-icon">◎</span><strong>{lastWorkout ? "Последняя тренировка сохранена" : "Тренировок пока нет"}</strong><p className="muted">{lastWorkout ? "Откройте историю, чтобы посмотреть детали." : "Начните тренировку, чтобы появилась первая запись."}</p></div>}
        {activeTab === "История" && renderHistory()}
        {activeTab === "Упражнения" && <><div className="exercise-directory">{data.exercises.map((exercise) => <div className="directory-row" key={exercise.id}><div><strong>{exercise.name}</strong><span>{exercise.primaryMuscle}{exercise.secondaryMuscles.length ? ` · дополнительно: ${exercise.secondaryMuscles.join(", ")}` : ""}</span></div><div className="row-actions"><button type="button" onClick={() => openEditExercise(exercise)}>Изменить</button><button className="danger-text" type="button" onClick={() => deleteExercise(exercise.id)}>Удалить</button></div></div>)}</div>{renderExerciseForm()}</>}
        {activeTab === "Статистика" && renderStats()}
      </section>
    </>}
    <nav className="bottom-nav" aria-label="Основная навигация">{navigation.map((item) => <button className={activeTab === item ? "nav-item active" : "nav-item"} key={item} type="button" onClick={() => setActiveTab(item)}><span className="nav-mark" />{item}</button>)}</nav>
    <p className="storage-note">Хранилище: {storageKey}</p>
  </main>;
}

export default App;
