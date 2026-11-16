// Validate configuration without printing any environment variable values.
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "DATABASE_URL",
  "TMDB_READ_ACCESS_TOKEN",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing Vercel Production environment variables: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Required production environment variables are configured.");
