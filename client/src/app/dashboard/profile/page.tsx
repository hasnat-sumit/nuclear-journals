"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageTitle, useMe } from "@/components/dashboard/dashboard-shell";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client-api";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  bio: z.string().trim().max(1000),
  expertise: z.string().max(1000),
});

export default function ProfilePage() {
  const { me, reload } = useMe();
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: me.name, bio: me.bio, expertise: me.expertise.join(", ") },
  });

  const onSubmit = handleSubmit(async ({ name, bio, expertise }) => {
    try {
      await api.patch("/me", {
        name,
        bio,
        expertise: expertise.split(",").map((item) => item.trim()).filter(Boolean),
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
      <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4" noValidate>
        <Field label="Name" htmlFor="name" error={formState.errors.name?.message}>
          <Input id="name" {...register("name")} />
        </Field>
        <Field label="Bio" htmlFor="bio" hint="Shown on your public author page." error={formState.errors.bio?.message}>
          <Textarea id="bio" rows={5} {...register("bio")} />
        </Field>
        <Field label="Areas of expertise" htmlFor="expertise" hint="Separate with commas.">
          <Input id="expertise" {...register("expertise")} />
        </Field>
        <div><Button type="submit" disabled={formState.isSubmitting}>Save profile</Button></div>
      </form>
    </>
  );
}
