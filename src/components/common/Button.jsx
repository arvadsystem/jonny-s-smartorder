import React from "react";

/**
 * Button (Bootstrap 5 wrapper)
 *
 * Props:
 * - variant: "btn-primary" | "btn-outline-danger" | "primary" | "outline-danger" ...
 * - size: "btn-sm" | "btn-lg" | "sm" | "lg"
 * - onClick, type, disabled, children
 * - className: clases extra
 */
export default function Button({
  variant = "btn-primary",
  size,
  type = "button",
  onClick,
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  const normalizeVariant = (v) => {
    if (!v) return "btn-primary";
    return v.startsWith("btn-") ? v : `btn-${v}`;
  };

  const normalizeSize = (s) => {
    if (!s) return "";
    if (s === "sm") return "btn-sm";
    if (s === "lg") return "btn-lg";
    return s.startsWith("btn-") ? s : s; // por si ya viene "btn-sm"
  };

  const classes = [
    "btn",
    normalizeVariant(variant),
    normalizeSize(size),
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
