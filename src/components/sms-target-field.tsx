"use client";
import { Field } from "./ui";
import type { SmsWorkspace } from "@/lib/sms";
export function SmsTargetField({
  value,
  onChange,
  workspace,
}: {
  value: string;
  onChange: (value: string) => void;
  workspace: SmsWorkspace;
}) {
  return (
    <Field
      label="SMS service provider"
      hint="Choose a provider or an ordered provider group."
    >
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Use default SMS route</option>
        <optgroup label="Providers">
          {workspace.providers
            .filter((p) => p.status === "Connected")
            .map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
                {p.sms?.isDefault ? " (default)" : ""}
              </option>
            ))}
        </optgroup>
        <optgroup label="Provider groups">
          {workspace.groups.map((g) => (
            <option value={"group:" + g.id} key={g.id}>
              {g.name}
              {g.isDefault ? " (default)" : ""}
            </option>
          ))}
        </optgroup>
      </select>
    </Field>
  );
}
