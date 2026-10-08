import AppIcon from '../ui/AppIcon';
import s from './Aurora.module.css';

/**
 * P11 A1 — left rail: project identity + Devin-style plan checklist
 * + the one-click escape hatch back to the classic CopilotIDE.
 */
export default function AuroraRail({ projectName = 'Untitled project', plan = [], onClassic }) {
  const done = plan.filter((p) => p.status === 'done').length;

  return (
    <aside className={s.rail} data-testid="aurora-rail">
      <div className={s.railHead}>
        <div className={s.railProject} title={projectName}>
          {projectName}
        </div>
        <div className={s.railSub}>AI-Dost Copilot</div>
      </div>

      <div className={s.railBody}>
        <div className={s.sectionLabel}>
          <span>Plan</span>
          <span>
            {done}/{plan.length}
          </span>
        </div>
        <div data-testid="aurora-plan">
          {plan.map((p) => (
            <div key={p.id} className={s.planRow} data-testid="plan-row" data-status={p.status}>
              <span
                className={`${s.planBox} ${p.status === 'done' ? s.planDone : ''} ${
                  p.status === 'active' ? s.planActive : ''
                }`}
                aria-hidden="true"
              />
              <span
                className={`${s.planLabel} ${p.status === 'done' ? s.planLabelDone : ''} ${
                  p.status === 'active' ? s.planLabelActive : ''
                }`}
              >
                {p.label}
              </span>
            </div>
          ))}
          {plan.length === 0 && <div className={s.emptyHint}>No plan yet</div>}
        </div>
      </div>

      <div className={s.railFoot}>
        <button type="button" className={s.ghostBtn} data-testid="aurora-classic-btn" onClick={onClassic}>
          <AppIcon name="layout" size={12} />
          Classic UI
        </button>
      </div>
    </aside>
  );
}
