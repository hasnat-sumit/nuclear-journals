"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, errorMessage } from "@/lib/client-api";
import type { Category, WriterArticle } from "@/lib/types";
import { RichTextEditor } from "./rich-text-editor";

const schema = z.object({
  title: z.string().trim().min(3, "Enter a title").max(200),
  slug: z
    .string()
    .trim()
    .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
    .max(120),
  excerpt: z.string().trim().max(500),
  categoryId: z.string(),
  tags: z.string().max(500),
  coverAlt: z.string().trim().max(300),
  references: z.array(
    z.object({
      citation: z.string().trim().min(3, "Enter the citation").max(1000),
      url: z.union([z.literal(""), z.url("Enter a full link, or leave empty")]),
    }),
  ),
  declarations: z.object({ author: z.boolean(), originality: z.boolean(), confidentiality: z.boolean() }),
  changeSummary: z.string().trim().max(1000),
});

type FormValues = z.infer<typeof schema>;

const DECLARATIONS = [
  { key: "author", text: "I am the author of this article." },
  { key: "originality", text: "This work is original, and all sources are properly cited." },
  {
    key: "confidentiality",
    text: "This article contains no classified, restricted, proprietary or sensitive operational nuclear facility information.",
  },
] as const;

export function ArticleForm({ article, onSaved }: { article?: WriterArticle; onSaved?: () => void }) {
  const router = useRouter();
  const categories = useApiQuery<{ data: Category[] }>("/categories");
  const [content, setContent] = useState({ json: article?.contentJson ?? null, html: article?.contentHtml ?? "" });
  const [contentChanged, setContentChanged] = useState(false);
  const [cover, setCover] = useState(article?.coverImage ?? null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const { register, control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: article?.title ?? "",
      slug: article?.slug ?? "",
      excerpt: article?.excerpt ?? "",
      categoryId: article?.category?.id ?? "",
      tags: article?.tags.join(", ") ?? "",
      coverAlt: article?.coverImage?.alt ?? "",
      references: article?.references.map((item) => ({ citation: item.citation, url: item.url ?? "" })) ?? [],
      declarations: article?.declarations ?? { author: false, originality: false, confidentiality: false },
      changeSummary: "",
    },
  });
  const references = useFieldArray({ control, name: "references" });
  const isRevision = article?.status === "revision_requested";

  function toPayload(values: FormValues) {
    return {
      title: values.title,
      ...(values.slug ? { slug: values.slug } : {}),
      excerpt: values.excerpt,
      categoryId: values.categoryId || null,
      tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      references: values.references.map(({ citation, url }) => ({ citation, url: url || null })),
      coverImage: cover ? { ...cover, alt: values.coverAlt } : null,
      declarations: values.declarations,
      ...(contentChanged ? { contentJson: content.json, contentHtml: content.html } : {}),
    };
  }

  async function save(values: FormValues) {
    if (article) {
      const { data } = await api.patch<{ data: WriterArticle }>(`/writer/articles/${article.id}`, toPayload(values));
      return data;
    }
    const { data } = await api.post<{ data: WriterArticle }>("/writer/articles", toPayload(values));
    return data;
  }

  const onSaveDraft = handleSubmit(async (values) => {
    setBusy(true);
    try {
      const saved = await save(values);
      setContentChanged(false);
      toast.success("Saved");
      if (article) onSaved?.();
      else router.replace(`/dashboard/writer/articles/${saved.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  });

  const onSubmitForReview = handleSubmit(async (values) => {
    setBusy(true);
    try {
      const saved = await save(values);
      setContentChanged(false);
      const action = isRevision ? "resubmit" : "submit";
      const body = isRevision ? { changeSummary: values.changeSummary || undefined } : {};
      await api.post(`/writer/articles/${saved.id}/${action}`, body);
      toast.success("Sent to the editorial team");
      if (article) onSaved?.();
      else router.replace(`/dashboard/writer/articles/${saved.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  });

  async function uploadCover(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("image", file);
    try {
      const { data } = await api.upload<{ data: { url: string; publicId: string } }>("/uploads/image", form);
      setCover({ ...data, alt: "" });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={onSaveDraft} className="flex flex-col gap-6" noValidate>
      <Field label="Title" htmlFor="title" error={formState.errors.title?.message}>
        <Input id="title" {...register("title")} />
      </Field>
      <Field label="Web address (slug)" htmlFor="slug" hint="Leave empty to generate from the title." error={formState.errors.slug?.message}>
        <Input id="slug" {...register("slug")} />
      </Field>
      <Field label="Summary" htmlFor="excerpt" hint="Shown on article cards and search results." error={formState.errors.excerpt?.message}>
        <Textarea id="excerpt" rows={3} {...register("excerpt")} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Main category" htmlFor="categoryId">
          <NativeSelect id="categoryId" className="w-full" {...register("categoryId")}>
            <NativeSelectOption value="">Choose a category</NativeSelectOption>
            {categories.data?.data.map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Tags" htmlFor="tags" hint="Up to 10, separated by commas.">
          <Input id="tags" {...register("tags")} />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label id="content-label">Article content</Label>
        <RichTextEditor
          labelId="content-label"
          initialContent={article?.contentJson ?? null}
          onChange={(value) => {
            setContent(value);
            setContentChanged(true);
          }}
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Cover image (optional)</legend>
        {cover ? (
          <div className="flex flex-col items-start gap-2">
            <Image src={cover.url} alt={cover.alt} width={320} height={180} className="h-auto rounded-md" />
            <Button type="button" variant="outline" onClick={() => setCover(null)}>Remove image</Button>
          </div>
        ) : (
          <Input
            type="file"
            aria-label="Upload cover image"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadCover(file);
            }}
          />
        )}
        <Field label="Image description (alt text)" htmlFor="coverAlt" hint="Required when you use a cover image.">
          <Input id="coverAlt" {...register("coverAlt")} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">References and citations</legend>
        {references.fields.map((field, index) => (
          <div key={field.id} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
            <div>
              <Input aria-label={`Citation ${index + 1}`} placeholder="Citation" {...register(`references.${index}.citation`)} />
              {formState.errors.references?.[index]?.citation ? (
                <p role="alert" className="mt-1 text-sm text-destructive">{formState.errors.references[index].citation?.message}</p>
              ) : null}
            </div>
            <div>
              <Input aria-label={`Link for citation ${index + 1}`} placeholder="https:// (optional)" {...register(`references.${index}.url`)} />
              {formState.errors.references?.[index]?.url ? (
                <p role="alert" className="mt-1 text-sm text-destructive">{formState.errors.references[index].url?.message}</p>
              ) : null}
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove citation ${index + 1}`} onClick={() => references.remove(index)}>
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
        <div>
          <Button type="button" variant="outline" onClick={() => references.append({ citation: "", url: "" })}>
            <Plus aria-hidden="true" /> Add reference
          </Button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <legend className="px-1 text-sm font-medium">Declarations (required to submit)</legend>
        {DECLARATIONS.map(({ key, text }) => (
          <Controller
            key={key}
            control={control}
            name={`declarations.${key}`}
            render={({ field }) => (
              <label className="flex items-start gap-3 text-sm leading-6">
                <Checkbox className="mt-1" checked={field.value} onCheckedChange={field.onChange} />
                <span>{text}</span>
              </label>
            )}
          />
        ))}
      </fieldset>

      {isRevision ? (
        <Field label="What did you change?" htmlFor="changeSummary" hint="Shared with the editors.">
          <Textarea id="changeSummary" rows={2} {...register("changeSummary")} />
        </Field>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="outline" disabled={busy}>Save draft</Button>
        <ConfirmationDialog
          trigger={<Button type="button" disabled={busy}>{isRevision ? "Resubmit for review" : "Submit for review"}</Button>}
          title={isRevision ? "Resubmit this article?" : "Submit this article?"}
          description="You will not be able to edit it while the editorial team is working on it."
          confirmLabel={isRevision ? "Resubmit" : "Submit"}
          onConfirm={() => void onSubmitForReview()}
        />
      </div>
    </form>
  );
}
