import { Suspense } from "react";
import { io } from "next/cache";
import { BoardSkeleton } from "@/components/board-skeleton";
import { OddsBoard } from "@/components/odds-board";
import { getBoard } from "@/lib/board";

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 py-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">十五分钟涨跌</h1>
        <p className="text-sm text-muted-foreground">Gold & silver · next 15 minutes</p>
      </header>
      <div className="mt-6">
        <Suspense fallback={<BoardSkeleton />}>
          <InitialBoard />
        </Suspense>
      </div>
      <footer className="mt-6 pb-4 text-center text-xs leading-5 text-muted-foreground">
        <p>仅供参考，不构成投资建议</p>
        <p>For information only, not investment advice.</p>
      </footer>
    </main>
  );
}

async function InitialBoard() {
  await io();
  const board = await getBoard("gold");
  return <OddsBoard initial={board} />;
}
