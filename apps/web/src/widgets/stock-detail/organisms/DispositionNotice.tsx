import type { DispositionFlag } from "@taiwan-stock/api-client";

type Props = { flag: DispositionFlag };

const daysLeft = (end: string): number =>
  Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);

export const DispositionNotice: React.FC<Props> = ({ flag }) => {
  const disposal = flag.level === "disposal";
  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 ${
      disposal ? "border-violet-500/40 bg-violet-500/10" : "border-amber-500/40 bg-amber-500/10"
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
          disposal ? "bg-violet-500/20 text-violet-400" : "bg-amber-500/20 text-amber-400"
        }`}>
          {disposal ? "處置股" : "注意股"}
        </span>
        {flag.start && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {flag.start}
            {flag.end && ` ~ ${flag.end}`}
            {flag.end && daysLeft(flag.end) >= 0 && `（剩 ${daysLeft(flag.end)} 天）`}
          </span>
        )}
      </div>
      {flag.reason && <p className="text-xs text-muted-foreground mb-1">{flag.reason}</p>}
      {flag.measures && <p className="text-xs whitespace-pre-wrap">{flag.measures}</p>}
    </div>
  );
};
