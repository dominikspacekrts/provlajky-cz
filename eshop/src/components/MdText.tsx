import type { CSSProperties, ReactNode } from "react";

/**
 * Popisky z adminu používají markdown `**tučně**` (a zalomení řádků).
 * Bez převodu se hvězdičky ukážou doslova — viz tetrahedron a další.
 */
export function mdInlineNodes(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    return part;
  });
}

/** Pro meta tagy a feedy — `**x**` → `x`. */
export function stripMdMarkers(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

export default function MdText({
  children,
  style,
  className,
  as: Tag = "p",
}: {
  children: string;
  style?: CSSProperties;
  className?: string;
  as?: "p" | "span" | "div";
}) {
  return (
    <Tag className={className} style={style}>
      {mdInlineNodes(children)}
    </Tag>
  );
}
