// GET /api/divinations → 占いレジストリ（必要事項の仕様）をフロントへ返す
import { DIVINATIONS } from '../_lib/divinations.js';

export async function onRequestGet() {
  return new Response(JSON.stringify({ divinations: DIVINATIONS }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
