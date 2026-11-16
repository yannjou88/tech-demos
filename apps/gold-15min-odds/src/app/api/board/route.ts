import { io } from "next/cache";
import type { NextRequest } from "next/server";
import { getBoard } from "@/lib/board";
import { isAsset } from "@/lib/market";

export async function GET(request: NextRequest) {
  await io();
  const param = request.nextUrl.searchParams.get("asset");
  const asset = isAsset(param) ? param : "gold";
  const board = await getBoard(asset);
  return Response.json(board, {
    headers: { "cache-control": "no-store" },
  });
}
