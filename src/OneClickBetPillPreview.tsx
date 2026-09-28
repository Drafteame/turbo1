import { OneClickBetPill } from './OneClickBetPill';

/**
 * Temporary isolated preview for OneClickBetPill — NOT wired into the real
 * app. Mounted only behind `?pillPreview=true` (see main.tsx). Safe to
 * delete once the component is reviewed/integrated.
 */

const ROW_STATES: Array<{ label: string; state: 'default' | 'pressing' | 'filled'; progress?: number }> = [
  { label: 'default', state: 'default' },
  { label: '25% progress', state: 'pressing', progress: 0.25 },
  { label: '50% progress', state: 'pressing', progress: 0.5 },
  { label: '75% progress', state: 'pressing', progress: 0.75 },
  { label: 'filled', state: 'filled' },
];

export function OneClickBetPillPreview() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#0a0a0a] px-4 py-6">
      <h1 className="mb-1 text-[14px] font-black leading-[18px] text-[#fbfbfb]">
        OneClickBetPill — isolated preview
      </h1>
      <p className="mb-5 text-[11px] font-medium text-[rgba(251,251,251,0.5)]">
        Resize the browser to 320px / 390px to check both target viewports.
      </p>
      <div className="flex flex-col gap-4">
        {ROW_STATES.map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <p className="text-[11px] font-medium text-[rgba(251,251,251,0.5)]">{row.label}</p>
            <OneClickBetPill
              odds={1.75}
              amount={200}
              potentialWin={350}
              state={row.state}
              progress={row.progress}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
