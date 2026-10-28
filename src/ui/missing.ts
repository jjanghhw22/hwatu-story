// 읽지 못한 그림 경로 기록. 로더 실패는 콘솔에 남기지 않고 여기에만 모아 메뉴 > 개발 정보에서 보여준다(브라우저의 네트워크 404 로그는 막을 수 없다).
const missing = new Set<string>();
export function noteMissing(src: string) { missing.add(src); }
export function missingAssets(): string[] { return [...missing].sort(); }
