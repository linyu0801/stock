import { useParams } from "@tanstack/react-router";

export default function StockPage() {
  const { id } = useParams({ from: "/stock/$id" });
  return <div className="p-8"><h1 className="text-2xl font-bold">股票：{id}</h1></div>;
}
