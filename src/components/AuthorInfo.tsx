import type { Authorship } from "../types";
import { authorName, formatAuthorDate } from "../lib/authorship";

export default function AuthorInfo({ record }: { record: Authorship }) {
  return <div className="min-w-[170px] text-xs text-[#475569] space-y-1">
    <div>{authorName(record.createdByName)}</div>
    {record.createdAt && <div className="text-[#64748B]">{formatAuthorDate(record.createdAt)}</div>}
    {record.updatedAt && (!record.createdAt || Date.parse(record.updatedAt) > Date.parse(record.createdAt) || record.updatedBy !== record.createdBy) && <div className="text-[#64748B]">Última alteração: {authorName(record.updatedByName)}<br />{formatAuthorDate(record.updatedAt)}</div>}
  </div>;
}

export function MyRecordsFilter({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <label className="inline-flex items-center gap-2 text-sm text-[#475569] whitespace-nowrap">
    <input type="checkbox" checked={value} onChange={event => onChange(event.target.checked)} className="accent-[#1A3A6B]" />Criados por mim
  </label>;
}
