"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/types/database";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { ActivityToast } from "@/components/realtime/activity-toast";
import { AiChatFab } from "@/components/ai/ai-chat-fab";
import { TripHeader } from "@/components/trip/trip-header";
import { TripTabNav } from "@/components/trip/trip-tab-nav";
import { TripEditDialog } from "@/components/trip/trip-edit-dialog";

export default function TripLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const tripId = params.tripId as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetchTrip() {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      if (data) setTrip(data as Trip);
    }
    fetchTrip();
  }, [tripId]);

  return (
    <RealtimeProvider tripId={tripId}>
      <ActivityToast />
      <div>
        <TripHeader trip={trip} onEditClick={() => setEditOpen(true)} />
        <TripTabNav tripId={tripId} />
        {children}
        <AiChatFab />
      </div>
      <TripEditDialog
        trip={trip}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={setTrip}
      />
    </RealtimeProvider>
  );
}
