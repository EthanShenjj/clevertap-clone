"use client";
import { useRequest } from "@/lib/client";
import type { Project } from "@/lib/types";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface WorkspaceValue {
  projectId: string;
  project?: Project;
  projects: Project[];
  setProject: (id: string) => void;
  from: string;
  to: string;
  setDates: (from: string, to: string) => void;
  toast: (message: string, kind?: "success" | "error") => void;
  refreshProjects: () => void;
}
const Context = createContext<WorkspaceValue | null>(null);
export function WorkspaceProvider({
  children,
  initialProject,
}: {
  children: ReactNode;
  initialProject: string;
}) {
  const [projectId, setProjectId] = useState(initialProject);
  const [dates, setDateState] = useState({
    from: "2026-10-21",
    to: "2026-11-19",
  });
  const [notice, setNotice] = useState<{
    message: string;
    kind: "success" | "error";
    key: number;
  } | null>(null);
  const projects = useRequest<{ data: Project[] }>("/api/projects");
  const toast = useCallback(
    (message: string, kind: "success" | "error" = "success") => {
      const key = Date.now();
      setNotice({ message, kind, key });
      window.setTimeout(
        () =>
          setNotice((previous) => (previous?.key === key ? null : previous)),
        5500,
      );
    },
    [],
  );
  const setProject = (id: string) => {
    document.cookie =
      "clevertap-project=" + encodeURIComponent(id) + "; Path=/; SameSite=Lax";
    setProjectId(id);
  };
  return (
    <Context.Provider
      value={{
        projectId,
        project: projects.data?.data.find((p) => p.id === projectId),
        projects: projects.data?.data || [],
        setProject,
        ...dates,
        setDates: (from, to) => setDateState({ from, to }),
        toast,
        refreshProjects: projects.reload,
      }}
    >
      {children}
      {notice ? (
        <div
          className={"toast " + notice.kind}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.kind === "success" ? (
            <CheckCircle2 size={19} />
          ) : (
            <AlertCircle size={19} />
          )}
          <span>{notice.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider is required.");
  return value;
}
