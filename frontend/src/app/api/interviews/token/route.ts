import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { streamVideo } from "@/lib/stream-video";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await streamVideo.upsertUsers([
    {
      id: session.user.id,
      name: session.user.name ?? "Student",
      role: "admin",
      image: session.user.image ?? undefined,
    },
  ]);

  const expirationTime = Math.floor(Date.now() / 1000) + 3600;
  const issuedAt = Math.floor(Date.now() / 1000) - 60;

  const token = streamVideo.generateUserToken({
    user_id: session.user.id,
    exp: expirationTime,
    validity_in_seconds: issuedAt,
  });

  return NextResponse.json({ token });
}
