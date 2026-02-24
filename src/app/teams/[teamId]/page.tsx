import { TeamEditor } from "@/components/team-editor";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  return <TeamEditor teamId={teamId} />;
}
