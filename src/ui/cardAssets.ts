// 카드 그림 연결 정보. 손패·바닥패·획득패·다음 패 보기·국진 선택창·카드 목록이 모두 이 모듈만 사용한다.
// 파일은 tools/split-cards.mjs가 hwatu-overview.svg에서 잘라 public/assets/cards/에 저장한다(THIRD_PARTY_NOTICES.md 참고).
import type Phaser from 'phaser';
import { CARDS } from '../cards.ts';

export const CARD_ASSET_DIR = 'assets/cards';
/** 원본 테두리 비율 103.2 : 168.2. 화면의 모든 카드 사각형은 이 비율을 따른다. */
export const CARD_ASPECT = 103.2 / 168.2;
export const BACK_TEXTURE = { key: 'card-back', file: 'back.png' } as const;

export function cardAssetFile(id: number) { return `card-${String(id).padStart(2, '0')}.png`; }
export function cardTextureKey(id: number) { return `card-${id}`; }

/** 씬 preload에서 호출. 48장 앞면과 뒷면을 등록한다. */
export function preloadCardAssets(loader: Phaser.Loader.LoaderPlugin) {
  for (const c of CARDS) loader.image(cardTextureKey(c.id), `${CARD_ASSET_DIR}/${cardAssetFile(c.id)}`);
  loader.image(BACK_TEXTURE.key, `${CARD_ASSET_DIR}/${BACK_TEXTURE.file}`);
}

/** 모든 카드 텍스처가 실제로 로드됐는지. 하나라도 없으면 그 id 목록을 돌려준다. */
export function missingCardTextures(textures: Phaser.Textures.TextureManager): number[] {
  return CARDS.filter(c => !textures.exists(cardTextureKey(c.id))).map(c => c.id);
}
