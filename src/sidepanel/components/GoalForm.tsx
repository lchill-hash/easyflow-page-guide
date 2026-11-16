import { useEffect, useRef } from "react";

interface GoalFormProps {
  goal: string;
  onGoalChange: (goal: string) => void;
  onAnalyze: () => void;
  onRefresh: () => void;
  disabled: boolean;
  analyzing: boolean;
  loading: boolean;
  focusSignal: number;
}

export function GoalForm({
  goal,
  onGoalChange,
  onAnalyze,
  onRefresh,
  disabled,
  analyzing,
  loading,
  focusSignal,
}: GoalFormProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusSignal > 0) {
      inputRef.current?.focus();
    }
  }, [focusSignal]);

  return (
    <form
      className="ef-panel ef-goal-form"
      onSubmit={(event) => {
        event.preventDefault();
        onAnalyze();
      }}
    >
      <label className="ef-label" htmlFor="ef-goal">
        你想在当前页面了解什么？
      </label>
      <textarea
        id="ef-goal"
        ref={inputRef}
        className="ef-textarea"
        value={goal}
        rows={3}
        maxLength={200}
        placeholder="我想知道高龄津贴的申请条件和线下办理方式"
        onChange={(event) => {
          onGoalChange(event.target.value);
        }}
      />
      <div className="ef-actions">
        <button
          type="submit"
          className="ef-btn ef-btn-primary"
          disabled={disabled || analyzing}
        >
          {analyzing ? "分析中…" : "分析当前页"}
        </button>
        <button
          type="button"
          className="ef-btn"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "读取中…" : "重新读取页面"}
        </button>
      </div>
    </form>
  );
}