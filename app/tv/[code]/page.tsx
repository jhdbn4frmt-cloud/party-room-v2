import { RoomClient } from "@/components/room-client";
export default async function TVPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomClient code={code} display />;
}
