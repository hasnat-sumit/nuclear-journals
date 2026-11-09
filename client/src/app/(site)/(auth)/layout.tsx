export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">{children}</div>;
}
