"use client";

import { Drawer } from "vaul";
import {
  MapPinIcon,
  StarIcon,
  PhoneIcon,
  GlobeIcon,
  ClockIcon,
  CalendarIcon,
  NavigationIcon,
  TicketIcon,
  HotelIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatFullAddress, formatPriceLevel } from "@/lib/utils";
import { PLACE_CATEGORY_LABEL, PLACE_CATEGORY_BADGE_CLASS } from "@/config/categories";
import type { Place } from "@/types/database";

interface PlaceDetailDrawerProps {
  place: Place | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (place: Place) => void;
  onDelete: (place: Place) => void;
}

function InfoRow({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function PlaceDetailDrawer({
  place,
  onOpenChange,
  onEdit,
  onDelete,
}: PlaceDetailDrawerProps) {
  if (!place) return null;

  const fullAddress = formatFullAddress(place.address_components, place.address);

  return (
    <Drawer.Root open onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-background max-h-[92dvh]">
          {/* Handle */}
          <div className="mx-auto mt-3 mb-2 h-1 w-10 rounded-full bg-muted-foreground/20" />

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Gallery */}
            {place.image_urls?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 snap-x">
                {place.image_urls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`${place.name} ${i + 1}`}
                    className="h-48 min-w-[280px] rounded-lg object-cover snap-start"
                  />
                ))}
              </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <Drawer.Title className="text-lg font-semibold line-clamp-2">
                  {place.name}
                </Drawer.Title>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    className={cn(
                      "border text-xs",
                      PLACE_CATEGORY_BADGE_CLASS[place.category]
                    )}
                    variant="outline"
                  >
                    {PLACE_CATEGORY_LABEL[place.category]}
                  </Badge>
                  {place.rating !== null && (
                    <div className="flex items-center gap-0.5">
                      <StarIcon className="size-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{place.rating}</span>
                      {place.review_count !== null && (
                        <span className="text-xs text-muted-foreground">
                          ({place.review_count.toLocaleString()})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Info sections */}
            <div className="flex flex-col gap-3">
              {/* 주소 (한글 + 원본) */}
              {fullAddress && (
                <InfoRow icon={MapPinIcon}>
                  <p>{fullAddress}</p>
                  {place.address && place.address !== fullAddress && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {place.address}
                    </p>
                  )}
                </InfoRow>
              )}

              {/* 카테고리별 고유 정보 */}
              {place.category === "accommodation" && (
                <>
                  {place.price_per_night !== null && (
                    <InfoRow icon={HotelIcon}>
                      <span className="font-semibold text-primary">
                        ₩{place.price_per_night.toLocaleString()} / 박
                      </span>
                    </InfoRow>
                  )}
                  {(place.check_in_time || place.check_out_time) && (
                    <InfoRow icon={CalendarIcon}>
                      <span>
                        {place.check_in_time && `체크인 ${place.check_in_time}`}
                        {place.check_in_time && place.check_out_time && " · "}
                        {place.check_out_time && `체크아웃 ${place.check_out_time}`}
                      </span>
                    </InfoRow>
                  )}
                  {place.cancel_policy && (
                    <InfoRow icon={ClockIcon}>
                      <span className="text-muted-foreground">{place.cancel_policy}</span>
                    </InfoRow>
                  )}
                </>
              )}

              {place.category === "attraction" && (
                <>
                  {place.estimated_duration !== null && (
                    <InfoRow icon={ClockIcon}>
                      <span>예상 소요시간 {place.estimated_duration}분</span>
                    </InfoRow>
                  )}
                  {place.admission_fee !== null && (
                    <InfoRow icon={TicketIcon}>
                      <span>
                        {place.admission_fee === 0
                          ? "무료 입장"
                          : `입장료 ₩${place.admission_fee.toLocaleString()}`}
                      </span>
                    </InfoRow>
                  )}
                </>
              )}

              {place.category === "restaurant" && place.price_level !== null && (
                <InfoRow icon={TicketIcon}>
                  <span>가격대 {formatPriceLevel(place.price_level)}</span>
                </InfoRow>
              )}

              {/* 영업시간 */}
              {place.opening_hours && Object.keys(place.opening_hours).length > 0 && (
                <InfoRow icon={ClockIcon}>
                  <div className="space-y-0.5">
                    {Object.entries(place.opening_hours).map(([day, hours]) => (
                      <div key={day} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{day}</span>
                        <span>{hours}</span>
                      </div>
                    ))}
                  </div>
                </InfoRow>
              )}

              {/* 전화 */}
              {place.phone && (
                <InfoRow icon={PhoneIcon}>
                  <a
                    href={`tel:${place.phone}`}
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {place.phone}
                  </a>
                </InfoRow>
              )}

              {/* 웹사이트 */}
              {place.website && (
                <InfoRow icon={GlobeIcon}>
                  <a
                    href={place.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-4 hover:underline truncate block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {new URL(place.website).hostname}
                  </a>
                </InfoRow>
              )}

              {/* 설명 */}
              {place.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {place.description}
                </p>
              )}

              {/* 메모 */}
              {place.memo && place.memo !== place.description && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">메모</p>
                  <p className="text-sm whitespace-pre-wrap">{place.memo}</p>
                </div>
              )}

              {/* Google Maps 링크 */}
              {place.latitude && place.longitude && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <NavigationIcon className="size-4 text-primary" />
                  <span>Google Maps에서 보기</span>
                </a>
              )}
            </div>
          </div>

          {/* Sticky action bar */}
          <div className="border-t bg-background px-4 py-3 flex items-center gap-2">
            <Button className="flex-1" size="sm">
              일정에 추가
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onEdit(place);
                onOpenChange(false);
              }}
            >
              <PencilIcon className="size-3.5" />
              수정
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                onDelete(place);
                onOpenChange(false);
              }}
            >
              <Trash2Icon className="size-3.5" />
              삭제
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
