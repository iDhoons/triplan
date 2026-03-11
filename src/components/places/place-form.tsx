"use client";

import { useState, useCallback, useEffect } from "react";
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
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [searchImageUrls, setSearchImageUrls] = useState<string[]>([]);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(!!place);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

  // 자동채움 하이라이트 2초 후 제거
  useEffect(() => {
    if (autoFilledFields.size === 0) return;
    const timer = setTimeout(() => setAutoFilledFields(new Set()), 2000);
    return () => clearTimeout(timer);
  }, [autoFilledFields]);

  const applyScrapeResult = useCallback((data: ScrapedPlace) => {
    const filled = new Set<string>();
    setForm((prev) => {
      const next = { ...prev };
      if (data.name) { next.name = data.name; filled.add("name"); }
      if (data.category) { next.category = data.category; filled.add("category"); }
      if (data.url) { next.url = data.url; filled.add("url"); }
      if (data.address) { next.address = data.address; filled.add("address"); }
      if (data.rating !== null) { next.rating = String(data.rating); filled.add("rating"); }
      if (data.memo) { next.memo = data.memo; filled.add("memo"); }
      if (data.price_per_night !== null) { next.price_per_night = String(data.price_per_night); filled.add("price_per_night"); }
      if (data.cancel_policy) { next.cancel_policy = data.cancel_policy; filled.add("cancel_policy"); }
      if (data.amenities.length > 0) { next.amenities = data.amenities.join(", "); filled.add("amenities"); }
      if (data.check_in_time) { next.check_in_time = data.check_in_time; filled.add("check_in_time"); }
      if (data.check_out_time) { next.check_out_time = data.check_out_time; filled.add("check_out_time"); }
      return next;
    });
    if (data.imageUrl) {
      setSearchImageUrl(data.imageUrl);
    }
    setAutoFilledFields(filled);
    // 상세 섹션에 채워진 필드가 있으면 자동 펼침
    const detailFields = ["rating", "url", "address", "price_per_night", "cancel_policy", "amenities", "check_in_time", "check_out_time", "admission_fee", "estimated_duration"];
    if (detailFields.some((f) => filled.has(f))) {
      setShowDetails(true);
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
      opening_hours: result.openingHours ? JSON.stringify(result.openingHours) : prev.opening_hours,
      category,
    }));
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    // 사진 여러 장 저장
    if (result.imageUrls.length > 0) {
      setSearchImageUrl(result.imageUrls[0]);
      setSearchImageUrls(result.imageUrls);
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

      // Google 검색으로 가져온 이미지 추가 (여러 장)
      if (searchImageUrls.length > 0 && !imageFile) {
        const newUrls = searchImageUrls.filter((u) => !imageUrls.includes(u));
        imageUrls = [...imageUrls, ...newUrls];
      } else if (searchImageUrl && !imageFile && !imageUrls.includes(searchImageUrl)) {
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
                장소 URL을 붙여넣으세요
              </p>
              <p className="text-xs text-muted-foreground">
                URL에서 이름, 주소, 이미지, 평점 등을 자동으로 가져옵니다
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="네이버 지도, 구글맵, 부킹닷컴 등 URL"
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
                부킹닷컴, 아고다, 야놀자, 여기어때, 에어비앤비, 구글맵 등 대부분의 사이트 지원
              </p>
              {scrapeError && (
                <p className="text-xs text-destructive">{scrapeError}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* 기본 필드 — 항상 노출 */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-name">장소명 *</Label>
        <Input
          id="pf-name"
          required
          placeholder="장소 이름을 입력하세요"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className={cn(autoFilledFields.has("name") && "ring-2 ring-primary/50 bg-primary/5 transition-all")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-category">카테고리 *</Label>
        <Select
          value={form.category}
          onValueChange={(v) => set("category", v as PlaceCategory)}
        >
          <SelectTrigger id="pf-category" className={cn("w-full", autoFilledFields.has("category") && "ring-2 ring-primary/50 bg-primary/5 transition-all")}>
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-memo">메모</Label>
        <Textarea
          id="pf-memo"
          placeholder="장소에 대한 메모를 남겨주세요"
          value={form.memo}
          onChange={(e) => set("memo", e.target.value)}
          className={cn("resize-none", autoFilledFields.has("memo") && "ring-2 ring-primary/50 bg-primary/5 transition-all")}
          rows={2}
        />
      </div>

      {/* 영업시간 (자동 수집된 경우 읽기 전용 표시) */}
      {form.opening_hours && (() => {
        try {
          const hours = JSON.parse(form.opening_hours) as Record<string, string>;
          return (
            <div className="rounded-lg border border-muted bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">영업시간 (자동 수집)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                {Object.entries(hours).map(([day, time]) => (
                  <p key={day}><span className="font-medium">{day}</span> {String(time)}</p>
                ))}
              </div>
            </div>
          );
        } catch {
          return null;
        }
      })()}

      {/* 상세 정보 토글 */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDetails && "rotate-180")} />
        {showDetails ? "상세 정보 접기" : "상세 정보 펼치기"}
        {autoFilledFields.size > 0 && !showDetails && (
          <span className="text-primary font-medium ml-1">(자동 입력됨)</span>
        )}
      </button>

      {showDetails && (
        <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
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
                className={cn(autoFilledFields.has("rating") && "ring-2 ring-primary/50 bg-primary/5 transition-all")}
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
              className={cn(autoFilledFields.has("address") && "ring-2 ring-primary/50 bg-primary/5 transition-all")}
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
                    className={cn(autoFilledFields.has("price_per_night") && "ring-2 ring-primary/50 bg-primary/5 transition-all")}
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
            </div>
          )}
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
