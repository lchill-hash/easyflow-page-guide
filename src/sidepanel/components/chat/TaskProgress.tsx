import type { TaskProgressStage } from "../../guide/taskProgress";

interface TaskProgressProps {
  stages: TaskProgressStage[];
}

export function TaskProgress({ stages }: TaskProgressProps) {
  if (stages.length === 0) return null;
  return (
    <nav className="ef-task-progress" aria-label="任务进度">
      <ol>
        {stages.map((stage, index) => (
          <li key={stage.key} data-status={stage.status} aria-current={stage.status === "current" ? "step" : undefined}>
            <span className="ef-task-progress-dot" aria-hidden="true" />
            <span className="ef-task-progress-label">{stage.label}</span>
            {index < stages.length - 1 ? <span className="ef-task-progress-arrow" aria-hidden="true">→</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
