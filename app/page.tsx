import { HomeDashboard } from "@/components/HomeDashboard";
import { getBracketData } from "@/lib/bracket-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const bracket = await getBracketData();
  return <HomeDashboard initialBracket={bracket} />;
}
