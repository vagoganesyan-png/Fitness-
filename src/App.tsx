import { useEffect, useState } from "react";
import { loadFitnessData, saveFitnessData, storageKey } from "./lib/storage";
import type { FitnessData } from "./types";

const navigation = ["Главная", "История", "Упражнения", "Статистика"];

function App() {
  const [data, setData] = useState<FitnessData>(() => loadFitnessData());
  const [activeTab, setActiveTab] = useState("Главная");

  useEffect(() => {
    saveFitnessData(data);
  }, [data]);

  const lastWorkout = [...data.workouts]
    .filter((workout) => workout.status === "completed")
    .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))[0];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PERSONAL TRAINING LOG</p>
          <h1>Fitness</h1>
        </div>
        <span className="status-dot" aria-label="Локальное хранение включено" />
      </header>

      <section className="hero-card">
        <p className="eyebrow">ЭТАП 1 · ОСНОВА</p>
        <h2>Тренируйся. Записывай. Сравнивай.</h2>
        <p className="muted">
          Основа дневника готова: данные сохраняются на этом устройстве, а справочник уже содержит 30 упражнений.
        </p>
        <button className="primary-button" type="button" onClick={() => setActiveTab("История")}>
          Скоро начнём тренировку
        </button>
      </section>

      <section className="stats-grid" aria-label="Состояние приложения">
        <div className="stat-card">
          <span className="stat-value">{data.exercises.length}</span>
          <span className="stat-label">упражнений в базе</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.workouts.length}</span>
          <span className="stat-label">тренировок записано</span>
        </div>
      </section>

      <section className="content-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">СОСТОЯНИЕ</p>
            <h3>{activeTab}</h3>
          </div>
          <span className="pill">Локально</span>
        </div>

        {activeTab === "Главная" && (
          <div className="empty-state">
            <span className="empty-icon">◎</span>
            <strong>{lastWorkout ? "Последняя тренировка сохранена" : "Тренировок пока нет"}</strong>
            <p className="muted">
              На следующем этапе здесь появится активная тренировка с упражнениями и подходами.
            </p>
          </div>
        )}

        {activeTab === "Упражнения" && (
          <div className="exercise-preview">
            {data.exercises.slice(0, 6).map((item) => (
              <div className="exercise-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.primaryMuscle}</span>
                </div>
                <span className="row-arrow">→</span>
              </div>
            ))}
            <p className="muted small-text">Полный справочник будет доступен на Этапе 3.</p>
          </div>
        )}

        {activeTab === "История" && (
          <div className="empty-state">
            <span className="empty-icon">◷</span>
            <strong>История появится после первой тренировки</strong>
            <p className="muted">Модель Workout уже подготовлена в основе приложения.</p>
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

      <nav className="bottom-nav" aria-label="Основная навигация">
        {navigation.map((item) => (
          <button
            className={activeTab === item ? "nav-item active" : "nav-item"}
            key={item}
            type="button"
            onClick={() => setActiveTab(item)}
          >
            <span className="nav-mark" />
            {item}
          </button>
        ))}
      </nav>

      <p className="storage-note">Хранилище: {storageKey}</p>
    </main>
  );
}

export default App;
