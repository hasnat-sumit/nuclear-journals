"use client";

import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo, Undo } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/client-api";
import { cn } from "@/lib/utils";

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active ?? false}
      onClick={onClick}
      className={cn("rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-primary [&_svg]:size-4", active && "bg-accent text-primary")}
    >
      {children}
    </button>
  );
}

function setLink(editor: Editor) {
  const url = window.prompt("Link address (leave empty to remove)", editor.getAttributes("link").href ?? "");
  if (url === null) return;
  if (url === "") {
    editor.chain().focus().unsetLink().run();
    return;
  }
  if (!/^https?:\/\//i.test(url) && !url.startsWith("mailto:")) {
    toast.error("Links must start with https://, http:// or mailto:");
    return;
  }
  editor.chain().focus().setLink({ href: url }).run();
}

async function insertImage(editor: Editor, file: File) {
  const form = new FormData();
  form.append("image", file);
  try {
    const { data } = await api.upload<{ data: { url: string } }>("/uploads/image", form);
    const alt = window.prompt("Describe this image for readers who can't see it") ?? "";
    editor.chain().focus().setImage({ src: data.url, alt }).run();
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

export interface EditorValue {
  json: Record<string, unknown>;
  html: string;
}

export function RichTextEditor({
  initialContent,
  onChange,
  labelId,
}: {
  initialContent: Record<string, unknown> | null;
  onChange: (value: EditorValue) => void;
  labelId: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, protocols: ["https", "http", "mailto"] },
      }),
      Image,
    ],
    content: initialContent ?? "",
    // The page is rendered on the server first, where no editor can exist.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "article-body", "aria-labelledby": labelId, "aria-multiline": "true", role: "textbox" },
    },
    onUpdate: ({ editor: current }) => onChange({ json: current.getJSON() as Record<string, unknown>, html: current.getHTML() }),
  });

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-card">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5 border-b bg-muted/50 p-1">
        {editor ? (
          <>
            <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></ToolbarButton>
            <ToolbarButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 /></ToolbarButton>
            <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></ToolbarButton>
            <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></ToolbarButton>
            <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></ToolbarButton>
            <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></ToolbarButton>
            <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></ToolbarButton>
            <ToolbarButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code /></ToolbarButton>
            <ToolbarButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus /></ToolbarButton>
            <ToolbarButton label="Link" active={editor.isActive("link")} onClick={() => setLink(editor)}><Link2 /></ToolbarButton>
            <label title="Insert image" className="cursor-pointer rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-primary [&_svg]:size-4">
              <ImagePlus aria-hidden="true" />
              <span className="sr-only">Insert image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void insertImage(editor, file);
                  event.target.value = "";
                }}
              />
            </label>
            <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo /></ToolbarButton>
            <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo /></ToolbarButton>
          </>
        ) : (
          <div className="h-7" />
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
