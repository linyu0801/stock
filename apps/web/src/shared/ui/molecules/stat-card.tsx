type Props = {
  label: string;
  value: string | number;
};

export const StatCard: React.FC<Props> = ({ label, value }) => {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-medium">{value}</p>
    </div>
  );
};
