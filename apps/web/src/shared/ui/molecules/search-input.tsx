import { useState } from "react";
import { Input } from "../atoms/input";
import { Button } from "../atoms/button";

interface Props {
  placeholder?: string;
  onSearch: (query: string) => void;
}

export function SearchInput({ placeholder = "輸入股票代碼…", onSearch }: Props) {
  const [value, setValue] = useState("");
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && value.trim()) {
      onSearch(value.trim().toUpperCase());
      setValue("");
    }
  }
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      <Button
        onClick={() => { if (value.trim()) { onSearch(value.trim().toUpperCase()); setValue(""); } }}
      >
        新增
      </Button>
    </div>
  );
}
