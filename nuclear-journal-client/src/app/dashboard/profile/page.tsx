"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, GraduationCap, Link as LinkIcon, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageTitle, useMe } from "@/components/dashboard/dashboard-shell";
import { Field } from "@/components/form-field";
import { Avatar } from "@/components/site/author-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { api, errorMessage } from "@/lib/client-api";
import { SOCIAL_PLATFORMS, hasExtendedProfile, normalizeUrl } from "@/lib/social";
import type { Me, SocialPlatform } from "@/lib/types";

const MAX_ROWS = 10;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const latestYear = new Date().getFullYear() + 10;

const platformValues = SOCIAL_PLATFORMS.map((item) => item.value) as [SocialPlatform, ...SocialPlatform[]];

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  bio: z.string().trim().max(1000),
  expertise: z.string().max(1000),
  education: z
    .array(
      z.object({
        university: z.string().trim().min(2, "Enter the university").max(150),
        subject: z.string().trim().min(2, "Enter the subject").max(120),
        passingYear: z
          .string()
          .trim()
          .regex(/^\d{4}$/, "Enter a 4-digit year")
          .refine((value) => Number(value) >= 1950 && Number(value) <= latestYear, `Between 1950 and ${latestYear}`),
      }),
    )
    .max(MAX_ROWS),
  socialLinks: z
    .array(
      z.object({
        platform: z.enum(platformValues),
        url: z
          .string()
          .trim()
          .min(1, "Paste the link to your profile")
          .max(300)
          .refine((value) => URL.canParse(normalizeUrl(value)), "Enter a valid link"),
      }),
    )
    .max(MAX_ROWS),
});

// The navbar reads name and photo from the login session, so ask it to refetch too.
function refreshSession() {
  authClient.$store.notify("$sessionSignal");
}

export default function ProfilePage() {
  const { me, reload: reloadMe } = useMe();
  const reload = () => {
    reloadMe();
    refreshSession();
  };
  const extended = hasExtendedProfile(me.role);
  const { register, handleSubmit, control, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: me.name,
      bio: me.bio,
      expertise: me.expertise.join(", "),
      education: me.education.map((item) => ({ ...item, passingYear: item.passingYear ? String(item.passingYear) : "" })),
      socialLinks: me.socialLinks,
    },
  });
  const education = useFieldArray({ control, name: "education" });
  const socialLinks = useFieldArray({ control, name: "socialLinks" });
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.patch("/me", {
        name: values.name,
        bio: values.bio,
        expertise: values.expertise.split(",").map((item) => item.trim()).filter(Boolean),
        // Readers don't have these sections, so leave them out entirely.
        ...(extended
          ? {
              education: values.education.map((item) => ({ ...item, passingYear: Number(item.passingYear) })),
              socialLinks: values.socialLinks.map((item) => ({ ...item, url: normalizeUrl(item.url) })),
            }
          : {}),
      });
      toast.success("Profile saved");
      reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <>
      <PageTitle title="Profile" description={`${me.email} · ${me.role}`} />
      <div className="flex max-w-2xl flex-col gap-8">
        {extended ? <PhotoSection me={me} onChange={reload} /> : null}

        <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
          <section className="flex flex-col gap-4">
            <Field label="Name" htmlFor="name" error={errors.name?.message}>
              <Input id="name" {...register("name")} />
            </Field>
            <Field label="Bio" htmlFor="bio" hint="Shown on your public author page." error={errors.bio?.message}>
              <Textarea id="bio" rows={5} {...register("bio")} />
            </Field>
            <Field label="Areas of expertise" htmlFor="expertise" hint="Separate with commas.">
              <Input id="expertise" {...register("expertise")} />
            </Field>
          </section>

          {extended ? (
            <section aria-labelledby="education-heading" className="flex flex-col gap-4">
              <SectionHeading id="education-heading" icon={<GraduationCap className="size-4" />} title="Educational background" />
              {education.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">No education added yet.</p>
              ) : null}
              {education.fields.map((field, index) => {
                const rowErrors = errors.education?.[index];
                return (
                  <fieldset key={field.id} className="flex flex-col gap-3 rounded-lg border p-4">
                    <legend className="px-1 text-sm font-medium">Education {index + 1}</legend>
                    <Field label="University" htmlFor={`education-${index}-university`} error={rowErrors?.university?.message}>
                      <Input id={`education-${index}-university`} {...register(`education.${index}.university`)} />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                      <Field label="Subject" htmlFor={`education-${index}-subject`} error={rowErrors?.subject?.message}>
                        <Input id={`education-${index}-subject`} {...register(`education.${index}.subject`)} />
                      </Field>
                      <Field label="Passing year" htmlFor={`education-${index}-year`} error={rowErrors?.passingYear?.message}>
                        <Input
                          id={`education-${index}-year`}
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="2020"
                          {...register(`education.${index}.passingYear`)}
                        />
                      </Field>
                    </div>
                    <div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => education.remove(index)} className="gap-1.5 text-destructive">
                        <Trash2 className="size-4" /> Remove
                      </Button>
                    </div>
                  </fieldset>
                );
              })}
              {education.fields.length < MAX_ROWS ? (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => education.append({ university: "", subject: "", passingYear: "" })}
                    className="gap-1.5"
                  >
                    <Plus className="size-4" /> Add education
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          {extended ? (
            <section aria-labelledby="social-heading" className="flex flex-col gap-4">
              <SectionHeading id="social-heading" icon={<LinkIcon className="size-4" />} title="Social media" />
              {socialLinks.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">No links added yet.</p>
              ) : null}
              {socialLinks.fields.map((field, index) => {
                const rowErrors = errors.socialLinks?.[index];
                return (
                  <div key={field.id} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="flex flex-col gap-1.5 sm:w-44">
                      <Label htmlFor={`social-${index}-platform`} className="sr-only">Platform</Label>
                      <NativeSelect id={`social-${index}-platform`} className="w-full" {...register(`socialLinks.${index}.platform`)}>
                        {SOCIAL_PLATFORMS.map((item) => (
                          <NativeSelectOption key={item.value} value={item.value}>{item.label}</NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label htmlFor={`social-${index}-url`} className="sr-only">Profile link</Label>
                      <Input
                        id={`social-${index}-url`}
                        type="url"
                        inputMode="url"
                        placeholder={SOCIAL_PLATFORMS.find((item) => item.value === field.platform)?.example}
                        aria-invalid={Boolean(rowErrors?.url)}
                        {...register(`socialLinks.${index}.url`)}
                      />
                      {rowErrors?.url ? <p role="alert" className="text-sm text-destructive">{rowErrors.url.message}</p> : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => socialLinks.remove(index)}
                      aria-label={`Remove link ${index + 1}`}
                      className="text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
              {socialLinks.fields.length < MAX_ROWS ? (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => socialLinks.append({ platform: nextPlatform(socialLinks.fields), url: "" })}
                    className="gap-1.5"
                  >
                    <Plus className="size-4" /> Add social link
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          <div><Button type="submit" disabled={formState.isSubmitting}>Save profile</Button></div>
        </form>
      </div>
    </>
  );
}

// Suggest the first platform not used yet, so a new row rarely needs changing.
function nextPlatform(rows: { platform: SocialPlatform }[]): SocialPlatform {
  const used = new Set(rows.map((row) => row.platform));
  return SOCIAL_PLATFORMS.find((item) => !used.has(item.value))?.value ?? "website";
}

function SectionHeading({ id, icon, title }: { id: string; icon: React.ReactNode; title: string }) {
  return (
    <h2 id={id} className="flex items-center gap-2 border-b pb-2 text-base font-semibold">
      {icon}
      {title}
    </h2>
  );
}

function PhotoSection({ me, onChange }: { me: Me; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  async function upload(file: File) {
    if (!PHOTO_TYPES.includes(file.type)) {
      toast.error("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Choose an image of 5 MB or less.");
      return;
    }
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("image", file);
      await api.upload("/me/photo", form);
      toast.success("Photo updated");
      onChange();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await api.delete("/me/photo");
      toast.success("Photo removed");
      onChange();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="photo-heading" className="flex flex-col gap-4">
      <SectionHeading id="photo-heading" icon={<Camera className="size-4" />} title="Profile photo" />
      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={me.name} image={me.image} size="lg" className="border-muted" />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={busy !== null}>
              {busy === "upload" ? "Uploading" : me.image ? "Change photo" : "Upload photo"}
            </Button>
            {me.image ? (
              <Button type="button" variant="ghost" onClick={remove} disabled={busy !== null} className="text-destructive">
                {busy === "remove" ? "Removing" : "Remove"}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 5 MB. Cropped to a square.</p>
        </div>
        <input
          ref={input}
          type="file"
          accept={PHOTO_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
    </section>
  );
}
