"use client";

import { useEffect, useState } from "react";
import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

interface VoteButtonProps {
  placeId: string;
  className?: string;
}

export function VoteButton({ placeId, className }: VoteButtonProps) {
  const supabase = createClient();
  const user = useAuthStore((s) => s.user);

  const [myVote, setMyVote] = useState<number>(0);
  const [average, setAverage] = useState<number | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchVotes();
  }, [placeId]);

  async function fetchVotes() {
    const { data } = await supabase
      .from("place_votes")
      .select("vote_type, user_id")
      .eq("place_id", placeId);

    if (!data) return;

    setTotalVotes(data.length);

    if (data.length > 0) {
      const sum = data.reduce((acc, v) => acc + v.vote_type, 0);
      setAverage(Math.round((sum / data.length) * 10) / 10);
    } else {
      setAverage(null);
    }

    if (user) {
      const mine = data.find((v) => v.user_id === user.id);
      setMyVote(mine ? mine.vote_type : 0);
    }
  }

  async function handleVote(star: number) {
    if (!user || loading) return;
    setLoading(true);

    await supabase.from("place_votes").upsert(
      {
        place_id: placeId,
        user_id: user.id,
        vote_type: star,
      },
      { onConflict: "place_id,user_id" }
    );

    setMyVote(star);
    await fetchVotes();
    setLoading(false);
  }

  const displayStar = hoveredStar || myVote;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!user || loading}
            onClick={() => handleVote(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`${star}점`}
          >
            <StarIcon
              className={cn(
                "size-5 transition-colors",
                star <= displayStar
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-none text-muted-foreground"
              )}
            />
          </button>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        {average !== null ? (
          <span>
            <span className="font-semibold text-foreground">{average}</span>
            {" / 5"}
            <span className="ml-1">({totalVotes}명)</span>
          </span>
        ) : (
          <span>아직 투표 없음</span>
        )}
      </div>
      {myVote > 0 && (
        <p className="text-xs text-primary">내 점수: {myVote}점</p>
      )}
    </div>
  );
}
