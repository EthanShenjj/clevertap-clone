"use client";
import { number } from "@/lib/client";
import type { ChannelType } from "@/lib/types";
import {
  AlertCircle,
  ArrowDownUp,
  Bell,
  ChevronLeft,
  ChevronRight,
  Globe,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  PanelTop,
  Radio,
  Search,
  Smartphone,
  X,
} from "lucide-react";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export function Button({
  children,
  variant = "primary",
  className = "",
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      className={"btn " + variant + " " + className}
      disabled={props.disabled || loading}
    >
      {loading ? <Loader2 size={16} className="spin" /> : null}
      {children}
    </button>
  );
}
export function IconButton({
  children,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      className={"icon-button " + (props.className || "")}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
export function Badge({
  children,
  status,
}: {
  children?: ReactNode;
  status: string;
}) {
  return (
    <span
      className={"badge status-" + status.toLowerCase().replaceAll(" ", "-")}
    >
      <i />
      {children || status}
    </span>
  );
}
export function ChannelIcon({
  channel,
  size = 18,
  boxed = false,
}: {
  channel: string;
  size?: number;
  boxed?: boolean;
}) {
  const icons: Record<ChannelType, typeof Mail> = {
    Email: Mail,
    Push: Bell,
    "In-App": Smartphone,
    "Web Pop-up": PanelTop,
    SMS: MessageSquare,
    WhatsApp: MessageCircle,
    "Web Push": Globe,
    RCS: Radio,
  };
  const Icon = icons[channel as ChannelType] || Bell;
  return boxed ? (
    <span
      className={
        "channel-icon channel-" + channel.toLowerCase().replaceAll(" ", "-")
      }
    >
      <Icon size={size} aria-hidden="true" />
    </span>
  ) : (
    <Icon size={size} aria-hidden="true" />
  );
}
export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const accessible = (child: ReactNode): ReactNode => {
    if (
      !isValidElement<{
        children?: ReactNode;
        "aria-label"?: string;
        "aria-invalid"?: boolean;
      }>(child)
    )
      return child;
    if (
      typeof child.type === "string" &&
      ["input", "select", "textarea"].includes(child.type)
    ) {
      return cloneElement(child, {
        "aria-label": child.props["aria-label"] || label,
        "aria-invalid": error ? true : undefined,
      });
    }
    return child.props.children
      ? cloneElement(child, {
          children: Children.map(child.props.children, accessible),
        })
      : child;
  };
  return (
    <label className={"field " + className}>
      <span className="field-label">{label}</span>
      {Children.map(children, accessible)}
      {error ? (
        <span className="field-error">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  footer,
  wide = false,
  drawer = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    headingId = useId(),
    closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide " : "") + (drawer ? "drawer" : "")}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <div>
            <h2 id={headingId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </dialog>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="header-actions">{actions}</div>
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Search by name...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={17} aria-hidden="true" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button onClick={() => onChange("")} aria-label="Clear search">
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
export function Loading({
  label = "Loading your data...",
}: {
  label?: string;
}) {
  return (
    <div className="loading">
      <Loader2 size={25} className="spin" />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  description = "Try adjusting your filters or create something new.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={29} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={26} />
      <h3>We couldn&apos;t load this view</h3>
      <p>{message}</p>
      {retry ? (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
export function Pagination({
  meta,
  onPage,
  onSize,
}: {
  meta: { total: number; page: number; pageSize: number; pages: number };
  onPage: (page: number) => void;
  onSize?: (size: number) => void;
}) {
  const start = meta.total ? (meta.page - 1) * meta.pageSize + 1 : 0;
  return (
    <div className="pagination">
      <span>
        Showing{" "}
        <strong>
          {number(start)}–
          {number(Math.min(meta.page * meta.pageSize, meta.total))}
        </strong>{" "}
        of <strong>{number(meta.total)}</strong>
      </span>
      <div>
        {onSize ? (
          <label>
            Rows per page{" "}
            <select
              aria-label="Rows per page"
              value={meta.pageSize}
              onChange={(event) => onSize(Number(event.target.value))}
            >
              {[10, 20, 50].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        ) : null}
        <IconButton
          label="Previous page"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          <ChevronLeft size={17} />
        </IconButton>
        <span className="page-number">
          {meta.page} / {meta.pages}
        </span>
        <IconButton
          label="Next page"
          disabled={meta.page >= meta.pages}
          onClick={() => onPage(meta.page + 1)}
        >
          <ChevronRight size={17} />
        </IconButton>
      </div>
    </div>
  );
}
export interface Column<T> {
  label: string;
  key: string;
  render: (row: T) => ReactNode;
  width?: string;
  sort?: string;
}
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  sort,
  onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  sort?: string;
  onSort?: (key: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ width: column.width }}>
                {column.sort && onSort ? (
                  <button
                    onClick={() => onSort(column.sort!)}
                    className={sort === column.sort ? "sorted" : ""}
                  >
                    {column.label}
                    <ArrowDownUp size={13} />
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
export function Avatar({
  name,
  size = "normal",
}: {
  name: string;
  size?: string;
}) {
  return (
    <span
      className={
        "avatar avatar-" + size + " avatar-color-" + (name.charCodeAt(0) % 5)
      }
    >
      {name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
