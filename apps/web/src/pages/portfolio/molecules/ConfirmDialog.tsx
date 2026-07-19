import { Button } from "@/shared/ui/atoms/button";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  error?: string | null;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

const ConfirmDialog: React.FC<Props> = ({ open, title, description, error, pending, onConfirm, onClose }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-xl shadow-xl p-5 w-80 max-w-[calc(100vw-2rem)] space-y-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={pending}>刪除</Button>
        </div>
      </div>
    </div>
  );
};

export { ConfirmDialog };
