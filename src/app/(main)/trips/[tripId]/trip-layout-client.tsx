"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useTrip, useInvalidateTrip } from "@/hooks/use-trip";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { ActivityToast } from "@/components/realtime/activity-toast";
import { TripHeader } from "@/components/trip/trip-header";
import { TripTabNav } from "@/components/trip/trip-tab-nav";
import { TripProgressBanner } from "@/components/trip/trip-progress-banner";
import { TripEditDialog } from "@/components/trip/trip-edit-dialog";

const AiChatFab = dynamic(
  () => import("@/components/ai/ai-chat-fab").then((mod) => mod.AiChatFab),
  { ssr: false }
);

export default function TripLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const tripId = params.tripId as string;
  const { data: trip = null } = useTrip(tripId);
  const { setData } = useInvalidateTrip();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <RealtimeProvider tripId={tripId}>
      <ActivityToast />
      <div>
        <TripHeader trip={trip} onEditClick={() => setEditOpen(true)} />
        <TripTabNav tripId={tripId} />
        <TripProgressBanner tripId={tripId} />
        {children}
        <AiChatFab />
      </div>
      <TripEditDialog
        trip={trip}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={(updated) => setData(tripId, updated)}
      />
    </RealtimeProvider>
  );
}
