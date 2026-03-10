"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { PlaceSearch, type PlaceSearchResult } from "@/components/maps/place-search";
import type { Place, PlaceCategory } from "@/types/database";
import type { ScrapedPlace } from "@/lib/scraper";

interface PlaceFormProps {
  tripId: string;
  place?: Place;
  onSuccess: (place: Place) => void;
  onCancel: () => void;
}

const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  accommodation: "숙소",
  attraction: "관광지",
  restaurant: "맛집",
  other: "기타",
};

type FormData = {
  name: string;
  category: PlaceCategory;
  url: string;
  address: string;
  rating: string;
  memo: string;
  // accommodation
  price_per_night: string;
  cancel_policy: string;
  amenities: string;
  check_in_time: string;
  check_out_time: string;
  // attraction / restaurant
  admission_fee: string;
  estimated_duration: string;
  opening_hours: string;
};

const defaultForm: FormData = {
  name: "",
  category: "other",
  url: "",
  address: "",
  rating: "",
  memo: "",
  price_per_night: "",
  cancel_policy: "",
  amenities: "",
  check_in_time: "",
  check_out_time: "",
  admission_fee: "",
  estimated_duration: "",
  opening_hours: "",
};

function placeToForm(place: Place): FormData {
  return {
    name: place.name,
    category: place.category,
    url: place.url ?? "",
    address: place.address ?? "",
    rating: place.rating !== null ? String(place.rating) : "",
    memo: place.memo ?? "",
    price_per_night:
      place.price_per_night !== null ? String(place.price_per_night) : "",
    cancel_policy: place.cancel_policy ?? "",
    amenities: (place.amenities ?? []).join(", "),
    check_in_time: place.check_in_time ?? "",
    check_out_time: place.check_out_time ?? "",
    admission_fee:
      place.admission_fee !== null ? String(place.admission_fee) : "",
    estimated_duration:
      place.estimated_duration !== null
        ? String(place.estimated_duration)
        : "",
    opening_hours: place.opening_hours
      ? JSON.stringify(place.opening_hours)
      : "",
  };
}

export function PlaceForm({
  tripId,
  place,
  onSuccess,
  onCancel,
}: PlaceFormProps) {
  const supabase = createClient();
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState<FormData>(
    place ? placeToForm(place) : defaultForm
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(place?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(place?.longitude ?? null);
  const [searchImageUrl, setSearchImageUrl] = useState<string | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const applyScrapeResult = useCallback((data: ScrapedPlace) => {
    setForm((prev) => ({
      ...prev,
      name: data.name || prev.name,
      category: data.category || prev.category,
      url: data.url || prev.url,
      address: data.address || prev.address,
      rating: data.rating !== null ? String(data.rating) : prev.rating,
      memo: data.memo || prev.memo,
      price_per_night: data.price_per_night !== null ? String(data.price_per_night) : prev.price_per_night,
      cancel_policy: data.cancel_policy || prev.cancel_policy,
      amenities: data.amenities.length > 0 ? data.amenities.join(", ") : prev.amenities,
      check_in_time: data.check_in_time || prev.check_in_time,
      check_out_time: data.check_out_time || prev.check_out_time,
    }));
    if (data.imageUrl) {
      setSearchImageUrl(data.imageUrl);
    }
  }, []);

  const fetchAndScrape = useCallback(async (url: string) => {
    setScraping(true);
    setScrapeError(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "스크래핑에 실패했습니다");
      }
      const data: ScrapedPlace = await res.json();
      applyScrapeResult(data);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "스크래핑에 실패했습니다");
    } finally {
      setScraping(false);
    }
  }, [applyScrapeResult]);

  const handleScrape = useCallback(() => {
    const url = scrapeUrl.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setScrapeError("올바른 URL을 입력해주세요");
      return;
    }
    fetchAndScrape(url);
  }, [scrapeUrl, fetchAndScrape]);

  function handlePlaceSearchSelect(result: PlaceSearchResult) {
    // 장소 타입으로 카테고리 자동 추론
    let category: PlaceCategory = "other";
    const types = result.placeTypes;
    if (types.some((t) => ["lodging", "hotel", "resort_hotel"].includes(t))) {
      category = "accommodation";
    } else if (types.some((t) => ["restaurant", "cafe", "bakery", "bar", "food", "meal_delivery", "meal_takeaway"].includes(t))) {
      category = "restaurant";
    } else if (types.some((t) => ["tourist_attraction", "museum", "amusement_park", "park", "zoo", "aquarium", "art_gallery", "stadium", "church", "temple"].includes(t))) {
      category = "attraction";
    }

    setForm((prev) => ({
      ...prev,
      name: result.name,
      address: result.address,
      rating: result.rating !== null ? String(result.rating) : prev.rating,
      url: result.url ?? prev.url,
      category,
    }));
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    if (result.imageUrl) {
      setSearchImageUrl(result.imageUrl);
    }
  }

  function set(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);

    try {
      let imageUrls: string[] = place?.image_urls ?? [];

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${tripId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("place-images")
          .upload(path, imageFile, { upsert: true });

        if (uploadErr) throw uploadErr;

        const {
          data: { publicUrl },
        } = supabase.storage.from("place-images").getPublicUrl(path);
        imageUrls = [...imageUrls, publicUrl];
      }

      // Google 검색으로 가져온 이미지가 있고 직접 업로드 안 했으면 추가
      if (searchImageUrl && !imageFile && !imageUrls.includes(searchImageUrl)) {
        imageUrls = [...imageUrls, searchImageUrl];
      }

      const payload = {
        trip_id: tripId,
        category: form.category,
        name: form.name.trim(),
        url: form.url.trim() || null,
        address: form.address.trim() || null,
        latitude,
        longitude,
        rating: form.rating ? Number(form.rating) : null,
        memo: form.memo.trim() || null,
        image_urls: imageUrls,
        // accommodation
        price_per_night: form.price_per_night
          ? Number(form.price_per_night)
          : null,
        cancel_policy: form.cancel_policy.trim() || null,
        amenities: form.amenities
          ? form.amenities.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        check_in_time: form.check_in_time.trim() || null,
        check_out_time: form.check_out_time.trim() || null,
        // attraction / restaurant
        admission_fee: form.admission_fee ? Number(form.admission_fee) : null,
        estimated_duration: form.estimated_duration
          ? Number(form.estimated_duration)
          : null,
        opening_hours: (() => {
          if (!form.opening_hours.trim()) return null;
          try {
            return JSON.parse(form.opening_hours);
          } catch {
            return null;
          }
        })(),
        added_by: user.id,
      };

      if (place) {
        const { data, error: updateErr } = await supabase
          .from("places")
          .update(payload)
          .eq("id", place.id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        onSuccess(data as Place);
      } else {
        const { data, error: insertErr } = await supabase
          .from("places")
          .insert(payload)
          .select()
          .single();
        if (insertErr) throw insertErr;
        onSuccess(data as Place);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const isAccommodation = form.category === "accommodation";
  const isAttractionOrRestaurant =
    form.category === "attraction" || form.category === "restaurant";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* 검색 / URL 입력 */}
      {!place && (
        <Tabs defaultValue="search" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">지도 검색</TabsTrigger>
            <TabsTrigger value="url">URL 붙여넣기</TabsTrigger>
          </TabsList>
          <TabsContent value="search">
            <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
              <PlaceSearch onSelect={handlePlaceSearchSelect} />
              <p className="text-xs text-muted-foreground">
                검색하면 이름, 주소, 평점, 카테고리가 자동으로 채워집니다
              </p>
            </div>
          </TabsContent>
          <TabsContent value="url">
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-orange-300 bg-orange-50/50 p-3 dark:border-orange-800 dark:bg-orange-950/20">
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                호텔 예약 사이트 URL을 붙여넣으세요
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://www.booking.com/hotel/..."
                  value={scrapeUrl}
                  onChange={(e) => {
                    setScrapeUrl(e.target.value);
                    setScrapeError(null);
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text").trim();
                    if (pasted && pasted.startsWith("http")) {
                      setScrapeUrl(pasted);
                      fetchAndScrape(pasted);
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={scraping || !scrapeUrl.trim()}
                  onClick={handleScrape}
                >
                  {scraping ? "불러오는 중..." : "불러오기"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                부킹닷컴, 아고다, 야놀자, 여기어때, 에어비앤비 등 지원
              </p>
              {scrapeError && (
                <p className="text-xs text-destructive">{scrapeError}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* 공통 필드 */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-name">장소명 *</Label>
        <Input
          id="pf-name"
          required
          placeholder="장소 이름을 입력하세요"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-category">카테고리 *</Label>
        <Select
          value={form.category}
          onValueChange={(v) => set("category", v as PlaceCategory)}
        >
          <SelectTrigger id="pf-category" className="w-full">
            <SelectValue placeholder="카테고리 선택" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CATEGORY_LABELS) as PlaceCategory[]).map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-rating">평점 (1-5)</Label>
          <Input
            id="pf-rating"
            type="number"
            min="1"
            max="5"
            step="0.1"
            placeholder="4.5"
            value={form.rating}
            onChange={(e) => set("rating", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-url">URL</Label>
          <Input
            id="pf-url"
            type="url"
            placeholder="https://"
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-address">주소</Label>
        <Input
          id="pf-address"
          placeholder="주소를 입력하세요"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-memo">메모</Label>
        <Textarea
          id="pf-memo"
          placeholder="장소에 대한 메모를 남겨주세요"
          value={form.memo}
          onChange={(e) => set("memo", e.target.value)}
          className="resize-none"
          rows={3}
        />
      </div>

      {/* 이미지 업로드 */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-image">이미지 업로드</Label>
        <Input
          id="pf-image"
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          className="cursor-pointer"
        />
      </div>

      {/* 숙소 전용 필드 */}
      {isAccommodation && (
        <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            숙소 정보
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pf-ppn">1박 가격 (원)</Label>
              <Input
                id="pf-ppn"
                type="number"
                min="0"
                placeholder="150000"
                value={form.price_per_night}
                onChange={(e) => set("price_per_night", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pf-cancel">취소 정책</Label>
              <Input
                id="pf-cancel"
                placeholder="무료취소 7일 전까지"
                value={form.cancel_policy}
                onChange={(e) => set("cancel_policy", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pf-checkin">체크인</Label>
              <Input
                id="pf-checkin"
                type="time"
                value={form.check_in_time}
                onChange={(e) => set("check_in_time", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pf-checkout">체크아웃</Label>
              <Input
                id="pf-checkout"
                type="time"
                value={form.check_out_time}
                onChange={(e) => set("check_out_time", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pf-amenities">부대시설 (쉼표로 구분)</Label>
            <Input
              id="pf-amenities"
              placeholder="수영장, 피트니스, 레스토랑"
              value={form.amenities}
              onChange={(e) => set("amenities", e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 관광지 / 맛집 전용 필드 */}
      {isAttractionOrRestaurant && (
        <div className="flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50/50 p-3 dark:border-green-900 dark:bg-green-950/20">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400">
            {form.category === "attraction" ? "관광지 정보" : "맛집 정보"}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pf-fee">입장료 (원)</Label>
              <Input
                id="pf-fee"
                type="number"
                min="0"
                placeholder="10000"
                value={form.admission_fee}
                onChange={(e) => set("admission_fee", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pf-duration">소요시간 (분)</Label>
              <Input
                id="pf-duration"
                type="number"
                min="0"
                placeholder="120"
                value={form.estimated_duration}
                onChange={(e) => set("estimated_duration", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pf-hours">
              영업시간 (JSON 형식, 예: {"{'월':'09:00-18:00'}"})
            </Label>
            <Textarea
              id="pf-hours"
              placeholder='{"월": "09:00-18:00", "화": "09:00-18:00"}'
              value={form.opening_hours}
              onChange={(e) => set("opening_hours", e.target.value)}
              className="resize-none font-mono text-xs"
              rows={3}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "저장 중..." : place ? "수정" : "추가"}
        </Button>
      </div>
    </form>
  );
}
