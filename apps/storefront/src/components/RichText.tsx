import type {
  TipTapBlock,
  TipTapDoc,
  TipTapInline,
  TipTapListItem,
  TipTapMark,
} from "@online-store/rich-text";
import type { ReactNode } from "react";

type Props = {
  doc: TipTapDoc;
  className?: string;
};

function applyMarks(text: string, marks: TipTapMark[] | undefined, key: string) {
  let node: ReactNode = text;
  if (!marks?.length) return <span key={key}>{node}</span>;

  for (const mark of marks) {
    if (mark.type === "bold") {
      node = <strong key={`${key}-b`}>{node}</strong>;
    } else if (mark.type === "italic") {
      node = <em key={`${key}-i`}>{node}</em>;
    } else if (mark.type === "link") {
      node = (
        <a
          key={`${key}-a`}
          href={mark.attrs.href}
          rel="noopener noreferrer"
          target={mark.attrs.target ?? undefined}
        >
          {node}
        </a>
      );
    }
  }
  return <span key={key}>{node}</span>;
}

function InlineNodes({ nodes }: { nodes?: TipTapInline[] }) {
  if (!nodes?.length) return null;
  return (
    <>
      {nodes.map((node, i) => {
        const key = `i-${i}`;
        if (node.type === "hardBreak") return <br key={key} />;
        return applyMarks(node.text, node.marks, key);
      })}
    </>
  );
}

function ListItem({ item, index }: { item: TipTapListItem; index: number }) {
  return (
    <li key={`li-${index}`}>
      {item.content?.map((child, i) => {
        if (child.type === "paragraph") {
          return (
            <p key={`lip-${i}`}>
              <InlineNodes nodes={child.content} />
            </p>
          );
        }
        if (child.type === "bulletList") {
          return (
            <ul key={`liu-${i}`}>
              {child.content?.map((nested, ni) => (
                <ListItem key={ni} item={nested} index={ni} />
              ))}
            </ul>
          );
        }
        return (
          <ol key={`lio-${i}`}>
            {child.content?.map((nested, ni) => (
              <ListItem key={ni} item={nested} index={ni} />
            ))}
          </ol>
        );
      })}
    </li>
  );
}

function Block({ block, index }: { block: TipTapBlock; index: number }) {
  if (block.type === "heading") {
    const Tag = block.attrs.level === 3 ? "h3" : "h2";
    return (
      <Tag key={`h-${index}`}>
        <InlineNodes nodes={block.content} />
      </Tag>
    );
  }
  if (block.type === "bulletList") {
    return (
      <ul key={`ul-${index}`}>
        {block.content?.map((item, i) => (
          <ListItem key={i} item={item} index={i} />
        ))}
      </ul>
    );
  }
  if (block.type === "orderedList") {
    return (
      <ol key={`ol-${index}`}>
        {block.content?.map((item, i) => (
          <ListItem key={i} item={item} index={i} />
        ))}
      </ol>
    );
  }
  return (
    <p key={`p-${index}`}>
      <InlineNodes nodes={block.content} />
    </p>
  );
}

export default function RichText({ doc, className = "rich-text" }: Props) {
  if (!doc.content?.length) return null;
  return (
    <div className={className}>
      {doc.content.map((block, i) => (
        <Block key={i} block={block} index={i} />
      ))}
    </div>
  );
}
