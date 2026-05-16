import { fetchCategories, fetchMacro } from "@/lib/api";

export default async function Home() {
  const [categories, macro] = await Promise.allSettled([
    fetchCategories(),
    fetchMacro(),
  ]);

  return (
    <main className="p-8 font-mono text-sm">
      <h1 className="text-xl font-bold mb-6">Follow the Money — Debug</h1>

      <section className="mb-8">
        <h2 className="font-semibold mb-2">
          /categories{" "}
          <span
            className={
              categories.status === "fulfilled" ? "text-green-600" : "text-red-600"
            }
          >
            {categories.status === "fulfilled" ? "✓ OK" : "✗ FAILED"}
          </span>
        </h2>
        {categories.status === "fulfilled" ? (
          <pre className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(categories.value, null, 2)}
          </pre>
        ) : (
          <p className="text-red-500">{String(categories.reason)}</p>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">
          /macro{" "}
          <span
            className={
              macro.status === "fulfilled" ? "text-green-600" : "text-red-600"
            }
          >
            {macro.status === "fulfilled" ? "✓ OK" : "✗ FAILED"}
          </span>
        </h2>
        {macro.status === "fulfilled" ? (
          <pre className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(macro.value, null, 2)}
          </pre>
        ) : (
          <p className="text-red-500">{String(macro.reason)}</p>
        )}
      </section>
    </main>
  );
}
