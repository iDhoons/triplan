import { NextResponse } from "next/server";

/**
 * 표준 API 응답 형식
 *
 * 성공: { success: true, data: T }
 * 실패: { success: false, error: string }
 */
export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * 성공 응답 생성
 */
export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true as const, data }, { status });
}

/**
 * 성공 응답 (201 Created)
 */
export function createdResponse<T>(data: T): NextResponse<ApiResponse<T>> {
  return successResponse(data, 201);
}
