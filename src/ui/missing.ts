// 읽지 못한 그림 경로 기록. 로더 실패는 콘솔에 남기지 않고 여기에만 모아 메뉴 > 개발 정보에서 보여준다(브라우저의 네트워크 404 로그는 막을 수 없다).
// 실패한 텍스처 키도 기억해, 씬이 다시 시작돼도 같은 파일을 다시 요청하지 않는다(요청 15).
const missing = new Set<string>();
const failedKeys = new Set<string>();
export function noteMissing(src: string, key?: string) { missing.add(src); if (key) failedKeys.add(key); }
/** 이 키의 읽기가 이미 실패했는가(재요청 방지용). */
export function loadFailed(key: string): boolean { return failedKeys.has(key); }
export function missingAssets(): string[] { return [...missing].sort(); }
