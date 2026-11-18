import { useEffect, useMemo, useRef, useState } from "react";
import type { CitationAnchor, GuideStep } from "../../../shared/types";
import { createProgress, parseProgress, SENIOR_PROGRESS_STORAGE_KEY } from "../../../shared/seniorProgress";
import type { SeniorProgress } from "../../../shared/seniorProgress";
import type { ConversationState } from "../../state/conversationReducer";
import { buildSuccessCitation, evaluateBookingSuccess } from "../../guide/bookingSuccess";
import { officialHelpLinks, pageQuestions, preparationEntries } from "./seniorAssistModel";
import { Icon } from "./Icon";

interface SeniorAssistPanelProps {
  open: boolean;
  onClose: () => void;
  state: ConversationState;
  activeStep: GuideStep | null;
  onSend: (text: string) => void;
  onLocateCitation: (citation: CitationAnchor) => void;
  onRefresh: () => void;
}

const HELP_TEXT = "我正在当前网页办理事情，遇到不太明白的地方。可以请您陪我一起看一下网页吗？";

export function SeniorAssistPanel({ open, onClose, state, activeStep, onSend, onLocateCitation, onRefresh }: SeniorAssistPanelProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<SeniorProgress | null>(null);
  const [progressMessage, setProgressMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [resumeRequested, setResumeRequested] = useState(false);
  const [resumeBaseSnapshot, setResumeBaseSnapshot] = useState<string | null>(null);
  const [helpText, setHelpText] = useState(HELP_TEXT);
  const helpRef = useRef<HTMLElement>(null);
  const preparation = useMemo(() => preparationEntries(state.snapshot), [state.snapshot]);
  const contacts = useMemo(() => officialHelpLinks(state.snapshot), [state.snapshot]);
  const questions = useMemo(() => pageQuestions(state.snapshot), [state.snapshot]);
  const bookingEvidence = useMemo(() => evaluateBookingSuccess(state.snapshot), [state.snapshot]);
  const bookingCitation = bookingEvidence.ok && bookingEvidence.titleItem !== null && state.snapshot !== null
    ? buildSuccessCitation(bookingEvidence.titleItem, state.snapshot.snapshotId)
    : null;

  useEffect(() => {
    setChecked({});
    if (state.snapshot === null || !resumeRequested) {
      setResumeRequested(false);
      setResumeBaseSnapshot(null);
    }
  }, [state.snapshot, resumeRequested]);

  useEffect(() => {
    if (open) helpRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  useEffect(() => {
    let current = true;
    void chrome.storage.local.get(SENIOR_PROGRESS_STORAGE_KEY).then((values) => {
      if (!current) return;
      setSaved(parseProgress(values[SENIOR_PROGRESS_STORAGE_KEY]));
    }).catch(() => {
      if (current) setProgressMessage("暂时无法读取本机保存的进度。");
    });
    return () => { current = false; };
  }, []);

  const matchingProgress = saved !== null && state.snapshot !== null && saved.domain === state.snapshot.domain;
  const canContinueAfterRead = matchingProgress && resumeRequested && !state.busy &&
    state.snapshot !== null && state.snapshot.snapshotId !== resumeBaseSnapshot;

  const saveProgress = async (): Promise<void> => {
    if (state.snapshot === null || !state.goal) return;
    const count = state.plan?.status === "active" ? state.plan.steps.length : 0;
    const index = count > 0 ? state.plan?.currentIndex ?? 0 : 0;
    const record = createProgress({
      goal: state.goal,
      stepLabel: activeStep?.targetControl.label ?? "",
      domain: state.snapshot.domain,
      stepIndex: index,
      stepCount: count,
    });
    if (record === null) {
      setProgressMessage("这段内容含有不适合保存的信息。为保护隐私，本次没有保存。");
      return;
    }
    try {
      await chrome.storage.local.set({ [SENIOR_PROGRESS_STORAGE_KEY]: record });
      setSaved(record);
      setProgressMessage("已保存在本机，7 天后失效；网页内容和办理结果不会保存。");
    } catch {
      setProgressMessage("保存失败，进度没有写入本机。");
    }
  };

  const removeProgress = async (): Promise<void> => {
    try {
      await chrome.storage.local.remove(SENIOR_PROGRESS_STORAGE_KEY);
      setSaved(null);
      setResumeRequested(false);
      setProgressMessage("已删除本机保存的进度。");
    } catch {
      setProgressMessage("暂时无法删除，请稍后重试。");
    }
  };

  const copyHelp = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(helpText);
      setCopyMessage("已复制。请先检查内容，再自行发给信任的人。");
    } catch {
      setCopyMessage("自动复制不可用。请选中上面的文字后手动复制。");
    }
  };

  if (state.snapshot === null && state.pageSuccess !== "confirmed" && !open) return null;

  return (
    <div className="ef-senior-assist">
      {questions.length > 0 ? (
        <section className="ef-senior-questions" aria-label="根据当前页面可问的问题">
          <span>可以直接问</span>
          <div>{questions.map((question) => <button type="button" key={question.id} onClick={() => onSend(question.prompt)} disabled={state.busy}>{question.label}</button>)}</div>
        </section>
      ) : null}
      {state.pageSuccess === "confirmed" ? (
        <section className="ef-senior-result" role="status" aria-label="网页办理结果">
          <strong>当前网页出现预约成功提示</strong>
          <span>请以网页当前显示为准；EasyFlow 没有替你提交或支付。</span>
          {bookingCitation !== null ? (
            <button type="button" className="ef-inline-link" onClick={() => onLocateCitation(bookingCitation)}><Icon name="target" />查看网页成功提示</button>
          ) : null}
        </section>
      ) : null}

      {preparation.length > 0 ? (
        <section className="ef-senior-checklist" aria-labelledby="ef-senior-checklist-title">
          <div className="ef-senior-section-title">
            <div><h2 id="ef-senior-checklist-title">网页提到的准备事项</h2><p>每项都来自当前页面，可点“看原文”核对。</p></div>
          </div>
          <ul>
            {preparation.map((item) => (
              <li key={item.id}>
                <label><input type="checkbox" checked={checked[item.id] ?? false} onChange={(event) => setChecked((current) => ({ ...current, [item.id]: event.target.checked }))} /><span>{item.text}</span></label>
                <button type="button" className="ef-inline-link" onClick={() => onLocateCitation(item.citation)}><Icon name="target" />看原文</button>
              </li>
            ))}
          </ul>
        </section>
      ) : state.snapshot !== null ? (
        <p className="ef-senior-no-checklist">当前页面没有找到明确的准备事项。</p>
      ) : null}

      {state.snapshot !== null && state.goal ? (
        <section className="ef-senior-progress" aria-label="本机进度">
          <div className="ef-senior-progress-copy">
            <strong>把这次进度记在本机</strong>
            <span>只保存简短目标、步骤和网站名称，不保存网页内容、个人资料或成功结果。</span>
          </div>
          <div className="ef-senior-progress-actions">
            <button type="button" onClick={() => { void saveProgress(); }} disabled={state.busy}>保存进度</button>
            {matchingProgress && !canContinueAfterRead ? (
              <button type="button" onClick={() => { setResumeRequested(true); setResumeBaseSnapshot(state.snapshot?.snapshotId ?? null); onRefresh(); }} disabled={state.busy}>重新读取后继续</button>
            ) : null}
            {canContinueAfterRead && saved !== null ? (
              <button type="button" onClick={() => { onSend(saved.goal); setResumeRequested(false); }}>按上次目标重新开始</button>
            ) : null}
            {matchingProgress ? <button type="button" className="ef-text-button" onClick={() => { void removeProgress(); }}>删除记录</button> : null}
          </div>
          {matchingProgress && saved !== null ? <p className="ef-senior-progress-note">上次记录：{saved.goal}{saved.stepCount > 0 ? ` · 第 ${saved.stepIndex + 1} 步${saved.stepLabel ? `：${saved.stepLabel}` : ""}` : ""}。恢复前会重新读取网页，不会沿用旧页面状态。</p> : null}
          {progressMessage ? <p className="ef-senior-feedback" role="status">{progressMessage}</p> : null}
        </section>
      ) : null}

      {open ? (
        <section ref={helpRef} className="ef-senior-help" aria-labelledby="ef-senior-help-title">
          <div className="ef-senior-section-title">
            <div><h2 id="ef-senior-help-title">请身边的人帮忙看看</h2><p>内容只在这里预览，不会自动发给任何人。</p></div>
            <button type="button" className="ef-icon-button" aria-label="收起求助内容" onClick={onClose}><Icon name="close" /></button>
          </div>
          <label className="ef-senior-help-label" htmlFor="ef-senior-help-text">求助内容，可先修改</label>
          <textarea id="ef-senior-help-text" value={helpText} maxLength={160} rows={3} onChange={(event) => setHelpText(event.target.value)} />
          <button type="button" onClick={() => { void copyHelp(); }} disabled={!helpText.trim()}>复制求助内容</button>
          {copyMessage ? <p className="ef-senior-feedback" role="status">{copyMessage}</p> : null}
          {contacts.length > 0 ? (
            <div className="ef-senior-contacts"><strong>当前网页上的帮助入口</strong><ul>{contacts.map((contact) => <li key={contact.id}><span>{contact.text}</span><button type="button" className="ef-inline-link" onClick={() => onLocateCitation(contact.citation)}><Icon name="target" />在网页中查看</button></li>)}</ul></div>
          ) : <p className="ef-senior-progress-note">当前页面没有找到明确的官方帮助入口。</p>}
        </section>
      ) : null}
    </div>
  );
}
