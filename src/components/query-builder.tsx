"use client";
import type { Rule, RuleGroup } from "@/lib/types";
import { Plus, Trash2, UserRound, Zap } from "lucide-react";
import { Button, IconButton } from "./ui";
const properties = [
  "country",
  "city",
  "platform",
  "plan",
  "value",
  "name",
  "email",
];
export const EVENT_NAMES = [
  "App Launched",
  "Product Viewed",
  "Added to Cart",
  "Charged",
  "Signed Up",
  "Message Sent",
  "Message Viewed",
  "Message Clicked",
];
export function QueryBuilder({
  query,
  onChange,
}: {
  query: RuleGroup;
  onChange: (query: RuleGroup) => void;
}) {
  const update = (index: number, patch: Partial<Rule>) =>
    onChange({
      ...query,
      rules: query.rules.map((rule, i) =>
        i === index ? { ...rule, ...patch } : rule,
      ),
    });
  const add = (kind: "property" | "event") =>
    onChange({
      ...query,
      rules: [
        ...query.rules,
        {
          id: crypto.randomUUID(),
          kind,
          field: kind === "property" ? "country" : "App Launched",
          operator: kind === "property" ? "equals" : "did",
          value: kind === "property" ? "India" : "1",
          days: 30,
        },
      ],
    });
  return (
    <div className="query-builder">
      <div className="query-combinator">
        <span>Users who match</span>
        <select
          aria-label="Match conditions"
          value={query.combinator}
          onChange={(event) =>
            onChange({
              ...query,
              combinator: event.target.value as "and" | "or",
            })
          }
        >
          <option value="and">ALL conditions</option>
          <option value="or">ANY condition</option>
        </select>
        <span>below</span>
      </div>
      {query.funnel ? (
        <div className="funnel-source-note">
          <Zap size={17} />
          <div>
            <strong>Audience from funnel analysis</strong>
            <span>
              {query.funnel.steps.join(" → ")} · Step {query.funnel.step + 1}
              {query.funnel.dropoff ? " drop-offs" : " reached"} ·{" "}
              {query.funnel.windowDays}-day window
            </span>
          </div>
        </div>
      ) : null}
      {query.rules.length ? (
        <div className="query-rules">
          {query.rules.map((rule, index) => (
            <div className="query-rule-wrapper" key={rule.id}>
              {index > 0 ? (
                <div className="rule-join">
                  <span>{query.combinator.toUpperCase()}</span>
                </div>
              ) : null}
              <div className="query-rule">
                <div className={"rule-icon " + rule.kind}>
                  {rule.kind === "event" ? (
                    <Zap size={17} />
                  ) : (
                    <UserRound size={17} />
                  )}
                </div>
                <div className="rule-fields">
                  <select
                    aria-label={"Condition " + (index + 1) + " type"}
                    value={rule.kind}
                    onChange={(event) => {
                      const kind = event.target.value as Rule["kind"];
                      update(index, {
                        kind,
                        field: kind === "property" ? "country" : "App Launched",
                        operator: kind === "property" ? "equals" : "did",
                        value: kind === "property" ? "India" : "1",
                      });
                    }}
                  >
                    <option value="property">User property</option>
                    <option value="event">User behavior</option>
                  </select>
                  <select
                    aria-label={"Condition " + (index + 1) + " field"}
                    value={rule.field}
                    onChange={(event) =>
                      update(index, { field: event.target.value })
                    }
                  >
                    {(rule.kind === "property" ? properties : EVENT_NAMES).map(
                      (field) => (
                        <option key={field} value={field}>
                          {field === "value"
                            ? "Lifetime value"
                            : field === "plan"
                              ? "Subscription plan"
                              : field}
                        </option>
                      ),
                    )}
                  </select>
                  <select
                    aria-label={"Condition " + (index + 1) + " operator"}
                    value={rule.operator}
                    onChange={(event) =>
                      update(index, {
                        operator: event.target.value as Rule["operator"],
                      })
                    }
                  >
                    {(rule.kind === "event"
                      ? [
                          ["did", "Did at least"],
                          ["did_not", "Have not done"],
                        ]
                      : [
                          ["equals", "is equal to"],
                          ["not_equals", "is not equal to"],
                          ["contains", "contains"],
                          ["greater_than", "is greater than"],
                          ["less_than", "is less than"],
                        ]
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {rule.operator !== "did_not" ? (
                    <input
                      aria-label={"Condition " + (index + 1) + " value"}
                      value={rule.value}
                      onChange={(event) =>
                        update(index, { value: event.target.value })
                      }
                      placeholder="Value"
                    />
                  ) : null}
                  {rule.kind === "event" ? (
                    <>
                      <span className="muted small">in the last</span>
                      <input
                        className="days-input"
                        aria-label={"Condition " + (index + 1) + " days"}
                        type="number"
                        min={1}
                        max={365}
                        value={rule.days}
                        onChange={(event) =>
                          update(index, { days: Number(event.target.value) })
                        }
                      />
                      <span className="muted small">days</span>
                    </>
                  ) : null}
                </div>
                <IconButton
                  label={"Remove condition " + (index + 1)}
                  onClick={() =>
                    onChange({
                      ...query,
                      rules: query.rules.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      ) : !query.funnel ? (
        <div className="all-users-query">
          <UsersIcon />
          <strong>Start with your whole audience</strong>
          <p>Add conditions to find the people you want to reach.</p>
        </div>
      ) : null}
      <div className="query-add">
        <Button variant="secondary" onClick={() => add("property")}>
          <Plus size={15} />
          User property
        </Button>
        <Button variant="secondary" onClick={() => add("event")}>
          <Plus size={15} />
          User behavior
        </Button>
      </div>
    </div>
  );
}
function UsersIcon() {
  return <UserRound size={26} className="muted" />;
}
