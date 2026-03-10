"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TripJournal } from "@/types/database";
import { Plus, Trash2, ImagePlus, X } from "lucide-react";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export default function JournalPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { user } = useAuthStore();
  const supabase = createClient();

  const [journals, setJournals] = useState<TripJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TripJournal | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formContent, setFormContent] = useState("");
  const [formFiles, setFormFiles] = useState<File[]>([]);
  const [formPreviewUrls, setFormPreviewUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchJournals();
  }, [tripId]);

  async function fetchJournals() {
    setLoading(true);
    const { data } = await supabase
      .from("trip_journals")
      .select("*, profile:profiles(id, display_name, avatar_url, created_at)")
      .eq("trip_id", tripId)
      .order("date", { ascending: false });

    if (data) setJournals(data as TripJournal[]);
    setLoading(false);
  }

  function openCreateDialog() {
    setEditTarget(null);
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormContent("");
    setFormFiles([]);
    setFormPreviewUrls([]);
    setDialogOpen(true);
  }

  function openEditDialog(journal: TripJournal) {
    setEditTarget(journal);
    setFormDate(journal.date);
    setFormContent(journal.content ?? "");
    setFormFiles([]);
    setFormPreviewUrls([]);
    setDialogOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setFormFiles((prev) => [...prev, ...files]);
    setFormPreviewUrls((prev) => [...prev, ...newPreviews]);
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFormFiles((prev) => prev.filter((_, i) => i !== index));
    setFormPreviewUrls((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function uploadPhotos(files: File[]): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${tripId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("journal-photos")
        .upload(path, file);
      if (!error) {
        const { data } = supabase.storage
          .from("journal-photos")
          .getPublicUrl(path);
        if (data?.publicUrl) urls.push(data.publicUrl);
      }
    }
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    let photoUrls: string[] = editTarget?.photo_urls ?? [];
    if (formFiles.length > 0) {
      const uploaded = await uploadPhotos(formFiles);
      photoUrls = [...photoUrls, ...uploaded];
    }

    if (editTarget) {
      await supabase
        .from("trip_journals")
        .update({
          date: formDate,
          content: formContent || null,
          photo_urls: photoUrls,
        })
        .eq("id", editTarget.id);
    } else {
      await supabase.from("trip_journals").insert({
        trip_id: tripId,
        author_id: user.id,
        date: formDate,
        content: formContent || null,
        photo_urls: photoUrls,
      });
    }

    // Revoke preview URLs
    formPreviewUrls.forEach((url) => URL.revokeObjectURL(url));

    await fetchJournals();
    setSaving(false);
    setDialogOpen(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("trip_journals").delete().eq("id", id);
    setJournals((prev) => prev.filter((j) => j.id !== id));
  }

  async function handleRemovePhoto(journal: TripJournal, urlToRemove: string) {
    const updated = journal.photo_urls.filter((u) => u !== urlToRemove);
    await supabase
      .from("trip_journals")
      .update({ photo_urls: updated })
      .eq("id", journal.id);
    setJournals((prev) =>
      prev.map((j) =>
        j.id === journal.id ? { ...j, photo_urls: updated } : j
      )
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-36" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">여행 후기</h2>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          후기 작성
        </Button>
      </div>

      {/* Journal form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "후기 수정" : "후기 작성"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>날짜</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea
                placeholder="오늘 여행은 어땠나요?"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label>사진</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              {/* Existing photos when editing */}
              {editTarget && editTarget.photo_urls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {editTarget.photo_urls.map((url) => (
                    <div key={url} className="relative aspect-square group">
                      <img
                        src={url}
                        alt="사진"
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(editTarget, url)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* New photo previews */}
              {formPreviewUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {formPreviewUrls.map((url, i) => (
                    <div key={url} className="relative aspect-square group">
                      <img
                        src={url}
                        alt="미리보기"
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3 w-full hover:bg-muted transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                사진 추가하기
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "저장 중..." : editTarget ? "수정" : "등록"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Journal list */}
      {journals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📖</p>
          <p className="font-medium">아직 후기가 없어요</p>
          <p className="text-sm mt-1">여행의 소중한 기억을 기록해보세요!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {journals.map((journal) => (
            <Card key={journal.id}>
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarImage src={journal.profile?.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {journal.profile?.display_name?.[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {journal.profile?.display_name ?? "알 수 없음"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(journal.date)}
                    </p>
                  </div>
                </div>
                {/* Only author can edit/delete */}
                {user?.id === journal.author_id && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground"
                      onClick={() => openEditDialog(journal)}
                    >
                      수정
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(journal.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {journal.content && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {journal.content}
                  </p>
                )}
                {journal.photo_urls.length > 0 && (
                  <div
                    className={`grid gap-2 ${
                      journal.photo_urls.length === 1
                        ? "grid-cols-1"
                        : journal.photo_urls.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-3"
                    }`}
                  >
                    {journal.photo_urls.map((url) => (
                      <div
                        key={url}
                        className={`relative overflow-hidden rounded-lg bg-muted ${
                          journal.photo_urls.length === 1
                            ? "aspect-video"
                            : "aspect-square"
                        }`}
                      >
                        <img
                          src={url}
                          alt="후기 사진"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
